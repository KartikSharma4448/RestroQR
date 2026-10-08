import express from 'express';
import request from 'supertest';

jest.mock('../../config/database', () => ({
  __esModule: true, default: { query: jest.fn(), connect: jest.fn() },
}));
jest.mock('../../services/tableService', () => ({ decryptTableToken: jest.fn() }));
jest.mock('../../services/notificationService', () => ({ sendOrderNotification: jest.fn() }));

import pool from '../../config/database';
import { decryptTableToken } from '../../services/tableService';
import { createOrder, updateOrderStatus, cancelOrder } from '../../services/orderService';
import { errorHandler } from '../../middleware/errorHandler';
import publicOrders from '../../routes/public/orders';
import publicLoyalty from '../../routes/public/loyalty';

const query = pool.query as jest.Mock;
const connect = pool.connect as jest.Mock;
const decrypt = decryptTableToken as jest.Mock;
const restaurantId = '11111111-1111-4111-8111-111111111111';
const tableId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const orderId = '44444444-4444-4444-8444-444444444444';
const items = [{ itemId, quantity: 1 }];
const app = express();
app.use(express.json({ limit: '10kb' }));
app.use('/api/public', publicOrders, publicLoyalty);
app.use(errorHandler);

beforeEach(() => {
  jest.resetAllMocks();
  decrypt.mockReturnValue({ restaurantId, tableId });
});

describe('Public customer-data boundary', () => {
  it('does not return rewards data or query the database before customer verification exists', async () => {
    const response = await request(app).get('/api/public/loyalty/0000000000?restaurantToken=AUDITONLY');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CUSTOMER_VERIFICATION_REQUIRED');
    expect(response.body.data).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
    expect(query).not.toHaveBeenCalled();
  });
});

describe('Order validation before database access', () => {
  it.each([null, {}, { itemId, quantity: 0 }, { itemId, quantity: -1 },
    { itemId, quantity: 1.5 }, { itemId, quantity: '2' }, { itemId, quantity: 101 },
    { itemId, quantity: 2147483648 }, { itemId: null, quantity: 1 },
    { itemId: 'not-a-uuid', quantity: 1 }])('rejects malformed public item %j', async item => {
    const response = await request(app).post('/api/public/orders').send({ tableToken: 'audit-token', items: [item] });
    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it.each([{ customerPhone: {} }, { customerPhone: 1234567890 }, { customerPhone: 'bad' },
    { customerName: {} }, { customerName: 'x'.repeat(101) }])('rejects malformed customer fields %j', async fields => {
    const response = await request(app).post('/api/public/orders').send({ tableToken: 'audit-token', items, ...fields });
    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('caps cart rows and rejects duplicate IDs', async () => {
    await expect(createOrder('token', Array.from({ length: 51 }, () => items[0]))).rejects.toThrow('At least one item');
    await expect(createOrder('token', [items[0], items[0]])).rejects.toThrow('Duplicate');
    expect(query).not.toHaveBeenCalled();
  });

  it.each(['status', 'owner_status'])('rejects a disabled %s before transaction acquisition', async field => {
    query.mockResolvedValueOnce({ rows: [{ id: restaurantId, qr_mode: 'multi', status: 'active', owner_status: 'active', [field]: 'disabled' }] });
    await expect(createOrder('token', items)).rejects.toThrow('Menu not found');
    expect(connect).not.toHaveBeenCalled();
  });

  it('fails closed when account status is missing', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: restaurantId, qr_mode: 'multi' }] });
    await expect(createOrder('token', items)).rejects.toThrow('Menu not found');
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('Atomic order-state transitions', () => {
  const row = (status: string) => ({ id: orderId, restaurant_id: restaurantId, table_id: tableId,
    order_ref: 'AUDIT-ONLY', status, total: '100.00', created_at: new Date(), updated_at: new Date(),
    accepted_at: null, completed_at: new Date(), payment_received_at: null, cancelled_at: null });

  it('prevents a stale cancellation from overwriting payment', async () => {
    let status = 'completed';
    query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('SELECT o.id')) return { rows: [row(status)] };
      if (sql.includes('UPDATE orders SET status = $1')) {
        expect(sql).toContain('AND status = $4');
        if (status !== params[3]) return { rows: [], rowCount: 0 };
        status = params[0] as string;
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("UPDATE orders SET status = 'cancelled'")) {
        expect(sql).toContain('AND status = $3');
        if (status !== params[2]) return { rows: [], rowCount: 0 };
        status = 'cancelled';
        return { rows: [], rowCount: 1 };
      }
      throw new Error('Unexpected SQL');
    });
    const results = await Promise.allSettled([
      updateOrderStatus(orderId, restaurantId, 'payment_received'), cancelOrder(orderId, restaurantId),
    ]);
    expect(status).toBe('payment_received');
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    if (results[1].status === 'rejected') expect(results[1].reason.statusCode).toBe(409);
  });

  it('rejects a stale forward transition with a conflict', async () => {
    query.mockResolvedValueOnce({ rows: [row('pending')] }).mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(updateOrderStatus(orderId, restaurantId, 'accepted')).rejects.toMatchObject({ statusCode: 409 });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
