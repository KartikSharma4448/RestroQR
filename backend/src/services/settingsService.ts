import pool from '../config/database';
import { ValidationError, NotFoundError } from '../errors';

export type QrMode = 'single' | 'multi';

const VALID_QR_MODES: QrMode[] = ['single', 'multi'];

/**
 * Validates that the provided qrMode value is exactly 'single' or 'multi'.
 * Throws a ValidationError for any other value.
 */
export function validateQrMode(qrMode: unknown): asserts qrMode is QrMode {
  if (typeof qrMode !== 'string' || !VALID_QR_MODES.includes(qrMode as QrMode)) {
    throw new ValidationError('Validation failed', [
      { field: 'qrMode', message: "qrMode must be 'single' or 'multi'" },
    ]);
  }
}

/**
 * Updates the QR mode for a restaurant.
 * Validates that the mode is 'single' or 'multi', then updates the restaurant record.
 * Mode switches preserve all existing table and order data — only the qr_mode column is changed.
 */
export async function updateQrMode(
  restaurantId: string,
  qrMode: unknown
): Promise<{ qrMode: QrMode }> {
  // Validate input
  validateQrMode(qrMode);

  // Verify restaurant exists
  const existing = await pool.query(
    'SELECT id FROM restaurants WHERE id = $1',
    [restaurantId]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError('Restaurant not found');
  }

  // Update only the qr_mode column — tables and orders are preserved
  await pool.query(
    'UPDATE restaurants SET qr_mode = $1, updated_at = NOW() WHERE id = $2',
    [qrMode, restaurantId]
  );

  return { qrMode };
}

/**
 * Gets the current QR mode for a restaurant.
 */
export async function getQrMode(restaurantId: string): Promise<{ qrMode: QrMode }> {
  const result = await pool.query(
    'SELECT qr_mode FROM restaurants WHERE id = $1',
    [restaurantId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Restaurant not found');
  }

  return { qrMode: result.rows[0].qr_mode as QrMode };
}
