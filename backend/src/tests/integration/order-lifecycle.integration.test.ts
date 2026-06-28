import supertest from 'supertest';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mockedhashvalue'),
  compare: jest.fn(),
}));

// Mock nanoid
jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'aBcDeFgHiJ',
}));

// Set env before importing app
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.NODE_ENV = 'test';

// Mock the database pool
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

import app from '../../index';
import pool from '../../config/database';
import { generateOwnerToken } from '../helpers/auth';

const mockPool = pool as jest.Mocked<typeof pool>;

describe('Order Lifecycle Integration Tests', () => {
  const ownerId = 'owner-001-uuid';
  const ownerToken = generateOwnerToken(ownerId, 'owner@test.com');
  const restaurantId = 'rest-001-uuid';
  const orderId = 'order-001-uuid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Auth middleware fires for each owner router mount that shares '/api/owner'.
   * Route order: restaurant(1), categories(2), qr(3), items(4),
   *              settings(5), tables(6), orders(7), earnings(8), notifications(9)
   */
  function mockAuthForOrders() {
    for (let i = 0; i < 7; i++) {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ status: 'active' }],
      });
    }
  }

  function mockAuthForEarnings() {
    for (let i = 0; i < 8; i++) {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ status: 'active' }],
      });
    }
  }

  /** Helper: returns a mock order row from the DB */
  function makeOrderRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: orderId,
      restaurant_id: restaurantId,
      table_id: 'table-001-uuid',
      order_ref: 'ORD-ABC123',
      status: 'pending',
      total: '450.00',
      created_at: new Date('2025-01-15T10:00:00Z'),
      accepted_at: null,
      completed_at: null,
      payment_received_at: null,
      cancelled_at: null,
      updated_at: new Date('2025-01-15T10:00:00Z'),
      display_name: 'Table 5',
      ...overrides,
    };
  }

  describe('Full lifecycle: pending → accepted → completed → payment_received', () => {
    it('should transition pending → accepted', async () => {
      mockAuthForOrders();
      // getRestaurantIdForOwner
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      // Fetch current order (status: pending)
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({ status: 'pending' })],
      });
      // UPDATE order status
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // Re-fetch updated order
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({ status: 'accepted', accepted_at: new Date('2025-01-15T10:05:00Z') })],
      });

      const res = await supertest(app)
        .patch(`/api/owner/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.status).toBe('accepted');
      expect(res.body.data.order.acceptedAt).not.toBeNull();
    });

    it('should transition accepted → completed', async () => {
      mockAuthForOrders();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({ status: 'accepted', accepted_at: new Date('2025-01-15T10:05:00Z') })],
      });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({
          status: 'completed',
          accepted_at: new Date('2025-01-15T10:05:00Z'),
          completed_at: new Date('2025-01-15T10:20:00Z'),
        })],
      });

      const res = await supertest(app)
        .patch(`/api/owner/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.status).toBe('completed');
      expect(res.body.data.order.completedAt).not.toBeNull();
    });

    it('should transition completed → payment_received', async () => {
      mockAuthForOrders();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({
          status: 'completed',
          accepted_at: new Date('2025-01-15T10:05:00Z'),
          completed_at: new Date('2025-01-15T10:20:00Z'),
        })],
      });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({
          status: 'payment_received',
          accepted_at: new Date('2025-01-15T10:05:00Z'),
          completed_at: new Date('2025-01-15T10:20:00Z'),
          payment_received_at: new Date('2025-01-15T10:30:00Z'),
        })],
      });

      const res = await supertest(app)
        .patch(`/api/owner/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'payment_received' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.status).toBe('payment_received');
      expect(res.body.data.order.paymentReceivedAt).not.toBeNull();
    });
  });

  describe('Cancellation from each valid state', () => {
    it('should cancel from pending', async () => {
      mockAuthForOrders();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({ status: 'pending' })],
      });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({ status: 'cancelled', cancelled_at: new Date('2025-01-15T10:02:00Z') })],
      });

      const res = await supertest(app)
        .post(`/api/owner/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.status).toBe('cancelled');
      expect(res.body.data.order.cancelledAt).not.toBeNull();
    });

    it('should cancel from accepted', async () => {
      mockAuthForOrders();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({ status: 'accepted', accepted_at: new Date('2025-01-15T10:05:00Z') })],
      });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({ status: 'cancelled', cancelled_at: new Date('2025-01-15T10:10:00Z') })],
      });

      const res = await supertest(app)
        .post(`/api/owner/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.status).toBe('cancelled');
    });

    it('should cancel from completed', async () => {
      mockAuthForOrders();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({
          status: 'completed',
          accepted_at: new Date('2025-01-15T10:05:00Z'),
          completed_at: new Date('2025-01-15T10:20:00Z'),
        })],
      });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({ status: 'cancelled', cancelled_at: new Date('2025-01-15T10:25:00Z') })],
      });

      const res = await supertest(app)
        .post(`/api/owner/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.status).toBe('cancelled');
    });
  });

  describe('Invalid transitions rejected', () => {
    it('should reject pending → completed (must go through accepted)', async () => {
      mockAuthForOrders();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({ status: 'pending' })],
      });

      const res = await supertest(app)
        .patch(`/api/owner/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
      expect(res.body.error.message).toContain('pending');
      expect(res.body.error.message).toContain('completed');
    });

    it('should reject pending → payment_received (must follow sequence)', async () => {
      mockAuthForOrders();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({ status: 'pending' })],
      });

      const res = await supertest(app)
        .patch(`/api/owner/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'payment_received' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('should reject cancellation of payment_received order', async () => {
      mockAuthForOrders();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({
          status: 'payment_received',
          accepted_at: new Date('2025-01-15T10:05:00Z'),
          completed_at: new Date('2025-01-15T10:20:00Z'),
          payment_received_at: new Date('2025-01-15T10:30:00Z'),
        })],
      });

      const res = await supertest(app)
        .post(`/api/owner/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
      expect(res.body.error.message).toContain('paid');
    });

    it('should reject cancellation of already cancelled order', async () => {
      mockAuthForOrders();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({ status: 'cancelled', cancelled_at: new Date('2025-01-15T10:02:00Z') })],
      });

      const res = await supertest(app)
        .post(`/api/owner/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('should reject transition from payment_received (terminal state)', async () => {
      mockAuthForOrders();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [makeOrderRow({
          status: 'payment_received',
          payment_received_at: new Date('2025-01-15T10:30:00Z'),
        })],
      });

      const res = await supertest(app)
        .patch(`/api/owner/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('should return 404 for non-existent order', async () => {
      mockAuthForOrders();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await supertest(app)
        .patch(`/api/owner/orders/nonexistent-id/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Earnings summary only counts payment_received orders', () => {
    it('should return summary with only payment_received totals', async () => {
      mockAuthForEarnings();
      // getRestaurantIdForOwner
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      // getMonthlySummary query — the SQL filters on status='payment_received'
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total_orders: 3, total_revenue: '1350.00' }],
      });

      const res = await supertest(app)
        .get('/api/owner/earnings/summary?month=2025-01')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalOrders).toBe(3);
      expect(res.body.data.totalRevenue).toBe('1350.00');
    });

    it('should return zero when no payment_received orders exist', async () => {
      mockAuthForEarnings();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total_orders: 0, total_revenue: '0' }],
      });

      const res = await supertest(app)
        .get('/api/owner/earnings/summary?month=2025-02')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalOrders).toBe(0);
      expect(res.body.data.totalRevenue).toBe('0');
    });
  });

  describe('Pagination for order history', () => {
    it('should return paginated history with default page size', async () => {
      mockAuthForEarnings();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      // count query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total: 25 }],
      });
      // paginated orders query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: Array.from({ length: 20 }, (_, i) => ({
          id: `order-${i + 1}`,
          order_ref: `ORD-${String(i + 1).padStart(6, '0')}`,
          status: 'payment_received',
          total: '100.00',
          table_display_name: `Table ${i + 1}`,
          created_at: new Date('2025-01-15T10:00:00Z'),
          accepted_at: new Date('2025-01-15T10:05:00Z'),
          completed_at: new Date('2025-01-15T10:20:00Z'),
          payment_received_at: new Date('2025-01-15T10:30:00Z'),
          cancelled_at: null,
        })),
      });

      const res = await supertest(app)
        .get('/api/owner/earnings/history?page=1')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toHaveLength(20);
      expect(res.body.data.total).toBe(25);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.pageSize).toBe(20);
    });

    it('should return second page with remaining items', async () => {
      mockAuthForEarnings();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      // count query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total: 25 }],
      });
      // paginated orders query (page 2 → 5 remaining items)
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: Array.from({ length: 5 }, (_, i) => ({
          id: `order-${i + 21}`,
          order_ref: `ORD-${String(i + 21).padStart(6, '0')}`,
          status: 'payment_received',
          total: '75.00',
          table_display_name: `Table ${i + 1}`,
          created_at: new Date('2025-01-14T10:00:00Z'),
          accepted_at: new Date('2025-01-14T10:05:00Z'),
          completed_at: new Date('2025-01-14T10:20:00Z'),
          payment_received_at: new Date('2025-01-14T10:30:00Z'),
          cancelled_at: null,
        })),
      });

      const res = await supertest(app)
        .get('/api/owner/earnings/history?page=2&pageSize=20')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toHaveLength(5);
      expect(res.body.data.total).toBe(25);
      expect(res.body.data.page).toBe(2);
      expect(res.body.data.pageSize).toBe(20);
    });

    it('should filter history by status', async () => {
      mockAuthForEarnings();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: restaurantId }] });
      // count query (filtered by status=payment_received)
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total: 10 }],
      });
      // paginated orders query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: Array.from({ length: 10 }, (_, i) => ({
          id: `order-paid-${i + 1}`,
          order_ref: `ORD-PAID${String(i + 1).padStart(2, '0')}`,
          status: 'payment_received',
          total: '200.00',
          table_display_name: 'Table 1',
          created_at: new Date('2025-01-15T10:00:00Z'),
          accepted_at: new Date('2025-01-15T10:05:00Z'),
          completed_at: new Date('2025-01-15T10:20:00Z'),
          payment_received_at: new Date('2025-01-15T10:30:00Z'),
          cancelled_at: null,
        })),
      });

      const res = await supertest(app)
        .get('/api/owner/earnings/history?status=payment_received&page=1&pageSize=20')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toHaveLength(10);
      expect(res.body.data.total).toBe(10);
      // All returned orders should have payment_received status
      for (const order of res.body.data.orders) {
        expect(order.status).toBe('payment_received');
      }
    });
  });
});
