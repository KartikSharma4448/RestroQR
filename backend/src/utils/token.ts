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

const MIN_SECRET_LENGTH = 32;
const KNOWN_WEAK_SECRETS = [
  'change-this-to-a-secure-random-secret',
  'your-jwt-secret-here',
  'secret',
  'jwt-secret',
];

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  // Block known placeholder secrets
  if (KNOWN_WEAK_SECRETS.includes(secret.toLowerCase())) {
    throw new Error(
      'JWT_SECRET is set to a known weak/placeholder value. ' +
      'Generate a strong secret: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
  }

  // Enforce minimum length
  if (secret.length < MIN_SECRET_LENGTH) {
    const msg = `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (current: ${secret.length}). ` +
      'Generate a strong secret: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg);
    }
    console.warn(`[SECURITY WARNING] ${msg}`);
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
