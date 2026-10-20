import { customAlphabet } from 'nanoid';
import { v2 as cloudinary } from 'cloudinary';
import pool from '../config/database';
import {
  ValidationError,
  ValidationDetail,
  NotFoundError,
  ConflictError,
  FileTooLargeError,
  UnsupportedFormatError,
} from '../errors';

const generateToken = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  10
);

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface CreateRestaurantInput {
  name: string;
  address: string;
  phone: string;
  ownerId: string;
}

export interface UpdateRestaurantInput {
  name?: string;
  address?: string;
  phone?: string;
}

export interface RestaurantRecord {
  id: string;
  name: string;
  address: string;
  phone: string;
  restaurantToken: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  status: string;
  qrMode: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Validates restaurant profile input fields.
 */
export function validateRestaurantInput(
  input: Partial<CreateRestaurantInput>,
  isCreate: boolean
): void {
  const errors: ValidationDetail[] = [];

  if (isCreate || input.name !== undefined) {
    if (!input.name || input.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name is required' });
    } else if (input.name.trim().length > 100) {
      errors.push({ field: 'name', message: 'Name must not exceed 100 characters' });
    }
  }

  if (isCreate || input.address !== undefined) {
    if (!input.address || input.address.trim().length === 0) {
      errors.push({ field: 'address', message: 'Address is required' });
    } else if (input.address.trim().length > 250) {
      errors.push({ field: 'address', message: 'Address must not exceed 250 characters' });
    }
  }

  if (isCreate || input.phone !== undefined) {
    if (!input.phone || input.phone.trim().length === 0) {
      errors.push({ field: 'phone', message: 'Phone is required' });
    } else if (input.phone.trim().length > 20) {
      errors.push({ field: 'phone', message: 'Phone must not exceed 20 characters' });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }
}

/**
 * Validates uploaded image files for type and size.
 */
export function validateImageFile(file: UploadedFile): void {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new UnsupportedFormatError(
      `File format '${file.mimetype}' is not supported. Allowed: JPEG, PNG, WebP`
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new FileTooLargeError(
      `File '${file.originalname}' exceeds the 5MB size limit`
    );
  }
}

/**
 * Generates a unique restaurant token, retrying on collision.
 */
async function generateUniqueToken(maxRetries: number = 5): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const token = generateToken();
    const existing = await pool.query(
      'SELECT id FROM restaurants WHERE restaurant_token = $1',
      [token]
    );
    if (existing.rows.length === 0) {
      return token;
    }
  }
  throw new Error('Failed to generate unique restaurant token after multiple attempts');
}

/**
 * Maps a database row to the RestaurantRecord interface.
 */
function mapRow(row: Record<string, unknown>): RestaurantRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    address: row.address as string,
    phone: row.phone as string,
    restaurantToken: row.restaurant_token as string,
    logoUrl: (row.logo_url as string) || null,
    coverImageUrl: (row.cover_image_url as string) || null,
    status: row.status as string,
    qrMode: (row.qr_mode as string) || 'single',
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Creates a new restaurant profile for an owner.
 */
export async function createRestaurant(input: CreateRestaurantInput): Promise<RestaurantRecord> {
  validateRestaurantInput(input, true);

  // Check 1:1 constraint — owner can only have one restaurant
  const existing = await pool.query(
    'SELECT id FROM restaurants WHERE owner_id = $1',
    [input.ownerId]
  );

  if (existing.rows.length > 0) {
    throw new ConflictError('You already have a restaurant profile');
  }

  // Generate unique token
  const restaurantToken = await generateUniqueToken();

  // Insert restaurant record
  const result = await pool.query(
    `INSERT INTO restaurants (owner_id, name, address, phone, restaurant_token, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     RETURNING id, owner_id, name, address, phone, logo_url, cover_image_url, restaurant_token, status, qr_mode, created_at, updated_at`,
    [input.ownerId, input.name.trim(), input.address.trim(), input.phone.trim(), restaurantToken]
  );

  return mapRow(result.rows[0]);
}

/**
 * Gets the restaurant profile for an owner.
 */
export async function getRestaurantByOwner(ownerId: string): Promise<RestaurantRecord> {
  const result = await pool.query(
    `SELECT id, owner_id, name, address, phone, logo_url, cover_image_url, restaurant_token, status, qr_mode, created_at, updated_at
     FROM restaurants WHERE owner_id = $1`,
    [ownerId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Restaurant profile not found. Please create one first.');
  }

  return mapRow(result.rows[0]);
}

/**
 * Updates an existing restaurant profile.
 * Prevents modification of restaurant_token (immutable).
 */
export async function updateRestaurant(
  ownerId: string,
  input: UpdateRestaurantInput
): Promise<RestaurantRecord> {
  // Validate provided fields
  validateRestaurantInput(input as Partial<CreateRestaurantInput>, false);

  // Lookup restaurant
  const existing = await pool.query(
    'SELECT id FROM restaurants WHERE owner_id = $1',
    [ownerId]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError('Restaurant profile not found');
  }

  const restaurantId = existing.rows[0].id;

  // Build dynamic update query
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(input.name.trim());
  }

  if (input.address !== undefined) {
    setClauses.push(`address = $${paramIndex++}`);
    values.push(input.address.trim());
  }

  if (input.phone !== undefined) {
    setClauses.push(`phone = $${paramIndex++}`);
    values.push(input.phone.trim());
  }

  if (setClauses.length === 0) {
    // No fields to update — return current state
    return getRestaurantByOwner(ownerId);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(restaurantId);

  const result = await pool.query(
    `UPDATE restaurants SET ${setClauses.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, owner_id, name, address, phone, logo_url, cover_image_url, restaurant_token, status, qr_mode, created_at, updated_at`,
    values
  );

  return mapRow(result.rows[0]);
}

/**
 * Uploads images (logo and/or cover) to Cloudinary and stores URLs.
 */
export async function uploadImages(
  ownerId: string,
  files: { logo?: UploadedFile; cover?: UploadedFile }
): Promise<{ logoUrl: string | null; coverImageUrl: string | null }> {
  // Lookup restaurant
  const existing = await pool.query(
    'SELECT id, logo_url, cover_image_url FROM restaurants WHERE owner_id = $1',
    [ownerId]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError('Restaurant profile not found');
  }

  const restaurant = existing.rows[0];
  let logoUrl: string | null = restaurant.logo_url;
  let coverImageUrl: string | null = restaurant.cover_image_url;

  // Validate files
  if (files.logo) {
    validateImageFile(files.logo);
  }
  if (files.cover) {
    validateImageFile(files.cover);
  }

  // Upload to Cloudinary (or mock in development)
  const isCloudinaryConfigured = !!(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET)
  );

  if (isCloudinaryConfigured) {
    if (process.env.CLOUDINARY_URL) {
      // cloudinary auto-configures from CLOUDINARY_URL env
    } else {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }

    if (files.logo) {
      const result = await uploadToCloudinary(files.logo, `restroqr/${restaurant.id}/logo`);
      logoUrl = result.secure_url;
    }

    if (files.cover) {
      const result = await uploadToCloudinary(files.cover, `restroqr/${restaurant.id}/cover`);
      coverImageUrl = result.secure_url;
    }
  } else {
    // Development fallback — generate placeholder URLs
    if (files.logo) {
      logoUrl = `https://placeholder.restroqr.com/logos/${restaurant.id}.png`;
    }
    if (files.cover) {
      coverImageUrl = `https://placeholder.restroqr.com/covers/${restaurant.id}.png`;
    }
  }

  // Update database
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (files.logo) {
    setClauses.push(`logo_url = $${paramIndex++}`);
    values.push(logoUrl);
  }

  if (files.cover) {
    setClauses.push(`cover_image_url = $${paramIndex++}`);
    values.push(coverImageUrl);
  }

  if (setClauses.length > 0) {
    setClauses.push(`updated_at = NOW()`);
    values.push(restaurant.id);

    await pool.query(
      `UPDATE restaurants SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }

  return { logoUrl, coverImageUrl };
}

/**
 * Uploads a file buffer to Cloudinary.
 */
function uploadToCloudinary(
  file: UploadedFile,
  publicId: string
): Promise<{ secure_url: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: 800, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({ secure_url: result!.secure_url });
        }
      }
    );
    uploadStream.end(file.buffer);
  });
}
