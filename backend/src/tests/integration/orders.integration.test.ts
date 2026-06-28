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
process.env.TABLE_TOKEN_SECRET = 'test-secret-for-integration-tests';
process.env.NODE_ENV = 'test';

// Mock the database pool
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

// Mock tableService.decryptTableToken for controlled token handling
jest.mock('../../services/tableService', () => ({
  ...jest.requireActual('../../services/tableService'),
  decryptTableToken: jest.fn(),
}));

// Mock notificationService to prevent real FCM calls
jest.mock('../../services/notificationService', () => ({
  sendOrderNotification: jest.fn().mockResolvedValue(undefined),
  registerFcmToken: jest.fn().mockResolvedValue(undefined),
  unregisterFcmToken: jest.fn().mockResolvedValue(undefined),
  buildOrderNotificationPayload: jest.fn(),
}));

import app from '../../index';
import pool from '../../config/database';
import { decryptTableToken } from '../../services/tableService';

const mockPool = pool as jest.Mocked<typeof pool>;
const mockDecryptTableToken = decryptTableToken as jest.MockedFunction<typeof decryptTableToken>;

describe('Orders Integration Tests — Order Placement Flow', () => {
  const restaurantId = 'rest-001-uuid';
  const tableId = 'table-001-uuid';
  const validTableToken = 'valid-encrypted-table-token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-end: Place Order → Verify Confirmation', () => {
    it('should successfully place an order and return confirmation', async () => {
      // Mock decryptTableToken to return valid restaurant/table IDs
      mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

      // Mock DB client for transaction
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

      // Mock pool.query calls for order validation:
      // 1. Validate restaurant exists and qr_mode is 'multi'
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ id: restaurantId, qr_mode: 'multi' }],
        })
        // 2. Validate table exists
        .mockResolvedValueOnce({
          rows: [{ id: tableId }],
        })
        // 3. Fetch food items
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'item-001',
              name: 'Butter Chicken',
              price: '200.00',
              is_available: true,
              restaurant_id: restaurantId,
            },
            {
              id: 'item-002',
              name: 'Naan',
              price: '50.00',
              is_available: true,
              restaurant_id: restaurantId,
            },
          ],
        })
        // 4. Fire-and-forget notification: table display name lookup
        .mockResolvedValueOnce({
          rows: [{ display_name: 'Table 5' }],
        });

      // Mock transaction client queries:
      // 1. Check order_ref uniqueness
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // order_ref uniqueness check
        // 2. Insert order
        .mockResolvedValueOnce({
          rows: [{
            id: 'order-001-uuid',
            restaurant_id: restaurantId,
            table_id: tableId,
            order_ref: 'ORD-ABC123',
            status: 'pending',
            total: '450.00',
            created_at: new Date('2025-01-15T10:00:00Z'),
            accepted_at: null,
            completed_at: null,
            payment_received_at: null,
            cancelled_at: null,
            updated_at: new Date('2025-01-15T10:00:00Z'),
          }],
        })
        // 3. Insert order_item 1 (Butter Chicken x2)
        .mockResolvedValueOnce({
          rows: [{
            id: 'oi-001',
            order_id: 'order-001-uuid',
            food_item_id: 'item-001',
            item_name: 'Butter Chicken',
            item_price: '200.00',
            quantity: 2,
            created_at: new Date('2025-01-15T10:00:00Z'),
          }],
        })
        // 4. Insert order_item 2 (Naan x1)
        .mockResolvedValueOnce({
          rows: [{
            id: 'oi-002',
            order_id: 'order-001-uuid',
            food_item_id: 'item-002',
            item_name: 'Naan',
            item_price: '50.00',
            quantity: 1,
            created_at: new Date('2025-01-15T10:00:00Z'),
          }],
        })
        .mockResolvedValueOnce(undefined); // COMMIT

      const res = await supertest(app)
        .post('/api/public/orders')
        .send({
          tableToken: validTableToken,
          items: [
            { itemId: 'item-001', quantity: 2 },
            { itemId: 'item-002', quantity: 1 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderRef).toBeDefined();
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.total).toBe('450.00');
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.items[0]).toEqual({
        name: 'Butter Chicken',
        quantity: 2,
        price: '200.00',
      });
      expect(res.body.data.items[1]).toEqual({
        name: 'Naan',
        quantity: 1,
        price: '50.00',
      });
    });
  });

  describe('Error Cases', () => {
    it('should return 404 for invalid table token', async () => {
      // Mock decryptTableToken to throw NotFoundError (simulating invalid token)
      const { NotFoundError } = jest.requireActual('../../errors');
      mockDecryptTableToken.mockImplementation(() => {
        throw new NotFoundError('Menu not found');
      });

      const res = await supertest(app)
        .post('/api/public/orders')
        .send({
          tableToken: 'invalid-garbage-token',
          items: [{ itemId: 'item-001', quantity: 1 }],
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Menu not found');
      // Ensure no internal details leaked
      expect(res.body.error.message).not.toContain('decrypt');
      expect(res.body.error.message).not.toContain('token');
    });

    it('should return 400 for unavailable items', async () => {
      mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

      (mockPool.query as jest.Mock)
        // 1. Restaurant exists with multi mode
        .mockResolvedValueOnce({
          rows: [{ id: restaurantId, qr_mode: 'multi' }],
        })
        // 2. Table exists
        .mockResolvedValueOnce({
          rows: [{ id: tableId }],
        })
        // 3. Fetch food items — one is unavailable
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'item-001',
              name: 'Butter Chicken',
              price: '200.00',
              is_available: false,
              restaurant_id: restaurantId,
            },
          ],
        });

      const res = await supertest(app)
        .post('/api/public/orders')
        .send({
          tableToken: validTableToken,
          items: [{ itemId: 'item-001', quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ITEMS_UNAVAILABLE');
      expect(res.body.error.message).toContain('Butter Chicken');
    });

    it('should return 400 for empty items array', async () => {
      const res = await supertest(app)
        .post('/api/public/orders')
        .send({
          tableToken: validTableToken,
          items: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('At least one item is required');
    });

    it('should return 400 for invalid quantity (zero)', async () => {
      mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

      const res = await supertest(app)
        .post('/api/public/orders')
        .send({
          tableToken: validTableToken,
          items: [{ itemId: 'item-001', quantity: 0 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'quantity', message: 'Quantity must be at least 1' }),
        ])
      );
    });

    it('should return 400 for items not belonging to the restaurant', async () => {
      mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

      (mockPool.query as jest.Mock)
        // 1. Restaurant exists with multi mode
        .mockResolvedValueOnce({
          rows: [{ id: restaurantId, qr_mode: 'multi' }],
        })
        // 2. Table exists
        .mockResolvedValueOnce({
          rows: [{ id: tableId }],
        })
        // 3. Fetch food items — item belongs to different restaurant
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'item-001',
              name: 'Butter Chicken',
              price: '200.00',
              is_available: true,
              restaurant_id: 'different-restaurant-uuid',
            },
          ],
        });

      const res = await supertest(app)
        .post('/api/public/orders')
        .send({
          tableToken: validTableToken,
          items: [{ itemId: 'item-001', quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Items not found');
    });

    it('should return 404 when restaurant qr_mode is single', async () => {
      mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

      (mockPool.query as jest.Mock)
        // Restaurant exists but qr_mode is 'single'
        .mockResolvedValueOnce({
          rows: [{ id: restaurantId, qr_mode: 'single' }],
        });

      const res = await supertest(app)
        .post('/api/public/orders')
        .send({
          tableToken: validTableToken,
          items: [{ itemId: 'item-001', quantity: 1 }],
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Menu not found');
    });
  });

  describe('Multiple Orders from Same Table', () => {
    it('should allow placing multiple orders from the same table', async () => {
      mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

      // Helper to set up mocks for a successful order
      const setupOrderMocks = (orderNum: number) => {
        const mockClient = {
          query: jest.fn(),
          release: jest.fn(),
        };
        (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

        (mockPool.query as jest.Mock)
          // 1. Restaurant exists with multi mode
          .mockResolvedValueOnce({
            rows: [{ id: restaurantId, qr_mode: 'multi' }],
          })
          // 2. Table exists
          .mockResolvedValueOnce({
            rows: [{ id: tableId }],
          })
          // 3. Fetch food items
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'item-001',
                name: 'Butter Chicken',
                price: '200.00',
                is_available: true,
                restaurant_id: restaurantId,
              },
            ],
          })
          // 4. Fire-and-forget notification lookup
          .mockResolvedValueOnce({
            rows: [{ display_name: 'Table 5' }],
          });

        // Mock transaction client queries
        mockClient.query
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // order_ref uniqueness check
          .mockResolvedValueOnce({
            rows: [{
              id: `order-00${orderNum}-uuid`,
              restaurant_id: restaurantId,
              table_id: tableId,
              order_ref: `ORD-REF00${orderNum}`,
              status: 'pending',
              total: '200.00',
              created_at: new Date('2025-01-15T10:00:00Z'),
              accepted_at: null,
              completed_at: null,
              payment_received_at: null,
              cancelled_at: null,
              updated_at: new Date('2025-01-15T10:00:00Z'),
            }],
          }) // Insert order
          .mockResolvedValueOnce({
            rows: [{
              id: `oi-00${orderNum}`,
              order_id: `order-00${orderNum}-uuid`,
              food_item_id: 'item-001',
              item_name: 'Butter Chicken',
              item_price: '200.00',
              quantity: 1,
              created_at: new Date('2025-01-15T10:00:00Z'),
            }],
          }) // Insert order_item
          .mockResolvedValueOnce(undefined); // COMMIT
      };

      // Place first order
      setupOrderMocks(1);
      const res1 = await supertest(app)
        .post('/api/public/orders')
        .send({
          tableToken: validTableToken,
          items: [{ itemId: 'item-001', quantity: 1 }],
        });

      expect(res1.status).toBe(201);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.orderRef).toBeDefined();

      // Clear mocks for second order
      jest.clearAllMocks();
      mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

      // Place second order from same table
      setupOrderMocks(2);
      const res2 = await supertest(app)
        .post('/api/public/orders')
        .send({
          tableToken: validTableToken,
          items: [{ itemId: 'item-001', quantity: 1 }],
        });

      expect(res2.status).toBe(201);
      expect(res2.body.success).toBe(true);
      expect(res2.body.data.orderRef).toBeDefined();

      // Both orders should succeed independently
      expect(res1.body.data.status).toBe('pending');
      expect(res2.body.data.status).toBe('pending');
    });
  });
});
