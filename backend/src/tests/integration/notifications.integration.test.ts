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

// Mock firebase-admin
const mockSend = jest.fn();
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn().mockReturnValue({}),
  getApps: jest.fn().mockReturnValue([]),
  applicationDefault: jest.fn(),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn().mockReturnValue({
    send: mockSend,
  }),
}));

// Mock tableService decryptTableToken for order creation tests
jest.mock('../../services/tableService', () => ({
  ...jest.requireActual('../../services/tableService'),
  decryptTableToken: jest.fn(),
}));

import app from '../../index';
import pool from '../../config/database';
import { generateOwnerToken } from '../helpers/auth';
import { decryptTableToken } from '../../services/tableService';

const mockPool = pool as jest.Mocked<typeof pool>;
const mockDecryptTableToken = decryptTableToken as jest.Mock;

describe('Notifications Integration Tests', () => {
  const ownerId = 'owner-notif-001';
  const ownerToken = generateOwnerToken(ownerId, 'owner@restaurant.com');
  const restaurantId = 'rest-notif-001';
  const tableId = 'table-notif-001';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue('message-id-123');
  });

  /**
   * Helper to mock the auth middleware's owner status check.
   * Since multiple `app.use('/api/owner', authenticate, ...)` are registered,
   * Express runs authenticate for each unmatched router before reaching the correct one.
   *
   * Route order in index.ts:
   * 1. ownerRestaurantRoutes
   * 2. ownerCategoryRoutes
   * 3. ownerQrRoutes
   * 4. ownerItemRoutes
   * 5. ownerSettingsRoutes
   * 6. ownerTableRoutes
   * 7. ownerOrdersRoutes
   * 8. ownerEarningsRoutes
   * 9. ownerNotificationRoutes
   *
   * Notifications is 9th, so 9 auth calls are needed.
   */
  function mockAuthForNotifications() {
    for (let i = 0; i < 9; i++) {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ status: 'active' }],
      });
    }
  }

  describe('POST /api/owner/notifications/register', () => {
    /**
     * Validates: Requirement 7.1
     * WHEN the Owner_App is installed, THE Owner_App SHALL register its FCM device token
     * with the Backend_API.
     */
    it('should register an FCM token successfully', async () => {
      mockAuthForNotifications();

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce(undefined) // DELETE existing tokens
          .mockResolvedValueOnce(undefined) // INSERT new token
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

      const res = await supertest(app)
        .post('/api/owner/notifications/register')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ fcmToken: 'fcm-device-token-abc123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('FCM token registered successfully');

      // Verify the transaction calls
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM fcm_tokens WHERE owner_id = $1',
        [ownerId]
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO fcm_tokens (owner_id, token) VALUES ($1, $2)',
        [ownerId, 'fcm-device-token-abc123']
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should reject registration with missing fcmToken', async () => {
      mockAuthForNotifications();

      const res = await supertest(app)
        .post('/api/owner/notifications/register')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with empty fcmToken', async () => {
      mockAuthForNotifications();

      const res = await supertest(app)
        .post('/api/owner/notifications/register')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ fcmToken: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await supertest(app)
        .post('/api/owner/notifications/register')
        .send({ fcmToken: 'some-token' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
    });
  });

  describe('DELETE /api/owner/notifications/unregister', () => {
    /**
     * Validates: Requirement 7.6
     * WHEN an owner logs out, THE Owner_App SHALL unregister the FCM device token
     * from the Backend_API.
     */
    it('should unregister FCM token successfully', async () => {
      mockAuthForNotifications();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await supertest(app)
        .delete('/api/owner/notifications/unregister')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('FCM token unregistered successfully');
    });

    it('should succeed even if no token was registered (idempotent)', async () => {
      mockAuthForNotifications();
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .delete('/api/owner/notifications/unregister')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await supertest(app)
        .delete('/api/owner/notifications/unregister');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
    });
  });

  describe('Notification on Order Creation', () => {
    /**
     * Validates: Requirement 7.2
     * WHEN a new order is placed, THE Notification_Service SHALL send an FCM push
     * notification to the owner's registered device token.
     */
    it('should send FCM notification when order is created', async () => {
      // Mock decryptTableToken to return valid restaurant and table
      mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

      // Mock client for order creation transaction
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // check order_ref uniqueness
          .mockResolvedValueOnce({
            rows: [{
              id: 'order-001',
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
          }) // INSERT order
          .mockResolvedValueOnce({
            rows: [{
              id: 'item-001',
              order_id: 'order-001',
              food_item_id: 'food-001',
              item_name: 'Butter Chicken',
              item_price: '225.00',
              quantity: 2,
              created_at: new Date('2025-01-15T10:00:00Z'),
            }],
          }) // INSERT order_item
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

      // Mock pool.query for the non-transactional queries
      (mockPool.query as jest.Mock)
        // restaurant lookup (qr_mode check)
        .mockResolvedValueOnce({ rows: [{ id: restaurantId, qr_mode: 'multi' }] })
        // table exists check
        .mockResolvedValueOnce({ rows: [{ id: tableId }] })
        // food items lookup
        .mockResolvedValueOnce({
          rows: [{
            id: 'food-001',
            name: 'Butter Chicken',
            price: '225.00',
            is_available: true,
            restaurant_id: restaurantId,
          }],
        })
        // table display_name lookup for notification
        .mockResolvedValueOnce({ rows: [{ display_name: 'Table 5' }] })
        // FCM token lookup via restaurant join
        .mockResolvedValueOnce({ rows: [{ token: 'fcm-owner-token-xyz' }] });

      const res = await supertest(app)
        .post('/api/public/orders')
        .send({
          tableToken: 'valid-encrypted-token',
          items: [{ itemId: 'food-001', quantity: 2 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderRef).toBe('ORD-ABC123');
      expect(res.body.data.total).toBe('450.00');
      expect(res.body.data.status).toBe('pending');

      // Wait for fire-and-forget notification to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify FCM send was called
      expect(mockSend).toHaveBeenCalledWith({
        token: 'fcm-owner-token-xyz',
        notification: {
          title: 'New Order Received',
          body: 'Table: Table 5 — Total: ₹450.00',
        },
        data: {
          tableName: 'Table 5',
          orderTotal: '450.00',
        },
      });
    });

    /**
     * Validates: Requirement 7.5
     * IF the FCM delivery fails, THEN THE Notification_Service SHALL log the failure
     * without blocking the order creation flow.
     */
    it('should not block order creation when FCM notification fails', async () => {
      // Mock decryptTableToken to return valid restaurant and table
      mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

      // Make FCM send fail
      mockSend.mockRejectedValue(new Error('FCM service unavailable'));

      // Mock client for order creation transaction
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // check order_ref uniqueness
          .mockResolvedValueOnce({
            rows: [{
              id: 'order-002',
              restaurant_id: restaurantId,
              table_id: tableId,
              order_ref: 'ORD-DEF456',
              status: 'pending',
              total: '150.00',
              created_at: new Date('2025-01-15T11:00:00Z'),
              accepted_at: null,
              completed_at: null,
              payment_received_at: null,
              cancelled_at: null,
              updated_at: new Date('2025-01-15T11:00:00Z'),
            }],
          }) // INSERT order
          .mockResolvedValueOnce({
            rows: [{
              id: 'item-002',
              order_id: 'order-002',
              food_item_id: 'food-002',
              item_name: 'Naan',
              item_price: '50.00',
              quantity: 3,
              created_at: new Date('2025-01-15T11:00:00Z'),
            }],
          }) // INSERT order_item
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

      // Mock pool.query for the non-transactional queries
      (mockPool.query as jest.Mock)
        // restaurant lookup (qr_mode check)
        .mockResolvedValueOnce({ rows: [{ id: restaurantId, qr_mode: 'multi' }] })
        // table exists check
        .mockResolvedValueOnce({ rows: [{ id: tableId }] })
        // food items lookup
        .mockResolvedValueOnce({
          rows: [{
            id: 'food-002',
            name: 'Naan',
            price: '50.00',
            is_available: true,
            restaurant_id: restaurantId,
          }],
        })
        // table display_name lookup for notification
        .mockResolvedValueOnce({ rows: [{ display_name: 'Table 3' }] })
        // FCM token lookup
        .mockResolvedValueOnce({ rows: [{ token: 'fcm-owner-token-xyz' }] });

      // Suppress console.error from the notification service
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await supertest(app)
        .post('/api/public/orders')
        .send({
          tableToken: 'valid-encrypted-token',
          items: [{ itemId: 'food-002', quantity: 3 }],
        });

      // Order creation should succeed despite notification failure
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderRef).toBe('ORD-DEF456');
      expect(res.body.data.total).toBe('150.00');
      expect(res.body.data.status).toBe('pending');

      // Wait for fire-and-forget notification attempt to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // The FCM send was still attempted
      expect(mockSend).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should still succeed when owner has no FCM token registered', async () => {
      // Mock decryptTableToken
      mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

      // Mock client for order creation transaction
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // check order_ref uniqueness
          .mockResolvedValueOnce({
            rows: [{
              id: 'order-003',
              restaurant_id: restaurantId,
              table_id: tableId,
              order_ref: 'ORD-GHI789',
              status: 'pending',
              total: '100.00',
              created_at: new Date('2025-01-15T12:00:00Z'),
              accepted_at: null,
              completed_at: null,
              payment_received_at: null,
              cancelled_at: null,
              updated_at: new Date('2025-01-15T12:00:00Z'),
            }],
          }) // INSERT order
          .mockResolvedValueOnce({
            rows: [{
              id: 'item-003',
              order_id: 'order-003',
              food_item_id: 'food-003',
              item_name: 'Rice',
              item_price: '100.00',
              quantity: 1,
              created_at: new Date('2025-01-15T12:00:00Z'),
            }],
          }) // INSERT order_item
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

      // Mock pool.query for the non-transactional queries
      (mockPool.query as jest.Mock)
        // restaurant lookup
        .mockResolvedValueOnce({ rows: [{ id: restaurantId, qr_mode: 'multi' }] })
        // table exists check
        .mockResolvedValueOnce({ rows: [{ id: tableId }] })
        // food items lookup
        .mockResolvedValueOnce({
          rows: [{
            id: 'food-003',
            name: 'Rice',
            price: '100.00',
            is_available: true,
            restaurant_id: restaurantId,
          }],
        })
        // table display_name lookup for notification
        .mockResolvedValueOnce({ rows: [{ display_name: 'Table 1' }] })
        // FCM token lookup - owner has no token
        .mockResolvedValueOnce({ rows: [] });

      const res = await supertest(app)
        .post('/api/public/orders')
        .send({
          tableToken: 'valid-encrypted-token',
          items: [{ itemId: 'food-003', quantity: 1 }],
        });

      // Order creation succeeds
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderRef).toBe('ORD-GHI789');

      // Wait for fire-and-forget to settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      // FCM send should NOT have been called since no token was registered
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
