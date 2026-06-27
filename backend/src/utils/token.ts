import jwt from 'jsonwebtoken';

export interface TokenPayload {
  sub: string;
  role: 'admin' | 'owner';
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

const DEFAULT_EXPIRY = '24h';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

export function signToken(userId: string, role: 'admin' | 'owner'): string {
  const payload: TokenPayload = { sub: userId, role };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: DEFAULT_EXPIRY });
}

export function verifyToken(token: string): DecodedToken {
  return jwt.verify(token, getJwtSecret()) as DecodedToken;
}
