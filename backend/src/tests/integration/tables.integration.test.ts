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

import app from '../../index';
import pool from '../../config/database';
import { generateOwnerToken } from '../helpers/auth';

const mockPool = pool as jest.Mocked<typeof pool>;

describe('Tables Integration Tests — Full request-response cycle', () => {
  const ownerId = 'owner-001-uuid';
  const ownerToken = generateOwnerToken(ownerId, 'owner@test.com');
  const restaurantId = 'rest-001-uuid';
  const tableId = 'table-001-uuid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to mock the auth middleware's owner status check.
   * The tables route is the 6th owner route registered in index.ts:
   * ownerRestaurantRoutes, ownerCategoryRoutes, ownerQrRoutes, ownerItemRoutes,
   * ownerSettingsRoutes, ownerTableRoutes.
   * Each unmatched router still runs authenticate middleware, so we need 6 status checks.
   */
  function mockAuthForTables() {
    for (let i = 0; i < 6; i++) {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ status: 'active' }],
      });
    }
  }

  describe('Table CRUD Flow: create → list → update → delete', () => {
    it('should create a table successfully', async () => {
      mockAuthForTables();

      (mockPool.query as jest.Mock)
        // getRestaurantIdForOwner
        .mockResolvedValueOnce({ rows: [{ id: restaurantId }] })
        // createTable: check qr_mode
        .mockResolvedValueOnce({ rows: [{ qr_mode: 'multi' }] })
        // createTable: duplicate check
        .mockResolvedValueOnce({ rows: [] })
        // createTable: INSERT
        .mockResolvedValueOnce({
          rows: [{
            id: tableId,
            restaurant_id: restaurantId,
            display_name: 'Table 1',
            table_token: 'temp_placeholder',
            created_at: new Date('2024-01-10'),
            updated_at: new Date('2024-01-10'),
          }],
        })
        // createTable: UPDATE token
        .mockResolvedValueOnce({
          rows: [{
            id: tableId,
            restaurant_id: restaurantId,
            display_name: 'Table 1',
            table_token: 'encrypted-token-abc',
            created_at: new Date('2024-01-10'),
            updated_at: new Date('2024-01-10'),
          }],
        });

      const res = await supertest(app)
        .post('/api/owner/tables')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ displayName: 'Table 1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.table.displayName).toBe('Table 1');
      expect(res.body.data.table.id).toBe(tableId);
    });

    it('should list all tables', async () => {
      mockAuthForTables();

      (mockPool.query as jest.Mock)
        // getRestaurantIdForOwner
        .mockResolvedValueOnce({ rows: [{ id: restaurantId }] })
        // listTables: SELECT
        .mockResolvedValueOnce({
          rows: [
            {
              id: tableId,
              restaurant_id: restaurantId,
              display_name: 'Table 1',
              table_token: 'encrypted-token-abc',
              created_at: new Date('2024-01-10'),
              updated_at: new Date('2024-01-10'),
            },
            {
              id: 'table-002-uuid',
              restaurant_id: restaurantId,
              display_name: 'Table 2',
              table_token: 'encrypted-token-def',
              created_at: new Date('2024-01-11'),
              updated_at: new Date('2024-01-11'),
            },
          ],
        });

      const res = await supertest(app)
        .get('/api/owner/tables')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tables).toHaveLength(2);
      expect(res.body.data.tables[0].displayName).toBe('Table 1');
      expect(res.body.data.tables[1].displayName).toBe('Table 2');
    });

    it('should update a table display name', async () => {
      mockAuthForTables();

      (mockPool.query as jest.Mock)
        // getRestaurantIdForOwner
        .mockResolvedValueOnce({ rows: [{ id: restaurantId }] })
        // updateTable: verify ownership
        .mockResolvedValueOnce({ rows: [{ id: tableId }] })
        // updateTable: duplicate check
        .mockResolvedValueOnce({ rows: [] })
        // updateTable: UPDATE
        .mockResolvedValueOnce({
          rows: [{
            id: tableId,
            restaurant_id: restaurantId,
            display_name: 'VIP Table',
            table_token: 'encrypted-token-abc',
            created_at: new Date('2024-01-10'),
            updated_at: new Date('2024-01-12'),
          }],
        });

      const res = await supertest(app)
        .patch(`/api/owner/tables/${tableId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ displayName: 'VIP Table' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.table.displayName).toBe('VIP Table');
    });

    it('should delete a table', async () => {
      mockAuthForTables();

      (mockPool.query as jest.Mock)
        // getRestaurantIdForOwner
        .mockResolvedValueOnce({ rows: [{ id: restaurantId }] })
        // deleteTable: verify ownership
        .mockResolvedValueOnce({ rows: [{ id: tableId }] })
        // deleteTable: DELETE
        .mockResolvedValueOnce({ rows: [] });

      const res = await supertest(app)
        .delete(`/api/owner/tables/${tableId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Table deleted successfully');
    });
  });

  describe('QR Code PNG Generation', () => {
    it('should return a QR code PNG for a table', async () => {
      mockAuthForTables();

      (mockPool.query as jest.Mock)
        // getRestaurantIdForOwner
        .mockResolvedValueOnce({ rows: [{ id: restaurantId }] })
        // getTableQrUrl: restaurant token lookup
        .mockResolvedValueOnce({ rows: [{ restaurant_token: 'restToken123' }] })
        // getTableQrUrl: table token lookup
        .mockResolvedValueOnce({ rows: [{ table_token: 'encrypted-token-abc' }] });

      const res = await supertest(app)
        .get(`/api/owner/tables/${tableId}/qr`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['content-disposition']).toContain(`table-${tableId}-qr.png`);
      // Verify it returns actual PNG data (PNG magic bytes: 0x89504E47)
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body[0]).toBe(0x89);
      expect(res.body[1]).toBe(0x50);
      expect(res.body[2]).toBe(0x4e);
      expect(res.body[3]).toBe(0x47);
    });
  });

  describe('Error Cases', () => {
    it('should reject table creation when qr_mode is single', async () => {
      mockAuthForTables();

      (mockPool.query as jest.Mock)
        // getRestaurantIdForOwner
        .mockResolvedValueOnce({ rows: [{ id: restaurantId }] })
        // createTable: check qr_mode returns 'single'
        .mockResolvedValueOnce({ rows: [{ qr_mode: 'single' }] });

      const res = await supertest(app)
        .post('/api/owner/tables')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ displayName: 'Table 1' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('QR_MODE_SINGLE');
      expect(res.body.error.message).toBe('Table management requires multi-QR mode');
    });

    it('should reject duplicate display name within same restaurant', async () => {
      mockAuthForTables();

      (mockPool.query as jest.Mock)
        // getRestaurantIdForOwner
        .mockResolvedValueOnce({ rows: [{ id: restaurantId }] })
        // createTable: check qr_mode
        .mockResolvedValueOnce({ rows: [{ qr_mode: 'multi' }] })
        // createTable: duplicate check returns existing table
        .mockResolvedValueOnce({ rows: [{ id: 'existing-table-id' }] });

      const res = await supertest(app)
        .post('/api/owner/tables')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ displayName: 'Table 1' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toBe('A table with this name already exists');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await supertest(app)
        .get('/api/owner/tables');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
    });
  });
});
