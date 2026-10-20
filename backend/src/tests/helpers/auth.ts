import * as crypto from 'crypto';

/**
 * Minimal JWT implementation for test token generation.
 * Does NOT use jsonwebtoken library — we create tokens directly
 * so tests don't depend on the app's auth module being implemented yet.
 */

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';

interface TokenPayload {
  sub: string;       // user ID
  role: 'owner' | 'admin';
  email?: string;
  iat?: number;
  exp?: number;
}

function base64urlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createSignature(headerPayload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(headerPayload)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Generate a valid JWT token for test requests.
 *
 * @param payload - The token payload (sub, role, etc.)
 * @param options - Optional overrides for expiration and secret
 * @returns A signed JWT string
 */
export function generateTestToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  options?: {
    expiresInSeconds?: number;
    secret?: string;
  }
): string {
  const secret = options?.secret || TEST_JWT_SECRET;
  const expiresIn = options?.expiresInSeconds ?? 3600; // 1 hour default

  const now = Math.floor(Date.now() / 1000);

  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64urlEncode(JSON.stringify(fullPayload));
  const signature = createSignature(`${header}.${body}`, secret);

  return `${header}.${body}.${signature}`;
}

/**
 * Generate a test token for an owner user.
 */
export function generateOwnerToken(ownerId: string, email?: string): string {
  return generateTestToken({
    sub: ownerId,
    role: 'owner',
    email,
  });
}

/**
 * Generate a test token for an admin user.
 */
export function generateAdminToken(adminId: string, email?: string): string {
  return generateTestToken({
    sub: adminId,
    role: 'admin',
    email,
  });
}

/**
 * Generate an expired token for testing auth rejection.
 */
export function generateExpiredToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>
): string {
  return generateTestToken(payload, { expiresInSeconds: -3600 });
}

/**
 * Generate a token with an invalid signature for testing auth rejection.
 */
export function generateInvalidToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>
): string {
  return generateTestToken(payload, { secret: 'wrong-secret-key' });
}

/**
 * Returns the Authorization header value for use with supertest.
 */
export function authHeader(token: string): string {
  return `Bearer ${token}`;
}
