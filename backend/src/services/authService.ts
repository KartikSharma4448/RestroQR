import bcrypt from 'bcrypt';
import pool from '../config/database';
import { signToken } from '../utils/token';
import { AuthenticationError, ForbiddenError, ValidationError, ConflictError, ValidationDetail } from '../errors';

const BCRYPT_COST_FACTOR = 12;

export interface RegisterInput {
  email?: string;
  phone?: string;
  password: string;
  name: string;
}

export interface RegisterResult {
  token: string;
  owner: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
}

/**
 * Validates registration input and throws ValidationError if invalid.
 */
export function validateRegisterInput(input: RegisterInput): void {
  const errors: ValidationDetail[] = [];

  // Name is required and non-empty
  if (!input.name || input.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required' });
  }

  // At least one of email or phone must be provided
  const hasEmail = input.email !== undefined && input.email !== null && input.email.trim().length > 0;
  const hasPhone = input.phone !== undefined && input.phone !== null && input.phone.trim().length > 0;

  if (!hasEmail && !hasPhone) {
    errors.push({ field: 'email', message: 'At least one of email or phone must be provided' });
  }

  // Validate email format if provided
  if (hasEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email!.trim())) {
      errors.push({ field: 'email', message: 'Invalid email format' });
    }
  }

  // Validate phone format if provided (exactly 10 digits)
  if (hasPhone) {
    const phoneDigits = input.phone!.trim();
    if (!/^\d{10}$/.test(phoneDigits)) {
      errors.push({ field: 'phone', message: 'Phone must be exactly 10 digits' });
    }
  }

  // Password must be at least 8 characters
  if (!input.password || input.password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  }

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }
}

/**
 * Registers a new restaurant owner.
 * - Validates input
 * - Hashes password with bcrypt (cost factor 12)
 * - Checks for duplicate email/phone
 * - Inserts owner record
 * - Returns JWT token and owner data
 */
export async function registerOwner(input: RegisterInput): Promise<RegisterResult> {
  // Validate input
  validateRegisterInput(input);

  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;
  const name = input.name.trim();

  // Check for existing email or phone
  if (email) {
    const existingEmail = await pool.query(
      'SELECT id FROM owners WHERE email = $1',
      [email]
    );
    if (existingEmail.rows.length > 0) {
      throw new ConflictError('An account with this email already exists');
    }
  }

  if (phone) {
    const existingPhone = await pool.query(
      'SELECT id FROM owners WHERE phone = $1',
      [phone]
    );
    if (existingPhone.rows.length > 0) {
      throw new ConflictError('An account with this phone number already exists');
    }
  }

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST_FACTOR);

  // Insert owner record
  const result = await pool.query(
    `INSERT INTO owners (email, phone, password_hash, name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, phone, name`,
    [email, phone, passwordHash, name]
  );

  const owner = result.rows[0];

  // Generate JWT token
  const token = signToken(owner.id, 'owner');

  return {
    token,
    owner: {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
    },
  };
}


export interface LoginInput {
  email?: string;
  phone?: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    role: 'admin' | 'owner';
    name: string;
  };
}

/**
 * Authenticate a user (owner or admin) by email/phone + password.
 *
 * Lookup order:
 * 1. If email provided: search owners by email, then admins by email
 * 2. If phone provided: search owners by phone (admins don't have phone)
 *
 * Security: Returns identical AUTHENTICATION_FAILED error whether user
 * doesn't exist or password is wrong (no information leakage).
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  const { email, phone, password } = input;

  // Validate that at least one identifier is provided
  if (!email && !phone) {
    throw new ValidationError('Email or phone is required', [
      { field: 'email', message: 'Either email or phone must be provided' },
    ]);
  }

  if (!password) {
    throw new ValidationError('Password is required', [
      { field: 'password', message: 'Password is required' },
    ]);
  }

  let userId: string | null = null;
  let passwordHash: string | null = null;
  let role: 'admin' | 'owner' = 'owner';
  let name: string = '';
  let status: string | null = null;

  if (email) {
    // Search owners by email first
    const ownerResult = await pool.query(
      'SELECT id, password_hash, name, status FROM owners WHERE email = $1',
      [email]
    );

    if (ownerResult.rows.length > 0) {
      const owner = ownerResult.rows[0];
      userId = owner.id;
      passwordHash = owner.password_hash;
      role = 'owner';
      name = owner.name;
      status = owner.status;
    } else {
      // Search admins by email
      const adminResult = await pool.query(
        'SELECT id, password_hash FROM admins WHERE email = $1',
        [email]
      );

      if (adminResult.rows.length > 0) {
        const admin = adminResult.rows[0];
        userId = admin.id;
        passwordHash = admin.password_hash;
        role = 'admin';
        name = 'Admin';
        status = null; // Admins don't have status field
      }
    }
  } else if (phone) {
    // Search owners by phone (admins don't have phone)
    const ownerResult = await pool.query(
      'SELECT id, password_hash, name, status FROM owners WHERE phone = $1',
      [phone]
    );

    if (ownerResult.rows.length > 0) {
      const owner = ownerResult.rows[0];
      userId = owner.id;
      passwordHash = owner.password_hash;
      role = 'owner';
      name = owner.name;
      status = owner.status;
    }
  }

  // User not found — return generic auth error (no info leakage)
  if (!userId || !passwordHash) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, passwordHash);
  if (!isPasswordValid) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Check account status (only applicable to owners)
  if (role === 'owner' && status === 'disabled') {
    throw new ForbiddenError(
      'Your account has been disabled. Please contact support.',
      'ACCOUNT_DISABLED'
    );
  }

  // Generate JWT token
  const token = signToken(userId, role);

  return {
    token,
    user: {
      id: userId,
      role,
      name,
    },
  };
}
