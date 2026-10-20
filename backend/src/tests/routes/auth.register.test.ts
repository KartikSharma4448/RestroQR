import { validateRegisterInput, RegisterInput } from '../../services/authService';
import { ValidationError } from '../../errors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMock = any;

// Mock bcrypt to avoid native module issues and speed up tests
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mockedhashvalue'),
}));

// Set JWT_SECRET for tests
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';

describe('POST /api/auth/register', () => {
  describe('validateRegisterInput', () => {
    it('should pass with valid email, password, and name', () => {
      const input: RegisterInput = {
        email: 'test@example.com',
        password: 'password123',
        name: 'John Doe',
      };
      expect(() => validateRegisterInput(input)).not.toThrow();
    });

    it('should pass with valid phone, password, and name', () => {
      const input: RegisterInput = {
        phone: '9876543210',
        password: 'password123',
        name: 'John Doe',
      };
      expect(() => validateRegisterInput(input)).not.toThrow();
    });

    it('should pass with both email and phone provided', () => {
      const input: RegisterInput = {
        email: 'test@example.com',
        phone: '9876543210',
        password: 'password123',
        name: 'John Doe',
      };
      expect(() => validateRegisterInput(input)).not.toThrow();
    });

    it('should fail when neither email nor phone is provided', () => {
      const input: RegisterInput = {
        password: 'password123',
        name: 'John Doe',
      };
      expect(() => validateRegisterInput(input)).toThrow(ValidationError);
      try {
        validateRegisterInput(input);
      } catch (e) {
        const err = e as ValidationError;
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'email', message: expect.stringContaining('At least one') }),
          ])
        );
      }
    });

    it('should fail with empty email and empty phone', () => {
      const input: RegisterInput = {
        email: '',
        phone: '',
        password: 'password123',
        name: 'John Doe',
      };
      expect(() => validateRegisterInput(input)).toThrow(ValidationError);
    });

    it('should fail with invalid email format', () => {
      const input: RegisterInput = {
        email: 'not-an-email',
        password: 'password123',
        name: 'John Doe',
      };
      expect(() => validateRegisterInput(input)).toThrow(ValidationError);
      try {
        validateRegisterInput(input);
      } catch (e) {
        const err = e as ValidationError;
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'email', message: 'Invalid email format' }),
          ])
        );
      }
    });

    it('should fail with phone that is not 10 digits', () => {
      const input: RegisterInput = {
        phone: '12345',
        password: 'password123',
        name: 'John Doe',
      };
      expect(() => validateRegisterInput(input)).toThrow(ValidationError);
      try {
        validateRegisterInput(input);
      } catch (e) {
        const err = e as ValidationError;
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'phone', message: 'Phone must be exactly 10 digits' }),
          ])
        );
      }
    });

    it('should fail with phone containing non-digit characters', () => {
      const input: RegisterInput = {
        phone: '98765abcde',
        password: 'password123',
        name: 'John Doe',
      };
      expect(() => validateRegisterInput(input)).toThrow(ValidationError);
    });

    it('should fail with password shorter than 8 characters', () => {
      const input: RegisterInput = {
        email: 'test@example.com',
        password: 'short',
        name: 'John Doe',
      };
      expect(() => validateRegisterInput(input)).toThrow(ValidationError);
      try {
        validateRegisterInput(input);
      } catch (e) {
        const err = e as ValidationError;
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'password', message: 'Password must be at least 8 characters' }),
          ])
        );
      }
    });

    it('should fail with empty name', () => {
      const input: RegisterInput = {
        email: 'test@example.com',
        password: 'password123',
        name: '',
      };
      expect(() => validateRegisterInput(input)).toThrow(ValidationError);
      try {
        validateRegisterInput(input);
      } catch (e) {
        const err = e as ValidationError;
        expect(err.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'name', message: 'Name is required' }),
          ])
        );
      }
    });

    it('should fail with whitespace-only name', () => {
      const input: RegisterInput = {
        email: 'test@example.com',
        password: 'password123',
        name: '   ',
      };
      expect(() => validateRegisterInput(input)).toThrow(ValidationError);
    });

    it('should pass with password exactly 8 characters', () => {
      const input: RegisterInput = {
        email: 'test@example.com',
        password: '12345678',
        name: 'John Doe',
      };
      expect(() => validateRegisterInput(input)).not.toThrow();
    });

    it('should fail with phone of 11 digits', () => {
      const input: RegisterInput = {
        phone: '12345678901',
        password: 'password123',
        name: 'John Doe',
      };
      expect(() => validateRegisterInput(input)).toThrow(ValidationError);
    });

    it('should collect multiple validation errors', () => {
      const input: RegisterInput = {
        password: 'short',
        name: '',
      };
      try {
        validateRegisterInput(input);
      } catch (e) {
        const err = e as ValidationError;
        expect(err.details!.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('registerOwner (integration via supertest)', () => {
    // These tests mock the database pool to unit-test the route handler logic
    // without requiring a live database connection.

    let mockPool: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      if (mockPool) {
        mockPool.mockRestore();
      }
    });

    // Helper to mock pool.query with type safety
    function mockQuery(pool: { query: (...args: AnyMock[]) => AnyMock }) {
      return jest.spyOn(pool, 'query') as jest.SpyInstance;
    }

    it('should return 201 with token and owner data on successful registration', async () => {
      const supertest = (await import('supertest')).default;
      const pool = (await import('../../config/database')).default;

      // Mock pool.query for duplicate checks and insert
      mockPool = mockQuery(pool)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // email check
        .mockResolvedValueOnce({ // insert
          rows: [{
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'owner@restaurant.com',
            phone: null,
            name: 'Restaurant Owner',
          }],
          rowCount: 1,
        });

      const app = (await import('../../index')).default;

      const res = await supertest(app)
        .post('/api/auth/register')
        .send({
          email: 'owner@restaurant.com',
          password: 'securepass123',
          name: 'Restaurant Owner',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.owner.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(res.body.data.owner.name).toBe('Restaurant Owner');
      expect(res.body.data.owner.email).toBe('owner@restaurant.com');
    });

    it('should return 400 on validation error (missing name)', async () => {
      const supertest = (await import('supertest')).default;
      const app = (await import('../../index')).default;

      const res = await supertest(app)
        .post('/api/auth/register')
        .send({
          email: 'owner@restaurant.com',
          password: 'securepass123',
          name: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 on duplicate email', async () => {
      const supertest = (await import('supertest')).default;
      const pool = (await import('../../config/database')).default;

      // Mock pool.query to return existing user for email check
      mockPool = mockQuery(pool)
        .mockResolvedValueOnce({ rows: [{ id: 'existing-id' }], rowCount: 1 }); // email exists

      const app = (await import('../../index')).default;

      const res = await supertest(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@restaurant.com',
          password: 'securepass123',
          name: 'New Owner',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should return 409 on duplicate phone', async () => {
      const supertest = (await import('supertest')).default;
      const pool = (await import('../../config/database')).default;

      // Mock pool.query: phone check returns existing
      mockPool = mockQuery(pool)
        .mockResolvedValueOnce({ rows: [{ id: 'existing-id' }], rowCount: 1 }); // phone exists

      const app = (await import('../../index')).default;

      const res = await supertest(app)
        .post('/api/auth/register')
        .send({
          phone: '9876543210',
          password: 'securepass123',
          name: 'New Owner',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should hash password with bcrypt cost factor 12', async () => {
      const bcrypt = await import('bcrypt');
      const mockHash = bcrypt.hash as jest.Mock;

      const supertest = (await import('supertest')).default;
      const pool = (await import('../../config/database')).default;

      mockPool = mockQuery(pool)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // email check
        .mockResolvedValueOnce({ // insert
          rows: [{
            id: 'new-id',
            email: 'test@example.com',
            phone: null,
            name: 'Test Owner',
          }],
          rowCount: 1,
        });

      const app = (await import('../../index')).default;

      await supertest(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'mypassword123',
          name: 'Test Owner',
        });

      expect(mockHash).toHaveBeenCalledWith('mypassword123', 12);
    });

    it('should return 400 when password is too short', async () => {
      const supertest = (await import('supertest')).default;
      const app = (await import('../../index')).default;

      const res = await supertest(app)
        .post('/api/auth/register')
        .send({
          email: 'owner@restaurant.com',
          password: 'short',
          name: 'Owner',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'password' }),
        ])
      );
    });

    it('should return 400 when no contact info is provided', async () => {
      const supertest = (await import('supertest')).default;
      const app = (await import('../../index')).default;

      const res = await supertest(app)
        .post('/api/auth/register')
        .send({
          password: 'securepass123',
          name: 'Owner',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
