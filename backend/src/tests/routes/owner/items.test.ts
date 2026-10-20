import { ValidationError } from '../../../errors/ValidationError';
import { NotFoundError } from '../../../errors/NotFoundError';

// Mock database pool at the top level
const mockQuery = jest.fn();

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

// Import service after mock
import {
  validateFoodItem,
  verifyCategoryOwnership,
  verifyItemOwnership,
  createFoodItem,
  listFoodItems,
  updateFoodItem,
  deleteFoodItem,
  toggleAvailability,
} from '../../../services/foodItemService';

describe('Food Item Service - Validation', () => {
  describe('validateFoodItem (create mode)', () => {
    it('should validate a valid food item for creation', () => {
      const result = validateFoodItem(
        { name: 'Butter Chicken', price: 250, badge: 'non_veg' },
        true
      );
      expect(result.name).toBe('Butter Chicken');
      expect(result.price).toBe(250);
      expect(result.badge).toBe('non_veg');
    });

    it('should trim name whitespace', () => {
      const result = validateFoodItem(
        { name: '  Paneer Tikka  ', price: 180, badge: 'veg' },
        true
      );
      expect(result.name).toBe('Paneer Tikka');
    });

    it('should accept name with exactly 1 character', () => {
      const result = validateFoodItem({ name: 'A', price: 10, badge: 'veg' }, true);
      expect(result.name).toBe('A');
    });

    it('should accept name with exactly 100 characters', () => {
      const name = 'a'.repeat(100);
      const result = validateFoodItem({ name, price: 10, badge: 'veg' }, true);
      expect(result.name).toBe(name);
    });

    it('should reject name exceeding 100 characters', () => {
      expect(() =>
        validateFoodItem({ name: 'a'.repeat(101), price: 10, badge: 'veg' }, true)
      ).toThrow(ValidationError);
    });

    it('should reject empty name', () => {
      expect(() =>
        validateFoodItem({ name: '', price: 10, badge: 'veg' }, true)
      ).toThrow(ValidationError);
    });

    it('should reject missing name on create', () => {
      expect(() =>
        validateFoodItem({ price: 10, badge: 'veg' }, true)
      ).toThrow(ValidationError);
    });

    it('should accept price at minimum boundary (0.01)', () => {
      const result = validateFoodItem({ name: 'Test', price: 0.01, badge: 'veg' }, true);
      expect(result.price).toBe(0.01);
    });

    it('should accept price at maximum boundary (999999.99)', () => {
      const result = validateFoodItem({ name: 'Test', price: 999999.99, badge: 'veg' }, true);
      expect(result.price).toBe(999999.99);
    });

    it('should reject price below 0.01', () => {
      expect(() =>
        validateFoodItem({ name: 'Test', price: 0, badge: 'veg' }, true)
      ).toThrow(ValidationError);
    });

    it('should reject price above 999999.99', () => {
      expect(() =>
        validateFoodItem({ name: 'Test', price: 1000000, badge: 'veg' }, true)
      ).toThrow(ValidationError);
    });

    it('should reject missing price on create', () => {
      expect(() =>
        validateFoodItem({ name: 'Test', badge: 'veg' }, true)
      ).toThrow(ValidationError);
    });

    it('should reject negative price', () => {
      expect(() =>
        validateFoodItem({ name: 'Test', price: -5, badge: 'veg' }, true)
      ).toThrow(ValidationError);
    });

    it('should accept veg badge', () => {
      const result = validateFoodItem({ name: 'Test', price: 10, badge: 'veg' }, true);
      expect(result.badge).toBe('veg');
    });

    it('should accept non_veg badge', () => {
      const result = validateFoodItem({ name: 'Test', price: 10, badge: 'non_veg' }, true);
      expect(result.badge).toBe('non_veg');
    });

    it('should reject invalid badge value', () => {
      expect(() =>
        validateFoodItem({ name: 'Test', price: 10, badge: 'invalid' }, true)
      ).toThrow(ValidationError);
    });

    it('should reject missing badge on create', () => {
      expect(() =>
        validateFoodItem({ name: 'Test', price: 10 }, true)
      ).toThrow(ValidationError);
    });

    it('should validate optional description (max 500 chars)', () => {
      const result = validateFoodItem(
        { name: 'Test', price: 10, badge: 'veg', description: 'A tasty item' },
        true
      );
      expect(result.description).toBe('A tasty item');
    });

    it('should reject description exceeding 500 characters', () => {
      expect(() =>
        validateFoodItem(
          { name: 'Test', price: 10, badge: 'veg', description: 'a'.repeat(501) },
          true
        )
      ).toThrow(ValidationError);
    });

    it('should allow null description', () => {
      const result = validateFoodItem(
        { name: 'Test', price: 10, badge: 'veg', description: null },
        true
      );
      expect(result.description).toBeNull();
    });

    it('should collect multiple validation errors', () => {
      try {
        validateFoodItem({ name: '', price: -1, badge: 'invalid' }, true);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        const err = e as ValidationError;
        expect(err.details!.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('should parse string price correctly', () => {
      const result = validateFoodItem({ name: 'Test', price: '99.99', badge: 'veg' }, true);
      expect(result.price).toBe(99.99);
    });
  });

  describe('validateFoodItem (update mode)', () => {
    it('should allow partial updates with only name', () => {
      const result = validateFoodItem({ name: 'Updated Name' }, false);
      expect(result.name).toBe('Updated Name');
      expect(result.price).toBeUndefined();
      expect(result.badge).toBeUndefined();
    });

    it('should allow partial updates with only price', () => {
      const result = validateFoodItem({ price: 300 }, false);
      expect(result.price).toBe(300);
      expect(result.name).toBeUndefined();
    });

    it('should not require any fields on update when none provided', () => {
      const result = validateFoodItem({}, false);
      expect(result).toEqual({});
    });

    it('should still validate provided fields on update', () => {
      expect(() => validateFoodItem({ name: '' }, false)).toThrow(ValidationError);
    });
  });
});

describe('Food Item Service - Database Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockFoodItemRow = {
    id: 'item-1',
    category_id: 'cat-1',
    restaurant_id: 'rest-1',
    name: 'Butter Chicken',
    description: 'Creamy chicken curry',
    price: '250.00',
    image_url: 'https://cloudinary.com/img.jpg',
    badge: 'non_veg',
    is_available: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  describe('verifyCategoryOwnership', () => {
    it('should resolve when category belongs to restaurant', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] });
      await expect(verifyCategoryOwnership('cat-1', 'rest-1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundError when category does not belong to restaurant', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(verifyCategoryOwnership('cat-999', 'rest-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('verifyItemOwnership', () => {
    it('should return item row when item belongs to restaurant', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockFoodItemRow] });
      const result = await verifyItemOwnership('item-1', 'rest-1');
      expect(result.id).toBe('item-1');
    });

    it('should throw NotFoundError when item does not belong to restaurant', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(verifyItemOwnership('item-999', 'rest-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createFoodItem', () => {
    it('should create a food item successfully', async () => {
      // verifyCategoryOwnership
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] });
      // INSERT
      mockQuery.mockResolvedValueOnce({ rows: [mockFoodItemRow] });

      const result = await createFoodItem('rest-1', 'cat-1', {
        name: 'Butter Chicken',
        description: 'Creamy chicken curry',
        price: 250,
        badge: 'non_veg',
        imageUrl: 'https://cloudinary.com/img.jpg',
      });

      expect(result.id).toBe('item-1');
      expect(result.name).toBe('Butter Chicken');
      expect(result.badge).toBe('non_veg');
      expect(result.isAvailable).toBe(true);
    });

    it('should throw NotFoundError if category does not belong to restaurant', async () => {
      // verifyCategoryOwnership fails
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        createFoodItem('rest-1', 'cat-999', {
          name: 'Test',
          price: 10,
          badge: 'veg',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should set default null for optional fields', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          ...mockFoodItemRow,
          description: null,
          image_url: null,
        }],
      });

      const result = await createFoodItem('rest-1', 'cat-1', {
        name: 'Simple Item',
        price: 50,
        badge: 'veg',
      });

      expect(result.description).toBeNull();
      expect(result.imageUrl).toBeNull();
    });
  });

  describe('listFoodItems', () => {
    it('should return food items for a category', async () => {
      // verifyCategoryOwnership
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] });
      // SELECT items
      mockQuery.mockResolvedValueOnce({
        rows: [
          mockFoodItemRow,
          { ...mockFoodItemRow, id: 'item-2', name: 'Paneer Tikka', badge: 'veg' },
        ],
      });

      const result = await listFoodItems('cat-1', 'rest-1');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Butter Chicken');
      expect(result[1].name).toBe('Paneer Tikka');
    });

    it('should return empty array when no items exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await listFoodItems('cat-1', 'rest-1');
      expect(result).toEqual([]);
    });

    it('should throw NotFoundError if category does not belong to restaurant', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(listFoodItems('cat-999', 'rest-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateFoodItem', () => {
    it('should update food item with provided fields', async () => {
      // verifyItemOwnership
      mockQuery.mockResolvedValueOnce({ rows: [mockFoodItemRow] });
      // UPDATE
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockFoodItemRow, name: 'Updated Chicken', price: '300.00' }],
      });

      const result = await updateFoodItem('item-1', 'rest-1', {
        name: 'Updated Chicken',
        price: 300,
      });

      expect(result.name).toBe('Updated Chicken');
    });

    it('should throw NotFoundError if item does not belong to restaurant', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(
        updateFoodItem('item-999', 'rest-1', { name: 'Test' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should return current item when no fields to update', async () => {
      // verifyItemOwnership
      mockQuery.mockResolvedValueOnce({ rows: [mockFoodItemRow] });
      // SELECT current item (no update needed)
      mockQuery.mockResolvedValueOnce({ rows: [mockFoodItemRow] });

      const result = await updateFoodItem('item-1', 'rest-1', {});
      expect(result.name).toBe('Butter Chicken');
    });
  });

  describe('deleteFoodItem', () => {
    it('should delete item and return image_url', async () => {
      // verifyItemOwnership
      mockQuery.mockResolvedValueOnce({ rows: [mockFoodItemRow] });
      // DELETE
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const imageUrl = await deleteFoodItem('item-1', 'rest-1');
      expect(imageUrl).toBe('https://cloudinary.com/img.jpg');
    });

    it('should return null image_url when item has no image', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockFoodItemRow, image_url: null }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const imageUrl = await deleteFoodItem('item-1', 'rest-1');
      expect(imageUrl).toBeNull();
    });

    it('should throw NotFoundError if item does not belong to restaurant', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(deleteFoodItem('item-999', 'rest-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('toggleAvailability', () => {
    it('should set availability to false', async () => {
      // verifyItemOwnership
      mockQuery.mockResolvedValueOnce({ rows: [mockFoodItemRow] });
      // UPDATE
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'item-1', is_available: false }],
      });

      const result = await toggleAvailability('item-1', 'rest-1', false);
      expect(result.id).toBe('item-1');
      expect(result.isAvailable).toBe(false);
    });

    it('should set availability to true', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockFoodItemRow, is_available: false }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'item-1', is_available: true }],
      });

      const result = await toggleAvailability('item-1', 'rest-1', true);
      expect(result.isAvailable).toBe(true);
    });

    it('should throw NotFoundError if item does not belong to restaurant', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(toggleAvailability('item-999', 'rest-1', true)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for non-boolean isAvailable', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockFoodItemRow] });
      await expect(
        toggleAvailability('item-1', 'rest-1', 'yes' as unknown as boolean)
      ).rejects.toThrow(ValidationError);
    });
  });
});
