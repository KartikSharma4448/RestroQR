import { v2 as cloudinary } from 'cloudinary';
import pool from '../config/database';
import type { PoolClient } from 'pg';
import { AppError, NotFoundError, ValidationError } from '../errors';
import type { UploadedFile } from './ownerRestaurantService';

export function profileActivationEnabled(): boolean {
  return process.env.OWNER_PROFILE_ACTIVATION_ENABLED === 'true';
}

export function validateBusinessUpi(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length > 255 ||
      !/^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9.-]{1,}$/.test(value.trim())) {
    throw new ValidationError('Enter a valid business UPI ID, not a payment URL or QR image');
  }
  // A syntactically valid VPA is not proof of bank account ownership.
  return value.trim().toLowerCase();
}

export function summarizeProfile(row: Record<string, unknown>) {
  const required = {
    emailVerified: !!row.email_verified_at,
    googleConnected: !!row.firebase_uid && !!row.google_subject && !row.requires_google_link,
    ownerPhoto: !!row.profile_image_url,
    restaurantCover: !!row.cover_image_url,
    restaurantName: typeof row.name === 'string' && !!row.name.trim(),
    restaurantAddress: typeof row.address === 'string' && !!row.address.trim(),
    businessUpi: typeof row.business_upi_id === 'string' && /^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9.-]{1,}$/.test(row.business_upi_id),
  };
  const missing = Object.entries(required).filter(([, complete]) => !complete).map(([key]) => key);
  const complete = missing.length === 0;
  const orderingEnabled = row.status === 'active' && row.owner_status === 'active' &&
    (row.onboarding_required !== true || complete);
  return { completionPercent: Math.floor((7 - missing.length) * 100 / 7), complete, missing,
    required, orderingEnabled, onboardingRequired: row.onboarding_required === true };
}

const profileSql = `SELECT r.id,r.name,r.address,r.cover_image_url,r.business_upi_id,r.status,
  r.onboarding_required,o.status AS owner_status,o.profile_image_url,o.email_verified_at,
  o.firebase_uid,o.google_subject,o.requires_google_link FROM owners o
  LEFT JOIN restaurants r ON r.owner_id=o.id`;

export async function getOwnerProfileSetup(ownerId: string) {
  if (!profileActivationEnabled()) throw new AppError('Profile setup is not enabled yet', 503, 'PROFILE_UNAVAILABLE');
  const row = (await pool.query(`${profileSql} WHERE o.id=$1`, [ownerId])).rows[0];
  if (!row) throw new NotFoundError('Owner not found');
  return { ...summarizeProfile(row), restaurantId: row.id ?? null,
    ownerPhotoUrl: row.profile_image_url ?? null, coverImageUrl: row.cover_image_url ?? null,
    businessUpiId: row.business_upi_id ?? null };
}

export async function getRestaurantOrderingState(restaurantId: string,
  client: Pick<PoolClient, 'query'> = pool, lock = false) {
  const sql = `SELECT r.id,r.name,r.address,r.cover_image_url,r.business_upi_id,r.status,
    r.onboarding_required,o.status AS owner_status,o.profile_image_url,o.email_verified_at,
    o.firebase_uid,o.google_subject,o.requires_google_link FROM restaurants r
    JOIN owners o ON o.id=r.owner_id WHERE r.id=$1${lock ? ' FOR SHARE OF r,o' : ''}`;
  const row = (await client.query(sql, [restaurantId])).rows[0];
  if (!row) throw new NotFoundError('Menu not found');
  return summarizeProfile(row);
}

export async function setBusinessUpi(ownerId: string, input: unknown) {
  if (!profileActivationEnabled()) throw new AppError('Profile setup is not enabled yet', 503, 'PROFILE_UNAVAILABLE');
  const upi = validateBusinessUpi(input);
  const result = await pool.query(
    'UPDATE restaurants SET business_upi_id=$1,updated_at=NOW() WHERE owner_id=$2 RETURNING id', [upi, ownerId],
  );
  if (!result.rows.length) throw new NotFoundError('Save restaurant details first');
  return getOwnerProfileSetup(ownerId);
}

export function validateProfileImage(file: UploadedFile) {
  const bytes = file.buffer;
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const matches =
    (file.mimetype === 'image/jpeg' && bytes.length >= 12 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) ||
    (file.mimetype === 'image/png' && bytes.length >= 12 && bytes.subarray(0, 8).equals(png)) ||
    (file.mimetype === 'image/webp' && bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
  if (!matches || bytes.length > 5 * 1024 * 1024 || file.size !== bytes.length) {
    throw new ValidationError('Choose a JPEG, PNG or WebP image up to 5MB');
  }
}

async function upload(file: UploadedFile, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder, resource_type: 'image', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      format: 'jpg', transformation: [{ width: 1600, height: 1600, crop: 'limit' }, { quality: 'auto:good' }],
    }, (error, result) => {
      if (error || !result?.secure_url?.startsWith('https://')) {
        reject(new AppError('Image upload failed. Please try again.', 503, 'IMAGE_UPLOAD_FAILED'));
      } else resolve(result.secure_url);
    });
    stream.end(file.buffer);
  });
}

export async function uploadOwnerProfileImages(ownerId: string, files: { ownerPhoto?: UploadedFile; cover?: UploadedFile }) {
  if (!profileActivationEnabled()) throw new AppError('Profile setup is not enabled yet', 503, 'PROFILE_UNAVAILABLE');
  if (!files.ownerPhoto && !files.cover) throw new ValidationError('Choose an image');
  for (const file of Object.values(files)) if (file) validateProfileImage(file);
  const current = await getOwnerProfileSetup(ownerId);
  if (!current.restaurantId) throw new NotFoundError('Save restaurant details first');
  // No placeholder URLs: only a successful image-provider upload counts toward activation.
  if (!process.env.CLOUDINARY_URL) throw new AppError('Image storage is not configured', 503, 'IMAGE_STORAGE_UNAVAILABLE');
  try {
    const config = new URL(process.env.CLOUDINARY_URL);
    cloudinary.config({ cloud_name: config.hostname, api_key: decodeURIComponent(config.username),
      api_secret: decodeURIComponent(config.password), secure: true });
  } catch { throw new AppError('Image storage is not configured', 503, 'IMAGE_STORAGE_UNAVAILABLE'); }
  const ownerUrl = files.ownerPhoto ? await upload(files.ownerPhoto, `restroqr/${current.restaurantId}/owner`) : null;
  const coverUrl = files.cover ? await upload(files.cover, `restroqr/${current.restaurantId}/cover`) : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (ownerUrl) await client.query('UPDATE owners SET profile_image_url=$1,updated_at=NOW() WHERE id=$2', [ownerUrl, ownerId]);
    if (coverUrl) await client.query('UPDATE restaurants SET cover_image_url=$1,updated_at=NOW() WHERE owner_id=$2', [coverUrl, ownerId]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  return getOwnerProfileSetup(ownerId);
}
