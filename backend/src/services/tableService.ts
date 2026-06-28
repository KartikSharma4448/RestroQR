import crypto from 'crypto';
import pool from '../config/database';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../errors';

/**
 * Load the 32-byte encryption key from environment variable.
 * The key must be exactly 32 bytes (hex-encoded = 64 chars, or base64-encoded = 44 chars).
 * Falls back to deriving from a passphrase using SHA-256 if raw key is not 32 bytes.
 */
function getSecretKey(): Buffer {
  const secret = process.env.TABLE_TOKEN_SECRET;
  if (!secret) {
    throw new Error('TABLE_TOKEN_SECRET environment variable is not set');
  }
  // If the secret is exactly 64 hex characters, treat as hex-encoded 32-byte key
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  // Otherwise, derive a 32-byte key from the passphrase using SHA-256
  return crypto.createHash('sha256').update(secret).digest();
}

export interface TableRecord {
  id: string;
  restaurantId: string;
  displayName: string;
  tableToken: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Maps a database row to the TableRecord interface.
 */
function mapRow(row: Record<string, unknown>): TableRecord {
  return {
    id: row.id as string,
    restaurantId: row.restaurant_id as string,
    displayName: row.display_name as string,
    tableToken: row.table_token as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Encrypts a tableId and restaurantId into a URL-safe base64 token using AES-256-GCM.
 * Format: base64url(iv[12] + authTag[16] + ciphertext)
 */
export function encryptTableToken(tableId: string, restaurantId: string): string {
  const SECRET_KEY = getSecretKey();
  const payload = `${restaurantId}:${tableId}`;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', SECRET_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

/**
 * Decrypts a URL-safe base64 token back into { restaurantId, tableId }.
 * Throws a generic error on any decryption failure to prevent information leakage.
 */
export function decryptTableToken(token: string): { restaurantId: string; tableId: string } {
  try {
    const SECRET_KEY = getSecretKey();
    const data = Buffer.from(token, 'base64url');
    if (data.length < 29) {
      // Minimum: 12 (iv) + 16 (tag) + 1 (at least 1 byte ciphertext)
      throw new Error('Invalid token');
    }
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const ciphertext = data.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', SECRET_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = decipher.update(ciphertext) + decipher.final('utf8');
    const [restaurantId, tableId] = decrypted.split(':');
    if (!restaurantId || !tableId) {
      throw new Error('Invalid token payload');
    }
    return { restaurantId, tableId };
  } catch {
    throw new NotFoundError('Menu not found');
  }
}

/**
 * Creates a new table for a restaurant.
 * Validates that the restaurant's qr_mode is 'multi' before creating.
 */
export async function createTable(
  restaurantId: string,
  displayName: string
): Promise<TableRecord> {
  // Validate display name
  if (!displayName || displayName.trim().length === 0) {
    throw new ValidationError('Validation failed', [
      { field: 'displayName', message: 'Display name is required' },
    ]);
  }
  if (displayName.trim().length > 50) {
    throw new ValidationError('Display name must not exceed 50 characters', [
      { field: 'displayName', message: 'Display name must not exceed 50 characters' },
    ]);
  }

  // Validate qr_mode is 'multi'
  const restaurantResult = await pool.query(
    'SELECT qr_mode FROM restaurants WHERE id = $1',
    [restaurantId]
  );
  if (restaurantResult.rows.length === 0) {
    throw new NotFoundError('Restaurant not found');
  }
  if (restaurantResult.rows[0].qr_mode !== 'multi') {
    throw new ForbiddenError(
      'Table management requires multi-QR mode',
      'QR_MODE_SINGLE'
    );
  }

  // Check for duplicate display name within the same restaurant
  const duplicateCheck = await pool.query(
    'SELECT id FROM tables WHERE restaurant_id = $1 AND display_name = $2',
    [restaurantId, displayName.trim()]
  );
  if (duplicateCheck.rows.length > 0) {
    throw new ConflictError('A table with this name already exists');
  }

  // Generate encrypted table token — use a temporary UUID for the table ID,
  // then update after insert (we need the DB-generated ID)
  // Instead, we insert first to get the ID, then generate and update the token
  const insertResult = await pool.query(
    `INSERT INTO tables (restaurant_id, display_name, table_token)
     VALUES ($1, $2, $3)
     RETURNING id, restaurant_id, display_name, table_token, created_at, updated_at`,
    [restaurantId, displayName.trim(), 'temp_placeholder']
  );

  const tableId = insertResult.rows[0].id as string;
  const tableToken = encryptTableToken(tableId, restaurantId);

  // Update the token with the real encrypted value
  const updateResult = await pool.query(
    `UPDATE tables SET table_token = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, restaurant_id, display_name, table_token, created_at, updated_at`,
    [tableToken, tableId]
  );

  return mapRow(updateResult.rows[0]);
}

/**
 * Lists all tables for a restaurant.
 */
export async function listTables(restaurantId: string): Promise<TableRecord[]> {
  const result = await pool.query(
    `SELECT id, restaurant_id, display_name, table_token, created_at, updated_at
     FROM tables
     WHERE restaurant_id = $1
     ORDER BY created_at ASC`,
    [restaurantId]
  );

  return result.rows.map(mapRow);
}

/**
 * Updates the display name of a table.
 */
export async function updateTable(
  tableId: string,
  restaurantId: string,
  displayName: string
): Promise<TableRecord> {
  // Validate display name
  if (!displayName || displayName.trim().length === 0) {
    throw new ValidationError('Validation failed', [
      { field: 'displayName', message: 'Display name is required' },
    ]);
  }
  if (displayName.trim().length > 50) {
    throw new ValidationError('Display name must not exceed 50 characters', [
      { field: 'displayName', message: 'Display name must not exceed 50 characters' },
    ]);
  }

  // Verify table belongs to restaurant
  const existing = await pool.query(
    'SELECT id FROM tables WHERE id = $1 AND restaurant_id = $2',
    [tableId, restaurantId]
  );
  if (existing.rows.length === 0) {
    throw new NotFoundError('Table not found');
  }

  // Check for duplicate display name within the same restaurant (excluding current table)
  const duplicateCheck = await pool.query(
    'SELECT id FROM tables WHERE restaurant_id = $1 AND display_name = $2 AND id != $3',
    [restaurantId, displayName.trim(), tableId]
  );
  if (duplicateCheck.rows.length > 0) {
    throw new ConflictError('A table with this name already exists');
  }

  const result = await pool.query(
    `UPDATE tables SET display_name = $1, updated_at = NOW()
     WHERE id = $2 AND restaurant_id = $3
     RETURNING id, restaurant_id, display_name, table_token, created_at, updated_at`,
    [displayName.trim(), tableId, restaurantId]
  );

  return mapRow(result.rows[0]);
}

/**
 * Deletes a table record.
 */
export async function deleteTable(
  tableId: string,
  restaurantId: string
): Promise<void> {
  // Verify table belongs to restaurant
  const existing = await pool.query(
    'SELECT id FROM tables WHERE id = $1 AND restaurant_id = $2',
    [tableId, restaurantId]
  );
  if (existing.rows.length === 0) {
    throw new NotFoundError('Table not found');
  }

  await pool.query(
    'DELETE FROM tables WHERE id = $1 AND restaurant_id = $2',
    [tableId, restaurantId]
  );
}

/**
 * Returns the public QR URL for a table.
 * Format: /r/{restaurant_token}/t/{table_token}
 */
export async function getTableQrUrl(
  tableId: string,
  restaurantId: string
): Promise<string> {
  // Get the restaurant token
  const restaurantResult = await pool.query(
    'SELECT restaurant_token FROM restaurants WHERE id = $1',
    [restaurantId]
  );
  if (restaurantResult.rows.length === 0) {
    throw new NotFoundError('Restaurant not found');
  }
  const restaurantToken = restaurantResult.rows[0].restaurant_token as string;

  // Get the table token
  const tableResult = await pool.query(
    'SELECT table_token FROM tables WHERE id = $1 AND restaurant_id = $2',
    [tableId, restaurantId]
  );
  if (tableResult.rows.length === 0) {
    throw new NotFoundError('Table not found');
  }
  const tableToken = tableResult.rows[0].table_token as string;

  return `/r/${restaurantToken}/t/${tableToken}`;
}
