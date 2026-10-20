import supertest from 'supertest';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mockedhashvalue'),
  compare: jest.fn(),
}));

// Mock nanoid
jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'xYz1234567',
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

describe('Owner Integration Tests — Full request-response cycle', () => {
  const ownerId = 'owner-001-uuid';
  const ownerToken = generateOwnerToken(ownerId, 'owner@test.com');
  const restaurantId = 'rest-owner-001';
  const restaurantToken = 'xYz1234567';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to mock the auth middleware's owner status check.
   * Since multiple `app.use('/api/owner', authenticate, ...)` are registered,
   * Express runs authenticate for each unmatched router before reaching the correct one.
   *
   * Route order: ownerRestaurantRoutes → ownerCategoryRoutes → ownerQrRoutes → ownerItemRoutes
   * - /restaurant routes: 1 auth call
   * - /categories routes: 2 auth calls (restaurant router doesn't match first)
   * - /qr routes: 3 auth calls
   * - /items routes: 4 auth calls
   */
  function mockAuthForRoute(route: 'restaurant' | 'categories' | 'qr' | 'items') {
    const authCallCounts = { restaurant: 1, categories: 2, qr: 3, items: 4 };
    const count = authCallCounts[route];
    for (let i = 0; i < count; i++) {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ status: 'active' }],
      });
    }
  }

  describe('Create Profile → Create Categories → Create Items → Public Menu Serves Data', () => {
    it('should create a restaurant profile', async () => {
      mockAuthForRoute('restaurant');

      // Check for existing restaurant (1:1 constraint)
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // Token uniqueness check
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // Insert restaurant
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: restaurantId,
          owner_id: ownerId,
          name: 'My Restaurant',
          address: '123 Main St',
          phone: '5551234567',
          logo_url: null,
          cover_image_url: null,
          restaurant_token: restaurantToken,
          status: 'active',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        }],
      });

      const res = await supertest(app)
        .post('/api/owner/restaurant')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'My Restaurant',
          address: '123 Main St',
          phone: '5551234567',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.restaurant.name).toBe('My Restaurant');
      expect(res.body.data.restaurant.restaurantToken).toBe(restaurantToken);
      expect(res.body.data.restaurant.status).toBe('active');
    });

    it('should create a category', async () => {
      mockAuthForRoute('categories');

      (mockPool.query as jest.Mock)
        // getRestaurantIdForOwner
        .mockResolvedValueOnce({ rows: [{ id: restaurantId }] })
        // Case-insensitive uniqueness check
        .mockResolvedValueOnce({ rows: [] })
        // Max display_order
        .mockResolvedValueOnce({ rows: [{ max_order: 0 }] })
        // Insert category
        .mockResolvedValueOnce({
          rows: [{
            id: 'cat-001',
            name: 'Starters',
            display_order: 1,
            created_at: new Date('2024-01-02'),
            updated_at: new Date('2024-01-02'),
          }],
        });

      const res = await supertest(app)
        .post('/api/owner/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Starters' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category.name).toBe('Starters');
      expect(res.body.data.category.displayOrder).toBe(1);
    });

    it('should create a food item', async () => {
      mockAuthForRoute('items');

      (mockPool.query as jest.Mock)
        // getRestaurantIdForOwner
        .mockResolvedValueOnce({ rows: [{ id: restaurantId }] })
        // verifyCategoryOwnership
        .mockResolvedValueOnce({ rows: [{ id: 'cat-001' }] })
        // Insert food item
        .mockResolvedValueOnce({
          rows: [{
            id: 'item-001',
            category_id: 'cat-001',
            restaurant_id: restaurantId,
            name: 'Tomato Soup',
            description: 'Fresh tomato soup',
            price: '5.99',
            image_url: null,
            badge: 'veg',
            is_available: true,
            created_at: new Date('2024-01-03'),
            updated_at: new Date('2024-01-03'),
          }],
        });

      const res = await supertest(app)
        .post('/api/owner/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          categoryId: 'cat-001',
          name: 'Tomato Soup',
          description: 'Fresh tomato soup',
          price: 5.99,
          badge: 'veg',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.item.name).toBe('Tomato Soup');
      expect(res.body.data.item.badge).toBe('veg');
      expect(res.body.data.item.isAvailable).toBe(true);
    });

    it('should serve the complete menu on public endpoint', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: restaurantId,
            name: 'My Restaurant',
            logo_url: 'https://cdn.example.com/logo.png',
            cover_image_url: null,
            status: 'active',
          }],
        }) // restaurant lookup by token
        .mockResolvedValueOnce({
          rows: [
            { id: 'cat-001', name: 'Starters', display_order: 1 },
            { id: 'cat-002', name: 'Mains', display_order: 2 },
          ],
        }) // categories
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'item-001',
              category_id: 'cat-001',
              name: 'Tomato Soup',
              description: 'Fresh tomato soup',
              price: '5.99',
              image_url: null,
              badge: 'veg',
              is_available: true,
            },
            {
              id: 'item-002',
              category_id: 'cat-002',
              name: 'Grilled Chicken',
              description: 'Grilled with herbs',
              price: '15.99',
              image_url: 'https://cdn.example.com/chicken.jpg',
              badge: 'non_veg',
              is_available: true,
            },
          ],
        }); // food items

      const res = await supertest(app)
        .get(`/api/public/menu/${restaurantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.restaurant.name).toBe('My Restaurant');
      expect(res.body.data.restaurant.logoUrl).toBe('https://cdn.example.com/logo.png');
      expect(res.body.data.categories).toHaveLength(2);
      expect(res.body.data.categories[0].name).toBe('Starters');
      expect(res.body.data.categories[0].items[0].name).toBe('Tomato Soup');
      expect(res.body.data.categories[1].name).toBe('Mains');
      expect(res.body.data.categories[1].items[0].name).toBe('Grilled Chicken');
    });
  });

  describe('Validation Errors', () => {
    it('should reject restaurant creation with missing required fields', async () => {
      mockAuthForRoute('restaurant');

      const res = await supertest(app)
        .post('/api/owner/restaurant')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: '' }); // missing address and phone

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'name' }),
          expect.objectContaining({ field: 'address' }),
          expect.objectContaining({ field: 'phone' }),
        ])
      );
    });

    it('should reject food item creation with invalid price', async () => {
      mockAuthForRoute('items');

      // getRestaurantIdForOwner
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: restaurantId }],
      });

      const res = await supertest(app)
        .post('/api/owner/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          categoryId: 'cat-001',
          name: 'Invalid Item',
          price: -5,
          badge: 'veg',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'price' }),
        ])
      );
    });

    it('should reject food item with invalid badge value', async () => {
      mockAuthForRoute('items');

      // getRestaurantIdForOwner
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: restaurantId }],
      });

      const res = await supertest(app)
        .post('/api/owner/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          categoryId: 'cat-001',
          name: 'Test Item',
          price: 9.99,
          badge: 'halal', // invalid
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'badge' }),
        ])
      );
    });
  });
});
