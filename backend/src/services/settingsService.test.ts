import { ValidationError, NotFoundError } from '../errors';

// Mock database pool
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import pool from '../config/database';
import { validateQrMode, updateQrMode, getQrMode } from './settingsService';

const mockPool = pool as jest.Mocked<typeof pool>;

describe('settingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateQrMode', () => {
    it('should accept "single"', () => {
      expect(() => validateQrMode('single')).not.toThrow();
    });

    it('should accept "multi"', () => {
      expect(() => validateQrMode('multi')).not.toThrow();
    });

    it('should reject empty string', () => {
      expect(() => validateQrMode('')).toThrow(ValidationError);
    });

    it('should reject null', () => {
      expect(() => validateQrMode(null)).toThrow(ValidationError);
    });

    it('should reject undefined', () => {
      expect(() => validateQrMode(undefined)).toThrow(ValidationError);
    });

    it('should reject numbers', () => {
      expect(() => validateQrMode(1)).toThrow(ValidationError);
    });

    it('should reject arbitrary strings', () => {
      expect(() => validateQrMode('both')).toThrow(ValidationError);
      expect(() => validateQrMode('SINGLE')).toThrow(ValidationError);
      expect(() => validateQrMode('Multi')).toThrow(ValidationError);
    });

    it('should include field details in validation error', () => {
      try {
        validateQrMode('invalid');
      } catch (error) {
        const ve = error as ValidationError;
        expect(ve.details).toBeDefined();
        const details = ve.details as Array<{ field: string; message: string }>;
        expect(details[0].field).toBe('qrMode');
        expect(details[0].message).toContain("'single' or 'multi'");
      }
    });
  });

  describe('updateQrMode', () => {
    const restaurantId = 'restaurant-uuid-123';

    it('should update qr_mode to "multi" when restaurant exists', async () => {
      (mockPool.query as jest.Mock).mockImplementation((query: string) => {
        if (query.includes('SELECT id FROM restaurants')) {
          return Promise.resolve({ rows: [{ id: restaurantId }] });
        }
        if (query.includes('UPDATE restaurants SET qr_mode')) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await updateQrMode(restaurantId, 'multi');

      expect(result).toEqual({ qrMode: 'multi' });
    });

    it('should update qr_mode to "single" when restaurant exists', async () => {
      (mockPool.query as jest.Mock).mockImplementation((query: string) => {
        if (query.includes('SELECT id FROM restaurants')) {
          return Promise.resolve({ rows: [{ id: restaurantId }] });
        }
        if (query.includes('UPDATE restaurants SET qr_mode')) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await updateQrMode(restaurantId, 'single');

      expect(result).toEqual({ qrMode: 'single' });
    });

    it('should throw NotFoundError when restaurant does not exist', async () => {
      (mockPool.query as jest.Mock).mockImplementation((query: string) => {
        if (query.includes('SELECT id FROM restaurants')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(updateQrMode(restaurantId, 'multi')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid qrMode values', async () => {
      await expect(updateQrMode(restaurantId, 'invalid')).rejects.toThrow(ValidationError);
      await expect(updateQrMode(restaurantId, '')).rejects.toThrow(ValidationError);
      await expect(updateQrMode(restaurantId, null)).rejects.toThrow(ValidationError);
    });

    it('should only update qr_mode and updated_at columns', async () => {
      (mockPool.query as jest.Mock).mockImplementation((query: string) => {
        if (query.includes('SELECT id FROM restaurants')) {
          return Promise.resolve({ rows: [{ id: restaurantId }] });
        }
        if (query.includes('UPDATE restaurants SET qr_mode')) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      await updateQrMode(restaurantId, 'multi');

      const updateCall = (mockPool.query as jest.Mock).mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('UPDATE restaurants SET qr_mode')
      );
      expect(updateCall).toBeDefined();
      // Verify the SQL only touches qr_mode and updated_at
      expect(updateCall![0]).toContain('qr_mode = $1');
      expect(updateCall![0]).toContain('updated_at = NOW()');
      // Verify params: [qrMode, restaurantId]
      expect(updateCall![1]).toEqual(['multi', restaurantId]);
    });
  });

  describe('getQrMode', () => {
    const restaurantId = 'restaurant-uuid-123';

    it('should return the current qr_mode', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [{ qr_mode: 'multi' }],
      });

      const result = await getQrMode(restaurantId);

      expect(result).toEqual({ qrMode: 'multi' });
    });

    it('should throw NotFoundError when restaurant does not exist', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(getQrMode(restaurantId)).rejects.toThrow(NotFoundError);
    });
  });
});
