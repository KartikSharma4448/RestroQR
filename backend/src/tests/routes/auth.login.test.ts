import bcrypt from 'bcrypt';
import { login, LoginInput } from '../../services/authService';
import { AuthenticationError, ValidationError } from '../../errors';
import pool from '../../config/database';
import * as tokenUtils from '../../utils/token';

// Mock dependencies
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock('../../utils/token', () => ({
  signToken: jest.fn().mockReturnValue('mock-jwt-token'),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const mockPool = pool as jest.Mocked<typeof pool>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockSignToken = tokenUtils.signToken as jest.MockedFunction<typeof tokenUtils.signToken>;

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation', () => {
    it('should throw ValidationError when neither email nor phone is provided', async () => {
      const input: LoginInput = { password: 'password123' };

      await expect(login(input)).rejects.toThrow(ValidationError);
      await expect(login(input)).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('should throw ValidationError when password is not provided', async () => {
      const input = { email: 'test@example.com', password: '' } as LoginInput;

      await expect(login(input)).rejects.toThrow(ValidationError);
    });
  });

  describe('Login with email', () => {
    it('should authenticate owner by email successfully', async () => {
      const ownerId = 'owner-uuid-123';
      const hashedPassword = '$2b$10$hashedpassword';

      // Owner found by email
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: ownerId,
          password_hash: hashedPassword,
          name: 'John Owner',
          status: 'active',
        }],
      });

      (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockSignToken.mockReturnValueOnce('jwt-token-for-owner');

      const result = await login({ email: 'john@example.com', password: 'validpass123' });

      expect(result).toEqual({
        token: 'jwt-token-for-owner',
        user: {
          id: ownerId,
          role: 'owner',
          name: 'John Owner',
        },
      });

      expect(mockSignToken).toHaveBeenCalledWith(ownerId, 'owner');
    });

    it('should authenticate admin by email successfully', async () => {
      const adminId = 'admin-uuid-456';
      const hashedPassword = '$2b$10$hashedpassword';

      // Owner not found
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // Admin found
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: adminId,
          password_hash: hashedPassword,
        }],
      });

      (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockSignToken.mockReturnValueOnce('jwt-token-for-admin');

      const result = await login({ email: 'admin@restroqr.com', password: 'adminpass' });

      expect(result).toEqual({
        token: 'jwt-token-for-admin',
        user: {
          id: adminId,
          role: 'admin',
          name: 'Admin',
        },
      });

      expect(mockSignToken).toHaveBeenCalledWith(adminId, 'admin');
    });

    it('should search owners first, then admins when email is provided', async () => {
      // Owner not found
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // Admin not found
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        login({ email: 'nobody@example.com', password: 'pass123' })
      ).rejects.toThrow(AuthenticationError);

      // Should have queried owners first, then admins
      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect((mockPool.query as jest.Mock).mock.calls[0][0]).toContain('owners');
      expect((mockPool.query as jest.Mock).mock.calls[1][0]).toContain('admins');
    });
  });

  describe('Login with phone', () => {
    it('should authenticate owner by phone successfully', async () => {
      const ownerId = 'owner-uuid-789';
      const hashedPassword = '$2b$10$hashedpassword';

      // Owner found by phone
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: ownerId,
          password_hash: hashedPassword,
          name: 'Phone Owner',
          status: 'active',
        }],
      });

      (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockSignToken.mockReturnValueOnce('jwt-token-phone');

      const result = await login({ phone: '9876543210', password: 'validpass' });

      expect(result).toEqual({
        token: 'jwt-token-phone',
        user: {
          id: ownerId,
          role: 'owner',
          name: 'Phone Owner',
        },
      });

      // Should query owners by phone
      expect((mockPool.query as jest.Mock).mock.calls[0][0]).toContain('phone');
    });

    it('should return AuthenticationError when phone not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        login({ phone: '0000000000', password: 'pass123' })
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('Authentication error uniformity (Property 8)', () => {
    it('should return identical error for non-existent account and wrong password', async () => {
      // Case 1: Non-existent account
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      let error1: AuthenticationError | null = null;
      try {
        await login({ email: 'nobody@example.com', password: 'anything' });
      } catch (e) {
        error1 = e as AuthenticationError;
      }

      // Case 2: Wrong password
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'some-id',
          password_hash: '$2b$10$hash',
          name: 'Existing User',
          status: 'active',
        }],
      });
      (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      let error2: AuthenticationError | null = null;
      try {
        await login({ email: 'existing@example.com', password: 'wrongpass' });
      } catch (e) {
        error2 = e as AuthenticationError;
      }

      // Both errors must be identical in structure and message
      expect(error1).not.toBeNull();
      expect(error2).not.toBeNull();
      expect(error1!.statusCode).toBe(error2!.statusCode);
      expect(error1!.code).toBe(error2!.code);
      expect(error1!.message).toBe(error2!.message);
      expect(error1!.statusCode).toBe(401);
      expect(error1!.code).toBe('AUTHENTICATION_FAILED');
      expect(error1!.message).toBe('Invalid credentials');
    });

    it('should not reveal whether email exists in error message', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      try {
        await login({ email: 'test@example.com', password: 'anypass' });
      } catch (e) {
        const err = e as AuthenticationError;
        expect(err.message).not.toContain('email');
        expect(err.message).not.toContain('not found');
        expect(err.message).not.toContain('does not exist');
        expect(err.message).toBe('Invalid credentials');
      }
    });
  });

  describe('Account status check', () => {
    it('should return ACCOUNT_DISABLED error for disabled owner', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'disabled-owner-id',
          password_hash: '$2b$10$hash',
          name: 'Disabled Owner',
          status: 'disabled',
        }],
      });

      (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      await expect(
        login({ email: 'disabled@example.com', password: 'correctpass' })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'ACCOUNT_DISABLED',
        message: 'Your account has been disabled. Please contact support.',
      });
    });

    it('should allow login for active owner', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'active-owner-id',
          password_hash: '$2b$10$hash',
          name: 'Active Owner',
          status: 'active',
        }],
      });

      (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockSignToken.mockReturnValueOnce('token-active');

      const result = await login({ email: 'active@example.com', password: 'pass' });
      expect(result.token).toBe('token-active');
    });

    it('should not check status for admin (admins have no status)', async () => {
      // Owner not found
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // Admin found
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'admin-id',
          password_hash: '$2b$10$hash',
        }],
      });

      (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockSignToken.mockReturnValueOnce('admin-token');

      const result = await login({ email: 'admin@restroqr.com', password: 'adminpass' });
      expect(result.user.role).toBe('admin');
      expect(result.token).toBe('admin-token');
    });
  });

  describe('Response format', () => {
    it('should return correct response structure on success', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'uuid-owner',
          password_hash: '$2b$10$hash',
          name: 'Test Owner',
          status: 'active',
        }],
      });

      (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockSignToken.mockReturnValueOnce('jwt-token-string');

      const result = await login({ email: 'test@example.com', password: 'pass' });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('role');
      expect(result.user).toHaveProperty('name');
      expect(typeof result.token).toBe('string');
      expect(['admin', 'owner']).toContain(result.user.role);
    });
  });
});
