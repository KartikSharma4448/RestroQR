import {
  listOwners,
  getOwnerById,
  updateOwnerStatus,
} from '../../../services/adminOwnerService';
import { NotFoundError, ValidationError } from '../../../errors';
import pool from '../../../config/database';

// Mock database pool
jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

const mockPool = pool as jest.Mocked<typeof pool>;

describe('Admin Owner Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/owners — listOwners', () => {
    it('should return all owners with correct fields', async () => {
      const mockRows = [
        {
          id: 'owner-1',
          name: 'Alice',
          email: 'alice@example.com',
          phone: null,
          status: 'active',
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'owner-2',
          name: 'Bob',
          email: null,
          phone: '9876543210',
          status: 'disabled',
          created_at: '2024-01-02T00:00:00.000Z',
        },
      ];

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await listOwners();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'owner-1',
        name: 'Alice',
        email: 'alice@example.com',
        phone: null,
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
      });
      expect(result[1]).toEqual({
        id: 'owner-2',
        name: 'Bob',
        email: null,
        phone: '9876543210',
        status: 'disabled',
        createdAt: '2024-01-02T00:00:00.000Z',
      });
    });

    it('should return empty array when no owners exist', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await listOwners();

      expect(result).toEqual([]);
    });

    it('should query owners ordered by created_at DESC', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await listOwners();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC')
      );
    });
  });

  describe('GET /api/admin/owners/:id — getOwnerById', () => {
    it('should return owner details with associated restaurant', async () => {
      const mockRow = {
        id: 'owner-1',
        name: 'Alice',
        email: 'alice@example.com',
        phone: '1234567890',
        status: 'active',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-05T00:00:00.000Z',
        restaurant_id: 'rest-1',
        restaurant_name: 'Alice\'s Diner',
        restaurant_status: 'active',
        restaurant_token: 'AbCdEf1234',
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] });

      const result = await getOwnerById('owner-1');

      expect(result).toEqual({
        id: 'owner-1',
        name: 'Alice',
        email: 'alice@example.com',
        phone: '1234567890',
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-05T00:00:00.000Z',
        restaurant: {
          id: 'rest-1',
          name: 'Alice\'s Diner',
          status: 'active',
          restaurantToken: 'AbCdEf1234',
        },
      });
    });

    it('should return owner with restaurant as null when no restaurant exists', async () => {
      const mockRow = {
        id: 'owner-2',
        name: 'Bob',
        email: 'bob@example.com',
        phone: null,
        status: 'active',
        created_at: '2024-01-02T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
        restaurant_id: null,
        restaurant_name: null,
        restaurant_status: null,
        restaurant_token: null,
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] });

      const result = await getOwnerById('owner-2');

      expect(result.restaurant).toBeNull();
    });

    it('should throw NotFoundError when owner does not exist', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(getOwnerById('non-existent')).rejects.toThrow(NotFoundError);
      await expect(getOwnerById('non-existent')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should perform LEFT JOIN with restaurants table', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      try {
        await getOwnerById('owner-1');
      } catch {
        // Expected to throw
      }

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN restaurants'),
        ['owner-1']
      );
    });
  });

  describe('PATCH /api/admin/owners/:id/status — updateOwnerStatus', () => {
    it('should update owner status to disabled', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'owner-1', status: 'disabled' }],
      });

      const result = await updateOwnerStatus('owner-1', 'disabled');

      expect(result).toEqual({ id: 'owner-1', status: 'disabled' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE owners SET status'),
        ['disabled', 'owner-1']
      );
    });

    it('should update owner status to active', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'owner-1', status: 'active' }],
      });

      const result = await updateOwnerStatus('owner-1', 'active');

      expect(result).toEqual({ id: 'owner-1', status: 'active' });
    });

    it('should throw NotFoundError when owner does not exist', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(updateOwnerStatus('non-existent', 'active')).rejects.toThrow(NotFoundError);
      await expect(updateOwnerStatus('non-existent', 'active')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should throw ValidationError for invalid status value', async () => {
      await expect(updateOwnerStatus('owner-1', 'invalid')).rejects.toThrow(ValidationError);
      await expect(updateOwnerStatus('owner-1', 'invalid')).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('should throw ValidationError for empty status', async () => {
      await expect(updateOwnerStatus('owner-1', '')).rejects.toThrow(ValidationError);
    });

    it('should not call database for invalid status values', async () => {
      try {
        await updateOwnerStatus('owner-1', 'invalid');
      } catch {
        // Expected
      }

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should update the updated_at timestamp', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'owner-1', status: 'disabled' }],
      });

      await updateOwnerStatus('owner-1', 'disabled');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.any(Array)
      );
    });
  });
});
