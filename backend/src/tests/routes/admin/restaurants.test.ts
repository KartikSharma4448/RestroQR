import {
  listRestaurants,
  getRestaurantById,
  updateRestaurant,
  updateRestaurantStatus,
  deleteRestaurant,
  parsePaginationParams,
  validateUpdateInput,
} from '../../../services/adminRestaurantService';
import { NotFoundError, ValidationError } from '../../../errors';
import pool from '../../../config/database';

// Mock the database pool
jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

const mockPool = pool as jest.Mocked<typeof pool>;

describe('Admin Restaurant Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parsePaginationParams', () => {
    it('should return defaults when no params provided', () => {
      const result = parsePaginationParams({});
      expect(result).toEqual({ page: 1, pageSize: 10 });
    });

    it('should parse valid page and pageSize', () => {
      const result = parsePaginationParams({ page: '3', pageSize: '25' });
      expect(result).toEqual({ page: 3, pageSize: 25 });
    });

    it('should default page to 1 if invalid', () => {
      const result = parsePaginationParams({ page: '0', pageSize: '10' });
      expect(result).toEqual({ page: 1, pageSize: 10 });
    });

    it('should default page to 1 if NaN', () => {
      const result = parsePaginationParams({ page: 'abc', pageSize: '10' });
      expect(result).toEqual({ page: 1, pageSize: 10 });
    });

    it('should cap pageSize at 100', () => {
      const result = parsePaginationParams({ page: '1', pageSize: '200' });
      expect(result).toEqual({ page: 1, pageSize: 100 });
    });

    it('should default pageSize to 10 if invalid', () => {
      const result = parsePaginationParams({ page: '1', pageSize: '-5' });
      expect(result).toEqual({ page: 1, pageSize: 10 });
    });
  });

  describe('validateUpdateInput', () => {
    it('should pass with valid input', () => {
      expect(() =>
        validateUpdateInput({ name: 'New Name', address: '123 St', phone: '1234567890' })
      ).not.toThrow();
    });

    it('should throw ValidationError when name exceeds 100 chars', () => {
      expect(() =>
        validateUpdateInput({ name: 'a'.repeat(101) })
      ).toThrow(ValidationError);
    });

    it('should throw ValidationError when address exceeds 250 chars', () => {
      expect(() =>
        validateUpdateInput({ address: 'a'.repeat(251) })
      ).toThrow(ValidationError);
    });

    it('should throw ValidationError when phone exceeds 20 chars', () => {
      expect(() =>
        validateUpdateInput({ phone: '1'.repeat(21) })
      ).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty name', () => {
      expect(() =>
        validateUpdateInput({ name: '' })
      ).toThrow(ValidationError);
    });

    it('should throw ValidationError for whitespace-only name', () => {
      expect(() =>
        validateUpdateInput({ name: '   ' })
      ).toThrow(ValidationError);
    });

    it('should not throw when no fields are provided', () => {
      expect(() => validateUpdateInput({})).not.toThrow();
    });
  });

  describe('listRestaurants', () => {
    it('should return paginated list of restaurants with owner names', async () => {
      // Mock count query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '3' }],
      });

      // Mock data query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'rest-1',
            name: 'Restaurant 1',
            owner_name: 'Owner 1',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'rest-2',
            name: 'Restaurant 2',
            owner_name: 'Owner 2',
            status: 'disabled',
            created_at: '2024-01-02T00:00:00Z',
          },
        ],
      });

      const result = await listRestaurants({ page: 1, pageSize: 2 });

      expect(result.restaurants).toHaveLength(2);
      expect(result.restaurants[0]).toEqual({
        id: 'rest-1',
        name: 'Restaurant 1',
        ownerName: 'Owner 1',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
      });
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('should apply correct offset for page 2', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '15' }],
      });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await listRestaurants({ page: 2, pageSize: 10 });

      // Second call is the data query with LIMIT and OFFSET
      const dataQueryCall = (mockPool.query as jest.Mock).mock.calls[1];
      expect(dataQueryCall[1]).toEqual([10, 10]); // pageSize=10, offset=10
    });

    it('should return empty restaurants array when no data', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await listRestaurants({ page: 1, pageSize: 10 });

      expect(result.restaurants).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('getRestaurantById', () => {
    it('should return restaurant details with owner information', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'rest-123',
            name: 'My Restaurant',
            address: '123 Main St',
            phone: '5551234567',
            logo_url: 'https://cdn.example.com/logo.png',
            cover_image_url: 'https://cdn.example.com/cover.png',
            restaurant_token: 'tkn1234567',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-15T00:00:00Z',
            owner_id: 'owner-456',
            owner_name: 'John Doe',
            owner_email: 'john@example.com',
            owner_phone: '5559876543',
            owner_status: 'active',
          },
        ],
      });

      const result = await getRestaurantById('rest-123');

      expect(result).toEqual({
        id: 'rest-123',
        name: 'My Restaurant',
        address: '123 Main St',
        phone: '5551234567',
        logoUrl: 'https://cdn.example.com/logo.png',
        coverImageUrl: 'https://cdn.example.com/cover.png',
        restaurantToken: 'tkn1234567',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
        owner: {
          id: 'owner-456',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '5559876543',
          status: 'active',
        },
      });
    });

    it('should throw NotFoundError when restaurant does not exist', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(getRestaurantById('nonexistent-id')).rejects.toThrow(NotFoundError);
      await expect(getRestaurantById('nonexistent-id')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('updateRestaurant', () => {
    const mockRestaurantRow = {
      id: 'rest-123',
      name: 'Updated Restaurant',
      address: '456 New St',
      phone: '5559999999',
      logo_url: null,
      cover_image_url: null,
      restaurant_token: 'tkn1234567',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-20T00:00:00Z',
      owner_id: 'owner-456',
      owner_name: 'John Doe',
      owner_email: 'john@example.com',
      owner_phone: null,
      owner_status: 'active',
    };

    it('should update restaurant name successfully', async () => {
      // Mock UPDATE query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'rest-123' }],
      });
      // Mock getRestaurantById query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockRestaurantRow],
      });

      const result = await updateRestaurant('rest-123', { name: 'Updated Restaurant' });

      expect(result.name).toBe('Updated Restaurant');
      // Check the UPDATE query was called
      const updateCall = (mockPool.query as jest.Mock).mock.calls[0];
      expect(updateCall[0]).toContain('UPDATE restaurants SET');
      expect(updateCall[0]).toContain('name =');
    });

    it('should throw NotFoundError when restaurant does not exist', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        updateRestaurant('nonexistent-id', { name: 'New Name' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for name exceeding 100 chars', async () => {
      await expect(
        updateRestaurant('rest-123', { name: 'a'.repeat(101) })
      ).rejects.toThrow(ValidationError);
    });

    it('should return current data when no fields are provided', async () => {
      // When no fields to update, getRestaurantById is called directly
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockRestaurantRow],
      });

      const result = await updateRestaurant('rest-123', {});

      expect(result.id).toBe('rest-123');
    });
  });

  describe('updateRestaurantStatus', () => {
    it('should update status to disabled', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'rest-123', status: 'disabled' }],
      });

      const result = await updateRestaurantStatus('rest-123', 'disabled');

      expect(result).toEqual({ id: 'rest-123', status: 'disabled' });
    });

    it('should update status to active', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'rest-123', status: 'active' }],
      });

      const result = await updateRestaurantStatus('rest-123', 'active');

      expect(result).toEqual({ id: 'rest-123', status: 'active' });
    });

    it('should throw ValidationError for invalid status', async () => {
      await expect(
        updateRestaurantStatus('rest-123', 'invalid')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when restaurant does not exist', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        updateRestaurantStatus('nonexistent-id', 'active')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteRestaurant', () => {
    it('should delete restaurant and collect image URLs for cleanup', async () => {
      // Mock restaurant existence check
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'rest-123', logo_url: 'https://cdn.example.com/logo.png', cover_image_url: 'https://cdn.example.com/cover.png' }],
      });

      // Mock food item images query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { image_url: 'https://cdn.example.com/item1.png' },
          { image_url: 'https://cdn.example.com/item2.png' },
        ],
      });

      // Mock DELETE query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await deleteRestaurant('rest-123');

      // Verify DELETE was called
      const deleteCall = (mockPool.query as jest.Mock).mock.calls[2];
      expect(deleteCall[0]).toContain('DELETE FROM restaurants');
      expect(deleteCall[1]).toEqual(['rest-123']);
    });

    it('should throw NotFoundError when restaurant does not exist', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(deleteRestaurant('nonexistent-id')).rejects.toThrow(NotFoundError);
    });

    it('should handle deletion when no images exist', async () => {
      // Mock restaurant existence (no images)
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'rest-123', logo_url: null, cover_image_url: null }],
      });

      // Mock food item images (none)
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Mock DELETE
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(deleteRestaurant('rest-123')).resolves.toBeUndefined();
    });
  });
});
