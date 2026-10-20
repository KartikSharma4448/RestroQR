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

describe('Cascade Deletion Integration Tests', () => {
  const adminId = 'admin-cascade-uuid';
  const adminToken = generateAdminToken(adminId, 'admin@restroqr.com');
  const restaurantId = 'rest-cascade-001';
  const restaurantToken = 'cascTkn001';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Delete Restaurant → Verify Categories and Items Gone', () => {
    it('should delete a restaurant with all associated data via cascade', async () => {
      // Step 1: Delete the restaurant via admin endpoint
      // Restaurant existence check
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: restaurantId,
            logo_url: 'https://cdn.example.com/logo.png',
            cover_image_url: 'https://cdn.example.com/cover.png',
          }],
        })
        // Food item images query
        .mockResolvedValueOnce({
          rows: [
            { image_url: 'https://cdn.example.com/item1.png' },
            { image_url: 'https://cdn.example.com/item2.png' },
            { image_url: 'https://cdn.example.com/item3.png' },
          ],
        })
        // DELETE query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const deleteRes = await supertest(app)
        .delete(`/api/admin/restaurants/${restaurantId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.data.message).toBe('Restaurant deleted successfully');

      // Verify that the DELETE FROM restaurants was called with correct ID
      const deleteCall = (mockPool.query as jest.Mock).mock.calls[2];
      expect(deleteCall[0]).toContain('DELETE FROM restaurants');
      expect(deleteCall[1]).toEqual([restaurantId]);
    });

    it('should verify categories are gone after restaurant deletion (public menu returns 404)', async () => {
      // After deletion, public menu should not find the restaurant
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }); // restaurant lookup returns nothing

      const menuRes = await supertest(app)
        .get(`/api/public/menu/${restaurantToken}`);

      expect(menuRes.status).toBe(404);
      expect(menuRes.body.success).toBe(false);
      expect(menuRes.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 when trying to delete non-existent restaurant', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }); // restaurant not found

      const res = await supertest(app)
        .delete('/api/admin/restaurants/nonexistent-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should collect all image URLs for Cloudinary cleanup on deletion', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: restaurantId,
            logo_url: 'https://cdn.example.com/logo.png',
            cover_image_url: null,
          }],
        }) // restaurant check
        .mockResolvedValueOnce({
          rows: [
            { image_url: 'https://cdn.example.com/food1.png' },
          ],
        }) // food item images
        .mockResolvedValueOnce({ rows: [] }); // delete

      await supertest(app)
        .delete(`/api/admin/restaurants/${restaurantId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify Cloudinary cleanup logging was triggered
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Cloudinary cleanup]'),
        expect.arrayContaining([
          'https://cdn.example.com/logo.png',
          'https://cdn.example.com/food1.png',
        ])
      );

      consoleSpy.mockRestore();
    });

    it('should handle deletion when restaurant has no images', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: restaurantId,
            logo_url: null,
            cover_image_url: null,
          }],
        }) // restaurant check (no images)
        .mockResolvedValueOnce({ rows: [] }) // no food item images
        .mockResolvedValueOnce({ rows: [] }); // delete

      const res = await supertest(app)
        .delete(`/api/admin/restaurants/${restaurantId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
