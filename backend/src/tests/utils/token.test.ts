import jwt from 'jsonwebtoken';
import { signToken, verifyToken, DecodedToken } from '../../utils/token';

const TEST_SECRET = 'test-secret-key-for-jwt';

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

describe('signToken', () => {
  it('should generate a valid JWT for an admin', () => {
    const token = signToken('admin-123', 'admin');
    const decoded = jwt.verify(token, TEST_SECRET) as DecodedToken;

    expect(decoded.sub).toBe('admin-123');
    expect(decoded.role).toBe('admin');
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
  });

  it('should generate a valid JWT for an owner', () => {
    const token = signToken('owner-456', 'owner');
    const decoded = jwt.verify(token, TEST_SECRET) as DecodedToken;

    expect(decoded.sub).toBe('owner-456');
    expect(decoded.role).toBe('owner');
  });

  it('should set expiry to 24 hours from now', () => {
    const token = signToken('user-1', 'admin');
    const decoded = jwt.verify(token, TEST_SECRET) as DecodedToken;

    const expectedExpiry = decoded.iat + 24 * 60 * 60;
    expect(decoded.exp).toBe(expectedExpiry);
  });

  it('should throw if JWT_SECRET is not set', () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    expect(() => signToken('user-1', 'admin')).toThrow(
      'JWT_SECRET environment variable is not set'
    );

    process.env.JWT_SECRET = original;
  });
});

describe('verifyToken', () => {
  it('should decode a valid token', () => {
    const token = signToken('user-789', 'owner');
    const decoded = verifyToken(token);

    expect(decoded.sub).toBe('user-789');
    expect(decoded.role).toBe('owner');
  });

  it('should throw for an invalid token', () => {
    expect(() => verifyToken('invalid-token')).toThrow();
  });

  it('should throw for a token signed with a different secret', () => {
    const token = jwt.sign({ sub: 'user-1', role: 'admin' }, 'wrong-secret');
    expect(() => verifyToken(token)).toThrow();
  });

  it('should throw for an expired token', () => {
    const token = jwt.sign(
      { sub: 'user-1', role: 'admin' },
      TEST_SECRET,
      { expiresIn: '-1s' }
    );
    expect(() => verifyToken(token)).toThrow();
  });
});
