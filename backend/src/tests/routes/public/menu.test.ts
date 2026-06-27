import { getPublicMenu } from '../../../services/publicMenuService';
import { NotFoundError } from '../../../errors';
import pool from '../../../config/database';

// Mock the database pool
jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

const mockPool = pool as jest.Mocked<typeof pool>;

describe('GET /api/public/menu/:token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Error response uniformity (Security: 12.1, 12.5, 12.6)', () => {
    it('should return NOT_FOUND with generic message for invalid token format', async () => {
      await expect(getPublicMenu('!!invalid!!')).rejects.toThrow(NotFoundError);
      await expect(getPublicMenu('!!invalid!!')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Menu not found',
      });
      // Should NOT have queried the database at all
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND with generic message for non-existent token', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(getPublicMenu('abcdefghij')).rejects.toThrow(NotFoundError);
      await expect(getPublicMenu('abcdefghij')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Menu not found',
      });

      (mockPool.query as jest.Mock).mockReset();
    });

    it('should return NOT_FOUND with generic message for disabled restaurant', async () => {
      const disabledRow = {
        id: 'restaurant-uuid',
        name: 'Disabled Restaurant',
        logo_url: null,
        cover_image_url: null,
        status: 'disabled',
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [disabledRow] });
      await expect(getPublicMenu('validToken1')).rejects.toThrow(NotFoundError);

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [disabledRow] });
      await expect(getPublicMenu('validToken1')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Menu not found',
      });
    });

    it('should return IDENTICAL error for all three failure cases', async () => {
      // Case 1: Invalid format
      let error1: NotFoundError | null = null;
      try {
        await getPublicMenu('$bad$');
      } catch (e) {
        error1 = e as NotFoundError;
      }

      // Case 2: Non-existent token
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      let error2: NotFoundError | null = null;
      try {
        await getPublicMenu('nonExist123');
      } catch (e) {
        error2 = e as NotFoundError;
      }

      // Case 3: Disabled restaurant
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'uuid-123',
          name: 'Test',
          logo_url: null,
          cover_image_url: null,
          status: 'disabled',
        }],
      });
      let error3: NotFoundError | null = null;
      try {
        await getPublicMenu('disabledTkn');
      } catch (e) {
        error3 = e as NotFoundError;
      }

      // All three must be identical
      expect(error1).not.toBeNull();
      expect(error2).not.toBeNull();
      expect(error3).not.toBeNull();
      expect(error1!.statusCode).toBe(error2!.statusCode);
      expect(error2!.statusCode).toBe(error3!.statusCode);
      expect(error1!.code).toBe(error2!.code);
      expect(error2!.code).toBe(error3!.code);
      expect(error1!.message).toBe(error2!.message);
      expect(error2!.message).toBe(error3!.message);
      expect(error1!.statusCode).toBe(404);
      expect(error1!.code).toBe('NOT_FOUND');
      expect(error1!.message).toBe('Menu not found');
    });

    it('should not leak UUIDs, DB field names, or stack traces in error', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      try {
        await getPublicMenu('tokenXYZ12');
      } catch (e) {
        const err = e as NotFoundError;
        expect(err.message).not.toContain('uuid');
        expect(err.message).not.toContain('restaurant_token');
        expect(err.message).not.toContain('SELECT');
        expect(err.message).not.toContain('database');
        expect(err.message).toBe('Menu not found');
      }
    });

    it('should reject empty string token', async () => {
      await expect(getPublicMenu('')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Menu not found',
      });
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should reject token shorter than 8 characters', async () => {
      await expect(getPublicMenu('short')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Menu not found',
      });
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should reject token with special characters', async () => {
      await expect(getPublicMenu('abc-def-ghi')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Menu not found',
      });
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe('Successful menu retrieval', () => {
    it('should return restaurant info with categories and items', async () => {
      const restaurantId = 'rest-uuid-001';

      // Restaurant lookup
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: restaurantId,
          name: 'Tasty Bites',
          logo_url: 'https://cdn.example.com/logo.png',
          cover_image_url: 'https://cdn.example.com/cover.png',
          status: 'active',
        }],
      });

      // Categories query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { id: 'cat-1', name: 'Starters', display_order: 0 },
          { id: 'cat-2', name: 'Main Course', display_order: 1 },
        ],
      });

      // Food items query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'item-1',
            category_id: 'cat-1',
            name: 'Soup',
            description: 'Hot tomato soup',
            price: '150.00',
            image_url: 'https://cdn.example.com/soup.png',
            badge: 'veg',
            is_available: true,
          },
          {
            id: 'item-2',
            category_id: 'cat-2',
            name: 'Grilled Chicken',
            description: 'Spicy grilled chicken',
            price: '350.50',
            image_url: null,
            badge: 'non_veg',
            is_available: true,
          },
          {
            id: 'item-3',
            category_id: 'cat-1',
            name: 'Spring Rolls',
            description: null,
            price: '120.00',
            image_url: null,
            badge: 'veg',
            is_available: false,
          },
        ],
      });

      const result = await getPublicMenu('validTkn01');

      expect(result.restaurant).toEqual({
        name: 'Tasty Bites',
        logoUrl: 'https://cdn.example.com/logo.png',
        coverImageUrl: 'https://cdn.example.com/cover.png',
      });

      expect(result.categories).toHaveLength(2);

      // First category: Starters
      expect(result.categories[0].id).toBe('cat-1');
      expect(result.categories[0].name).toBe('Starters');
      expect(result.categories[0].displayOrder).toBe(0);
      expect(result.categories[0].items).toHaveLength(2);
      expect(result.categories[0].items[0]).toEqual({
        id: 'item-1',
        name: 'Soup',
        description: 'Hot tomato soup',
        price: '150.00',
        imageUrl: 'https://cdn.example.com/soup.png',
        badge: 'veg',
        isAvailable: true,
      });

      // Second category: Main Course
      expect(result.categories[1].id).toBe('cat-2');
      expect(result.categories[1].name).toBe('Main Course');
      expect(result.categories[1].displayOrder).toBe(1);
      expect(result.categories[1].items).toHaveLength(1);
    });

    it('should return empty categories array when restaurant has no categories', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'rest-uuid-002',
          name: 'New Restaurant',
          logo_url: null,
          cover_image_url: null,
          status: 'active',
        }],
      });

      // Empty categories
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Empty food items
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await getPublicMenu('emptyRest1');

      expect(result.restaurant.name).toBe('New Restaurant');
      expect(result.restaurant.logoUrl).toBeNull();
      expect(result.restaurant.coverImageUrl).toBeNull();
      expect(result.categories).toEqual([]);
    });

    it('should return categories with empty items array when category has no items', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'rest-uuid-003',
          name: 'Empty Menu',
          logo_url: null,
          cover_image_url: null,
          status: 'active',
        }],
      });

      // One category exists
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'cat-empty', name: 'Beverages', display_order: 0 }],
      });

      // No food items
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await getPublicMenu('emptyItems');

      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].items).toEqual([]);
    });

    it('should format price to 2 decimal places', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'rest-uuid-004',
          name: 'Price Test',
          logo_url: null,
          cover_image_url: null,
          status: 'active',
        }],
      });

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'cat-p', name: 'Items', display_order: 0 }],
      });

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'item-price',
            category_id: 'cat-p',
            name: 'Item',
            description: null,
            price: '250',
            image_url: null,
            badge: 'veg',
            is_available: true,
          },
        ],
      });

      const result = await getPublicMenu('priceTest1');

      expect(result.categories[0].items[0].price).toBe('250.00');
    });

    it('should order categories by display_order', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'rest-uuid-005',
          name: 'Ordered Rest',
          logo_url: null,
          cover_image_url: null,
          status: 'active',
        }],
      });

      // Categories returned in display_order (the DB query uses ORDER BY)
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { id: 'cat-a', name: 'Appetizers', display_order: 0 },
          { id: 'cat-b', name: 'Mains', display_order: 1 },
          { id: 'cat-c', name: 'Desserts', display_order: 2 },
        ],
      });

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await getPublicMenu('orderedTk1');

      expect(result.categories[0].displayOrder).toBe(0);
      expect(result.categories[1].displayOrder).toBe(1);
      expect(result.categories[2].displayOrder).toBe(2);
    });
  });
});
