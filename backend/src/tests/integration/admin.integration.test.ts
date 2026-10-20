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
import { generateAdminToken } from '../helpers/auth';

const mockPool = pool as jest.Mocked<typeof pool>;

describe('Admin Integration Tests — Full request-response cycle', () => {
  const adminId = 'admin-001-uuid';
  const adminToken = generateAdminToken(adminId, 'admin@restroqr.com');

  const restaurantId = 'rest-001-uuid';
  const restaurantToken = 'tknABCDE01';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('List Restaurants → Disable → Verify Public Menu Blocked → Re-enable → Verify Restored', () => {
    it('should list restaurants with pagination', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // count query
        .mockResolvedValueOnce({
          rows: [
            {
              id: restaurantId,
              name: 'Restaurant Alpha',
              owner_name: 'Owner A',
              status: 'active',
              created_at: '2024-01-01T00:00:00Z',
            },
            {
              id: 'rest-002-uuid',
              name: 'Restaurant Beta',
              owner_name: 'Owner B',
              status: 'active',
              created_at: '2024-01-02T00:00:00Z',
            },
          ],
        }); // data query

      const res = await supertest(app)
        .get('/api/admin/restaurants?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.restaurants).toHaveLength(2);
      expect(res.body.data.pagination.total).toBe(2);
      expect(res.body.data.pagination.page).toBe(1);
    });

    it('should disable a restaurant', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ id: restaurantId, status: 'disabled' }],
        }); // updateRestaurantStatus

      const res = await supertest(app)
        .patch(`/api/admin/restaurants/${restaurantId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'disabled' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.restaurant.status).toBe('disabled');
    });

    it('should block public menu access for disabled restaurant', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: restaurantId,
            name: 'Restaurant Alpha',
            logo_url: null,
            cover_image_url: null,
            status: 'disabled',
          }],
        }); // restaurant lookup by token

      const res = await supertest(app)
        .get(`/api/public/menu/${restaurantToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Menu not found');
      // Verify no internal data leakage
      expect(res.body.error.message).not.toContain('disabled');
      expect(res.body.error.message).not.toContain(restaurantId);
    });

    it('should re-enable a restaurant', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ id: restaurantId, status: 'active' }],
        }); // updateRestaurantStatus

      const res = await supertest(app)
        .patch(`/api/admin/restaurants/${restaurantId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.restaurant.status).toBe('active');
    });

    it('should restore public menu access for re-enabled restaurant', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: restaurantId,
            name: 'Restaurant Alpha',
            logo_url: null,
            cover_image_url: null,
            status: 'active',
          }],
        }) // restaurant lookup by token
        .mockResolvedValueOnce({
          rows: [
            { id: 'cat-1', name: 'Starters', display_order: 1 },
          ],
        }) // categories query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'item-1',
              category_id: 'cat-1',
              name: 'Soup',
              description: 'Tomato soup',
              price: '5.99',
              image_url: null,
              badge: 'veg',
              is_available: true,
            },
          ],
        }); // food items query

      const res = await supertest(app)
        .get(`/api/public/menu/${restaurantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.restaurant.name).toBe('Restaurant Alpha');
      expect(res.body.data.categories).toHaveLength(1);
      expect(res.body.data.categories[0].items).toHaveLength(1);
      expect(res.body.data.categories[0].items[0].name).toBe('Soup');
    });
  });

  describe('Admin Authentication Required', () => {
    it('should reject unauthenticated requests to admin routes', async () => {
      const res = await supertest(app)
        .get('/api/admin/restaurants');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
    });
  });
});
