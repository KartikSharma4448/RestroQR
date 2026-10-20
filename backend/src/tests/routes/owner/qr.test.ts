import request from 'supertest';
import app from '../../../index';
import pool from '../../../config/database';
import { generateOwnerToken, authHeader } from '../../helpers/auth';

// Mock the database pool
jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    on: jest.fn(),
  },
}));

// Mock the token utility to accept test tokens
jest.mock('../../../utils/token', () => ({
  verifyToken: jest.fn(),
}));

import { verifyToken } from '../../../utils/token';

const mockPool = pool as jest.Mocked<typeof pool>;
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

const ownerId = '550e8400-e29b-41d4-a716-446655440000';

describe('GET /api/owner/qr', () => {
  const token = generateOwnerToken(ownerId);

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: verifyToken returns valid owner decode
    mockVerifyToken.mockReturnValue({
      sub: ownerId,
      role: 'owner',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    // Default: owner account is active
    (mockPool.query as jest.Mock).mockImplementation((query: string) => {
      if (query.includes('SELECT status FROM owners')) {
        return Promise.resolve({ rows: [{ status: 'active' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
  });

  it('should return a PNG image when restaurant profile exists', async () => {
    const restaurantToken = 'AbCdEfGh12';

    (mockPool.query as jest.Mock).mockImplementation((query: string) => {
      if (query.includes('SELECT status FROM owners')) {
        return Promise.resolve({ rows: [{ status: 'active' }], rowCount: 1 });
      }
      if (query.includes('SELECT restaurant_token FROM restaurants')) {
        return Promise.resolve({
          rows: [{ restaurant_token: restaurantToken }],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .get('/api/owner/qr')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['content-disposition']).toBe('attachment; filename="qrcode.png"');

    // Verify PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)
    const pngMagicBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const responseBuffer = Buffer.from(res.body);
    expect(responseBuffer.subarray(0, 8).equals(pngMagicBytes)).toBe(true);
  });

  it('should return PNG image of at least 300x300 pixels', async () => {
    const restaurantToken = 'TestToken1';

    (mockPool.query as jest.Mock).mockImplementation((query: string) => {
      if (query.includes('SELECT status FROM owners')) {
        return Promise.resolve({ rows: [{ status: 'active' }], rowCount: 1 });
      }
      if (query.includes('SELECT restaurant_token FROM restaurants')) {
        return Promise.resolve({
          rows: [{ restaurant_token: restaurantToken }],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .get('/api/owner/qr')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);

    // PNG IHDR chunk starts at byte 8, width is at bytes 16-19, height at 20-23 (big-endian)
    const responseBuffer = Buffer.from(res.body);
    const width = responseBuffer.readUInt32BE(16);
    const height = responseBuffer.readUInt32BE(20);
    expect(width).toBeGreaterThanOrEqual(300);
    expect(height).toBeGreaterThanOrEqual(300);
  });

  it('should return 404 when restaurant profile does not exist', async () => {
    (mockPool.query as jest.Mock).mockImplementation((query: string) => {
      if (query.includes('SELECT status FROM owners')) {
        return Promise.resolve({ rows: [{ status: 'active' }], rowCount: 1 });
      }
      if (query.includes('SELECT restaurant_token FROM restaurants')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .get('/api/owner/qr')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('Restaurant profile not found');
  });

  it('should return 401 when no auth token is provided', async () => {
    const res = await request(app).get('/api/owner/qr');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should set Content-Disposition header for download', async () => {
    const restaurantToken = 'UniqueToken';

    (mockPool.query as jest.Mock).mockImplementation((query: string) => {
      if (query.includes('SELECT status FROM owners')) {
        return Promise.resolve({ rows: [{ status: 'active' }], rowCount: 1 });
      }
      if (query.includes('SELECT restaurant_token FROM restaurants')) {
        return Promise.resolve({
          rows: [{ restaurant_token: restaurantToken }],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .get('/api/owner/qr')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="qrcode.png"');
    // The response is a valid PNG (verified by magic bytes)
    const responseBuffer = Buffer.from(res.body);
    const pngMagicBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(responseBuffer.subarray(0, 8).equals(pngMagicBytes)).toBe(true);
  });
});
