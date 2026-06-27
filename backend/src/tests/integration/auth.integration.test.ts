import supertest from 'supertest';
import bcrypt from 'bcrypt';

// Mock bcrypt to avoid native module cost in tests
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mockedhashvalue'),
  compare: jest.fn(),
}));

// Mock nanoid used by ownerRestaurantService
jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'aBcDeFgHiJ',
}));

// Set JWT_SECRET before importing app
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
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('Auth Integration Tests — Full request-response cycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Register → Login → Access Protected Route', () => {
    const ownerId = '550e8400-e29b-41d4-a716-446655440000';
    const ownerEmail = 'newowner@restaurant.com';

    it('should register a new owner, login, and access a protected route', async () => {
      // Step 1: Register
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // email uniqueness check
        .mockResolvedValueOnce({
          rows: [{
            id: ownerId,
            email: ownerEmail,
            phone: null,
            name: 'New Owner',
          }],
          rowCount: 1,
        }); // insert owner

      const registerRes = await supertest(app)
        .post('/api/auth/register')
        .send({
          email: ownerEmail,
          password: 'securepass123',
          name: 'New Owner',
        });

      expect(registerRes.status).toBe(201);
      expect(registerRes.body.success).toBe(true);
      expect(registerRes.body.data.token).toBeDefined();
      expect(registerRes.body.data.owner.id).toBe(ownerId);
      expect(registerRes.body.data.owner.email).toBe(ownerEmail);

      const registrationToken = registerRes.body.data.token;

      // Step 2: Login with same credentials
      jest.clearAllMocks();
      (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: ownerId,
            password_hash: '$2b$12$mockedhashvalue',
            name: 'New Owner',
            status: 'active',
          }],
        }); // owner lookup by email

      const loginRes = await supertest(app)
        .post('/api/auth/login')
        .send({
          email: ownerEmail,
          password: 'securepass123',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.token).toBeDefined();
      expect(loginRes.body.data.user.role).toBe('owner');

      const loginToken = loginRes.body.data.token;

      // Step 3: Access protected route with login token
      jest.clearAllMocks();
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ status: 'active' }] }) // auth middleware owner status check
        .mockResolvedValueOnce({ rows: [] }); // no restaurant found (NotFoundError)

      const protectedRes = await supertest(app)
        .get('/api/owner/restaurant')
        .set('Authorization', `Bearer ${loginToken}`);

      // Owner has no restaurant yet → 404, but auth passed
      expect(protectedRes.status).toBe(404);
      expect(protectedRes.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject access to protected route without token', async () => {
      const res = await supertest(app)
        .get('/api/owner/restaurant');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
    });

    it('should reject access to protected route with invalid token', async () => {
      const res = await supertest(app)
        .get('/api/owner/restaurant')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
    });
  });

  describe('Disabled Account Rejection', () => {
    const ownerId = '660e8400-e29b-41d4-a716-446655440000';
    const ownerEmail = 'disabled@restaurant.com';

    it('should return 403 when a disabled owner tries to login', async () => {
      (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: ownerId,
            password_hash: '$2b$12$mockedhashvalue',
            name: 'Disabled Owner',
            status: 'disabled',
          }],
        }); // owner lookup

      const res = await supertest(app)
        .post('/api/auth/login')
        .send({
          email: ownerEmail,
          password: 'securepass123',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    });

    it('should return 403 when a disabled owner accesses protected routes with valid token', async () => {
      // Generate a valid token for this owner
      const token = generateOwnerToken(ownerId, ownerEmail);

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ status: 'disabled' }],
        }); // auth middleware checks status

      const res = await supertest(app)
        .get('/api/owner/restaurant')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    });
  });

  describe('Role-based Access Control', () => {
    const ownerId = '770e8400-e29b-41d4-a716-446655440000';
    const adminId = '880e8400-e29b-41d4-a716-446655440000';

    it('should reject owner token on admin routes', async () => {
      const ownerToken = generateOwnerToken(ownerId);

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ status: 'active' }] }); // auth middleware

      const res = await supertest(app)
        .get('/api/admin/restaurants')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
