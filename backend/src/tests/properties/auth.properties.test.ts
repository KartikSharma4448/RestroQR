// Feature: restroqr-v1-digital-menu, Property 5: Disabled owner account blocks authentication
// Feature: restroqr-v1-digital-menu, Property 6: Re-enabling an owner account restores authentication
// Feature: restroqr-v1-digital-menu, Property 7: Registration input validation
// Feature: restroqr-v1-digital-menu, Property 8: Authentication error uniformity

import { fc, FC_DEFAULT_NUM_RUNS, assertProperty } from '../helpers/fast-check';
import { AuthenticationError, ForbiddenError, ValidationError } from '../../errors';

// Mock database pool
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
}));

// Mock token utility
jest.mock('../../utils/token', () => ({
  signToken: jest.fn().mockReturnValue('mocked-jwt-token'),
}));

import pool from '../../config/database';
import bcrypt from 'bcrypt';
import { login, validateRegisterInput, RegisterInput } from '../../services/authService';

const mockPool = pool as jest.Mocked<typeof pool>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// --- Generators ---

const validEmailArb: fc.Arbitrary<string> = fc.emailAddress();

const validPhoneArb: fc.Arbitrary<string> = fc.stringMatching(/^[0-9]{10}$/);

const validPasswordArb: fc.Arbitrary<string> = fc.string({ minLength: 8, maxLength: 50 });

const validNameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 100 }).filter(
  (s: string) => s.trim().length > 0
);

const ownerIdArb: fc.Arbitrary<string> = fc.uuid();

// --- Property 5: Disabled owner account blocks authentication ---
// **Validates: Requirements 2.3, 3.5**

describe('Property 5: Disabled owner account blocks authentication', () => {
  it('should throw ForbiddenError with ACCOUNT_DISABLED code when owner is disabled', async () => {
    await assertProperty(
      fc.asyncProperty(
        validEmailArb,
        validPasswordArb,
        ownerIdArb,
        async (email: string, password: string, ownerId: string) => {
          // Mock: owner exists with status='disabled', password is valid
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('owners') && query.includes('email')) {
              return Promise.resolve({
                rows: [{
                  id: ownerId,
                  password_hash: '$2b$12$hashed',
                  name: 'Test Owner',
                  status: 'disabled',
                }],
              });
            }
            if (query.includes('admins')) {
              return Promise.resolve({ rows: [] });
            }
            return Promise.resolve({ rows: [] });
          });
          (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

          try {
            await login({ email, password });
            // Should not reach here
            throw new Error('Expected ForbiddenError was not thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(ForbiddenError);
            expect((error as ForbiddenError).code).toBe('ACCOUNT_DISABLED');
            expect((error as ForbiddenError).statusCode).toBe(403);
          }
        }
      )
    );
  });

  it('should throw ForbiddenError when disabled owner logs in via phone', async () => {
    await assertProperty(
      fc.asyncProperty(
        validPhoneArb,
        validPasswordArb,
        ownerIdArb,
        async (phone: string, password: string, ownerId: string) => {
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('owners') && query.includes('phone')) {
              return Promise.resolve({
                rows: [{
                  id: ownerId,
                  password_hash: '$2b$12$hashed',
                  name: 'Test Owner',
                  status: 'disabled',
                }],
              });
            }
            return Promise.resolve({ rows: [] });
          });
          (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

          try {
            await login({ phone, password });
            throw new Error('Expected ForbiddenError was not thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(ForbiddenError);
            expect((error as ForbiddenError).code).toBe('ACCOUNT_DISABLED');
          }
        }
      )
    );
  });
});

// --- Property 6: Re-enabling an owner account restores authentication ---
// **Validates: Requirements 2.4**

describe('Property 6: Re-enabling an owner account restores authentication', () => {
  it('should return token and user data when re-enabled owner logs in', async () => {
    await assertProperty(
      fc.asyncProperty(
        validEmailArb,
        validPasswordArb,
        ownerIdArb,
        validNameArb,
        async (email: string, password: string, ownerId: string, name: string) => {
          // Mock: owner exists with status='active' (re-enabled), password is valid
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('owners') && query.includes('email')) {
              return Promise.resolve({
                rows: [{
                  id: ownerId,
                  password_hash: '$2b$12$hashed',
                  name: name,
                  status: 'active',
                }],
              });
            }
            if (query.includes('admins')) {
              return Promise.resolve({ rows: [] });
            }
            return Promise.resolve({ rows: [] });
          });
          (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

          const result = await login({ email, password });

          expect(result).toBeDefined();
          expect(result.token).toBe('mocked-jwt-token');
          expect(result.user).toBeDefined();
          expect(result.user.id).toBe(ownerId);
          expect(result.user.role).toBe('owner');
          expect(result.user.name).toBe(name);
        }
      )
    );
  });

  it('should return token and user data when re-enabled owner logs in via phone', async () => {
    await assertProperty(
      fc.asyncProperty(
        validPhoneArb,
        validPasswordArb,
        ownerIdArb,
        validNameArb,
        async (phone: string, password: string, ownerId: string, name: string) => {
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('owners') && query.includes('phone')) {
              return Promise.resolve({
                rows: [{
                  id: ownerId,
                  password_hash: '$2b$12$hashed',
                  name: name,
                  status: 'active',
                }],
              });
            }
            return Promise.resolve({ rows: [] });
          });
          (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

          const result = await login({ phone, password });

          expect(result).toBeDefined();
          expect(result.token).toBe('mocked-jwt-token');
          expect(result.user.id).toBe(ownerId);
          expect(result.user.role).toBe('owner');
        }
      )
    );
  });
});

// --- Property 7: Registration input validation ---
// **Validates: Requirements 3.1, 3.4, 3.6**

describe('Property 7: Registration input validation', () => {
  it('should accept valid input with email and valid password', () => {
    assertProperty(
      fc.property(
        validEmailArb,
        validPasswordArb,
        validNameArb,
        (email: string, password: string, name: string) => {
          expect(() => validateRegisterInput({ email, password, name })).not.toThrow();
        }
      )
    );
  });

  it('should accept valid input with phone and valid password', () => {
    assertProperty(
      fc.property(
        validPhoneArb,
        validPasswordArb,
        validNameArb,
        (phone: string, password: string, name: string) => {
          expect(() => validateRegisterInput({ phone, password, name })).not.toThrow();
        }
      )
    );
  });

  it('should accept valid input with both email and phone', () => {
    assertProperty(
      fc.property(
        validEmailArb,
        validPhoneArb,
        validPasswordArb,
        validNameArb,
        (email: string, phone: string, password: string, name: string) => {
          expect(() => validateRegisterInput({ email, phone, password, name })).not.toThrow();
        }
      )
    );
  });

  it('should reject input when neither email nor phone is provided', () => {
    assertProperty(
      fc.property(
        validPasswordArb,
        validNameArb,
        (password: string, name: string) => {
          expect(() => validateRegisterInput({ password, name })).toThrow(ValidationError);
        }
      )
    );
  });

  it('should reject input with password less than 8 characters', () => {
    const shortPasswordArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 7 });

    assertProperty(
      fc.property(
        validEmailArb,
        shortPasswordArb,
        validNameArb,
        (email: string, password: string, name: string) => {
          expect(() => validateRegisterInput({ email, password, name })).toThrow(ValidationError);
        }
      )
    );
  });

  it('should reject input with invalid phone (not exactly 10 digits)', () => {
    const invalidPhoneArb: fc.Arbitrary<string> = fc.oneof(
      // Too short (1-9 digits)
      fc.stringMatching(/^[0-9]{1,9}$/),
      // Too long (11-15 digits)
      fc.stringMatching(/^[0-9]{11,15}$/),
      // Contains non-digit characters (at least 1 char, not all digits of length 10)
      fc.stringMatching(/^[a-z]{1,10}$/)
    );

    assertProperty(
      fc.property(
        invalidPhoneArb,
        validPasswordArb,
        validNameArb,
        (phone: string, password: string, name: string) => {
          expect(() => validateRegisterInput({ phone, password, name })).toThrow(ValidationError);
        }
      )
    );
  });

  it('should reject input with empty password', () => {
    assertProperty(
      fc.property(
        validEmailArb,
        validNameArb,
        (email: string, name: string) => {
          expect(() => validateRegisterInput({ email, password: '', name })).toThrow(ValidationError);
        }
      )
    );
  });

  // Boundary tests
  it('should accept password of exactly 8 characters', () => {
    const eightCharPasswordArb: fc.Arbitrary<string> = fc.stringMatching(/^.{8}$/);

    assertProperty(
      fc.property(
        validEmailArb,
        eightCharPasswordArb,
        validNameArb,
        (email: string, password: string, name: string) => {
          expect(() => validateRegisterInput({ email, password, name })).not.toThrow();
        }
      )
    );
  });

  it('should reject password of exactly 7 characters', () => {
    const sevenCharPasswordArb: fc.Arbitrary<string> = fc.stringMatching(/^.{7}$/);

    assertProperty(
      fc.property(
        validEmailArb,
        sevenCharPasswordArb,
        validNameArb,
        (email: string, password: string, name: string) => {
          expect(() => validateRegisterInput({ email, password, name })).toThrow(ValidationError);
        }
      )
    );
  });

  it('should accept phone of exactly 10 digits', () => {
    assertProperty(
      fc.property(
        validPhoneArb,
        validPasswordArb,
        validNameArb,
        (phone: string, password: string, name: string) => {
          expect(() => validateRegisterInput({ phone, password, name })).not.toThrow();
        }
      )
    );
  });

  it('should reject phone of exactly 9 digits', () => {
    const nineDigitPhoneArb: fc.Arbitrary<string> = fc.stringMatching(/^[0-9]{9}$/);

    assertProperty(
      fc.property(
        nineDigitPhoneArb,
        validPasswordArb,
        validNameArb,
        (phone: string, password: string, name: string) => {
          expect(() => validateRegisterInput({ phone, password, name })).toThrow(ValidationError);
        }
      )
    );
  });
});

// --- Property 8: Authentication error uniformity ---
// **Validates: Requirements 3.3**

describe('Property 8: Authentication error uniformity', () => {
  it('should return identical error for non-existent user and wrong password', async () => {
    await assertProperty(
      fc.asyncProperty(
        validEmailArb,
        validPasswordArb,
        ownerIdArb,
        async (email: string, password: string, ownerId: string) => {
          // Case 1: User not found (neither owner nor admin)
          (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

          let error1: AuthenticationError | null = null;
          try {
            await login({ email, password });
          } catch (error) {
            error1 = error as AuthenticationError;
          }

          // Case 2: User found but wrong password
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('owners') && query.includes('email')) {
              return Promise.resolve({
                rows: [{
                  id: ownerId,
                  password_hash: '$2b$12$hashed',
                  name: 'Test Owner',
                  status: 'active',
                }],
              });
            }
            if (query.includes('admins')) {
              return Promise.resolve({ rows: [] });
            }
            return Promise.resolve({ rows: [] });
          });
          (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

          let error2: AuthenticationError | null = null;
          try {
            await login({ email, password });
          } catch (error) {
            error2 = error as AuthenticationError;
          }

          // Both errors must exist and be identical in structure
          expect(error1).not.toBeNull();
          expect(error2).not.toBeNull();
          expect(error1).toBeInstanceOf(AuthenticationError);
          expect(error2).toBeInstanceOf(AuthenticationError);
          expect(error1!.code).toBe(error2!.code);
          expect(error1!.message).toBe(error2!.message);
          expect(error1!.statusCode).toBe(error2!.statusCode);
        }
      )
    );
  });

  it('should return identical error for non-existent phone and wrong password with phone', async () => {
    await assertProperty(
      fc.asyncProperty(
        validPhoneArb,
        validPasswordArb,
        ownerIdArb,
        async (phone: string, password: string, ownerId: string) => {
          // Case 1: Phone not found
          (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

          let error1: AuthenticationError | null = null;
          try {
            await login({ phone, password });
          } catch (error) {
            error1 = error as AuthenticationError;
          }

          // Case 2: User found but wrong password
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('owners') && query.includes('phone')) {
              return Promise.resolve({
                rows: [{
                  id: ownerId,
                  password_hash: '$2b$12$hashed',
                  name: 'Test Owner',
                  status: 'active',
                }],
              });
            }
            return Promise.resolve({ rows: [] });
          });
          (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

          let error2: AuthenticationError | null = null;
          try {
            await login({ phone, password });
          } catch (error) {
            error2 = error as AuthenticationError;
          }

          // Both should produce identical error structure
          expect(error1).not.toBeNull();
          expect(error2).not.toBeNull();
          expect(error1).toBeInstanceOf(AuthenticationError);
          expect(error2).toBeInstanceOf(AuthenticationError);
          expect(error1!.code).toBe(error2!.code);
          expect(error1!.message).toBe(error2!.message);
          expect(error1!.statusCode).toBe(error2!.statusCode);
          // Verify they use generic code
          expect(error1!.code).toBe('AUTHENTICATION_FAILED');
        }
      )
    );
  });
});
