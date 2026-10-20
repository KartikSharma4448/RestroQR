import { v2 as cloudinary } from 'cloudinary';
import pool from '../config/database';
import { AppError, NotFoundError, ValidationError } from '../errors';
import { verifyItemOwnership } from './foodItemService';
import { validateProfileImage } from './restaurantProfileService';
import type { UploadedFile } from './ownerRestaurantService';

export const menuMediaEnabled = () => process.env.MENU_MEDIA_ENABLED === 'true';

function requireEnabled() {
  if (!menuMediaEnabled()) throw new AppError('Menu media is not enabled yet', 503, 'MENU_MEDIA_UNAVAILABLE');
}

export function validateMenuEmoji(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 64 ||
      !/^\p{Extended_Pictographic}(?:\uFE0F)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?(?:\p{Emoji_Modifier})?)*$/u.test(value)) {
    throw new ValidationError('Choose one emoji');
  }
  return value;
}

export async function setMenuEmoji(itemId: string, restaurantId: string, input: unknown) {
  requireEnabled();
  const emoji = validateMenuEmoji(input);
  const result = await pool.query(
    `UPDATE food_items SET emoji=$1,image_url=NULL,updated_at=NOW()
     WHERE id=$2 AND restaurant_id=$3 RETURNING id,image_url AS "imageUrl",emoji`,
    [emoji, itemId, restaurantId]);
  if (!result.rows.length) throw new NotFoundError('Food item not found');
  return result.rows[0];
}

export async function uploadMenuImage(itemId: string, restaurantId: string, file?: UploadedFile) {
  requireEnabled();
  if (!file) throw new ValidationError('Choose an image');
  validateProfileImage(file);
  await verifyItemOwnership(itemId, restaurantId);
  try {
    const config = new URL(process.env.CLOUDINARY_URL || '');
    if (config.protocol !== 'cloudinary:' || !config.username || !config.password || !config.hostname) throw new Error();
    cloudinary.config({ cloud_name: config.hostname, api_key: decodeURIComponent(config.username),
      api_secret: decodeURIComponent(config.password), secure: true });
  } catch { throw new AppError('Image storage is not configured', 503, 'IMAGE_STORAGE_UNAVAILABLE'); }
  const uploaded = await new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: `restroqr/${restaurantId}/menu`, resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], format: 'jpg', timeout: 30000,
      transformation: [{ width: 1200, height: 1200, crop: 'limit' }, { quality: 'auto:good' }],
    }, (error, result) => {
      if (error || !result?.secure_url?.startsWith('https://') || !result.public_id) {
        reject(new AppError('Image upload failed. Please try again.', 503, 'IMAGE_UPLOAD_FAILED'));
      } else resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.end(file.buffer);
  });
  try {
    const result = await pool.query(
      `UPDATE food_items SET image_url=$1,emoji=NULL,updated_at=NOW()
       WHERE id=$2 AND restaurant_id=$3 RETURNING id,image_url AS "imageUrl",emoji`,
      [uploaded.url, itemId, restaurantId]);
    if (!result.rows.length) throw new NotFoundError('Food item not found');
    return result.rows[0];
  } catch (error) {
    // Only the newly uploaded orphan is eligible for cleanup, never old assets.
    const cleanupOptions = { resource_type: 'image' as const, timeout: 20000 };
    try { await cloudinary.uploader.destroy(uploaded.publicId, cleanupOptions); }
    catch { /* Retain the original error without exposing provider credentials. */ }
    throw error;
  }
}
