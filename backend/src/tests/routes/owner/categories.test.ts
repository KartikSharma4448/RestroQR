import { ValidationError } from '../../../errors/ValidationError';
import { NotFoundError } from '../../../errors/NotFoundError';
import { ConflictError } from '../../../errors/ConflictError';

// Mock database pool at the top level
const mockQuery = jest.fn();
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};
const mockConnect = jest.fn().mockResolvedValue(mockClient);

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: () => mockConnect(),
  },
}));

// Import service after mock
import {
  validateCategoryName,
  getRestaurantIdForOwner,
  createCategory,
  listCategories,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from '../../../services/categoryService';

describe('Category Service - Validation', () => {
  describe('validateCategoryName', () => {
    it('should return trimmed name for valid input', () => {
      expect(validateCategoryName('Appetizers')).toBe('Appetizers');
    });

    it('should trim whitespace from name', () => {
      expect(validateCategoryName('  Drinks  ')).toBe('Drinks');
    });

    it('should accept name with exactly 1 character', () => {
      expect(validateCategoryName('A')).toBe('A');
    });

    it('should accept name with exactly 50 characters', () => {
      const name = 'a'.repeat(50);
      expect(validateCategoryName(name)).toBe(name);
    });

    it('should reject empty string', () => {
      expect(() => validateCategoryName('')).toThrow(ValidationError);
    });

    it('should reject whitespace-only string', () => {
      expect(() => validateCategoryName('   ')).toThrow(ValidationError);
    });

    it('should reject null', () => {
      expect(() => validateCategoryName(null)).toThrow(ValidationError);
    });

    it('should reject undefined', () => {
      expect(() => validateCategoryName(undefined)).toThrow(ValidationError);
    });

    it('should reject non-string values', () => {
      expect(() => validateCategoryName(123)).toThrow(ValidationError);
    });

    it('should reject name exceeding 50 characters', () => {
      expect(() => validateCategoryName('a'.repeat(51))).toThrow(ValidationError);
    });

    it('should include field name in validation error details', () => {
      try {
        validateCategoryName('');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        const err = e as ValidationError;
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'name' }),
          ])
        );
      }
    });
  });
});

describe('Category Service - Database Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(mockClient);
  });

  describe('getRestaurantIdForOwner', () => {
    it('should return restaurant ID when found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'rest-123' }] });
      const result = await getRestaurantIdForOwner('owner-1');
      expect(result).toBe('rest-123');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM restaurants WHERE owner_id = $1',
        ['owner-1']
      );
    });

    it('should throw NotFoundError when restaurant not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(getRestaurantIdForOwner('owner-999')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createCategory', () => {
    it('should create category with next display_order', async () => {
      // Check uniqueness
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Get max display_order
      mockQuery.mockResolvedValueOnce({ rows: [{ max_order: 2 }] });
      // Insert
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'cat-1',
          name: 'Appetizers',
          display_order: 3,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        }],
      });

      const result = await createCategory('rest-123', 'Appetizers');
      expect(result.name).toBe('Appetizers');
      expect(result.displayOrder).toBe(3);
    });

    it('should throw ConflictError for duplicate name', async () => {
      // Check uniqueness — found existing
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-cat' }] });

      await expect(createCategory('rest-123', 'Appetizers')).rejects.toThrow(ConflictError);
    });

    it('should set display_order to 1 for first category', async () => {
      // Check uniqueness
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Get max display_order — 0
      mockQuery.mockResolvedValueOnce({ rows: [{ max_order: 0 }] });
      // Insert
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'cat-1',
          name: 'First Category',
          display_order: 1,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        }],
      });

      const result = await createCategory('rest-123', 'First Category');
      expect(result.displayOrder).toBe(1);
    });

    it('should throw ValidationError for invalid name', async () => {
      await expect(createCategory('rest-123', '')).rejects.toThrow(ValidationError);
    });
  });

  describe('listCategories', () => {
    it('should return categories ordered by display_order', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'cat-1', name: 'First', display_order: 0, created_at: new Date('2024-01-01'), updated_at: new Date('2024-01-01') },
          { id: 'cat-2', name: 'Second', display_order: 1, created_at: new Date('2024-01-01'), updated_at: new Date('2024-01-01') },
        ],
      });

      const result = await listCategories('rest-123');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('First');
      expect(result[1].name).toBe('Second');
    });

    it('should return empty array when no categories exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await listCategories('rest-123');
      expect(result).toEqual([]);
    });
  });

  describe('updateCategory', () => {
    it('should update category name', async () => {
      // Verify ownership
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] });
      // Check uniqueness
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Update
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'cat-1',
          name: 'Updated Name',
          display_order: 1,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-02'),
        }],
      });

      const result = await updateCategory('cat-1', 'rest-123', 'Updated Name');
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundError if category not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(updateCategory('cat-999', 'rest-123', 'Name')).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError for duplicate name (excluding self)', async () => {
      // Verify ownership
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] });
      // Check uniqueness — found another
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cat-2' }] });

      await expect(updateCategory('cat-1', 'rest-123', 'Existing Name')).rejects.toThrow(ConflictError);
    });
  });

  describe('deleteCategory', () => {
    it('should delete category successfully', async () => {
      // Verify ownership
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] });
      // Delete
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(deleteCategory('cat-1', 'rest-123')).resolves.toBeUndefined();
    });

    it('should throw NotFoundError if category not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(deleteCategory('cat-999', 'rest-123')).rejects.toThrow(NotFoundError);
    });
  });

  describe('reorderCategories', () => {
    it('should reorder categories and return updated list', async () => {
      // Client transaction
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'cat-1' }, { id: 'cat-2' }, { id: 'cat-3' }] }) // Verify ownership
        .mockResolvedValueOnce(undefined) // UPDATE cat-3 display_order=0
        .mockResolvedValueOnce(undefined) // UPDATE cat-1 display_order=1
        .mockResolvedValueOnce(undefined) // UPDATE cat-2 display_order=2
        .mockResolvedValueOnce(undefined); // COMMIT

      // After commit, listCategories queries via pool.query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'cat-3', name: 'Third', display_order: 0, created_at: new Date('2024-01-01'), updated_at: new Date('2024-01-01') },
          { id: 'cat-1', name: 'First', display_order: 1, created_at: new Date('2024-01-01'), updated_at: new Date('2024-01-01') },
          { id: 'cat-2', name: 'Second', display_order: 2, created_at: new Date('2024-01-01'), updated_at: new Date('2024-01-01') },
        ],
      });

      const result = await reorderCategories('rest-123', ['cat-3', 'cat-1', 'cat-2']);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('cat-3');
      expect(result[0].displayOrder).toBe(0);
    });

    it('should throw ValidationError for empty array', async () => {
      await expect(reorderCategories('rest-123', [])).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for non-array', async () => {
      await expect(reorderCategories('rest-123', null as any)).rejects.toThrow(ValidationError);
    });

    it('should rollback and throw if category ID does not belong to restaurant', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] }); // Verify — only cat-1 belongs

      await expect(
        reorderCategories('rest-123', ['cat-1', 'cat-unknown'])
      ).rejects.toThrow(ValidationError);

      // Verify ROLLBACK was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
