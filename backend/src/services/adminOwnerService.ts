import pool from '../config/database';
import { NotFoundError, ValidationError } from '../errors';

export interface OwnerListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
}

export interface OwnerDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  restaurant: {
    id: string;
    name: string;
    status: string;
    restaurantToken: string;
  } | null;
}

/**
 * List all owner accounts with basic info.
 */
export async function listOwners(): Promise<OwnerListItem[]> {
  const result = await pool.query(
    `SELECT id, name, email, phone, status, created_at
     FROM owners
     ORDER BY created_at DESC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    createdAt: row.created_at,
  }));
}

/**
 * Get full owner details including associated restaurant.
 */
export async function getOwnerById(ownerId: string): Promise<OwnerDetail> {
  const result = await pool.query(
    `SELECT
       o.id, o.name, o.email, o.phone, o.status, o.created_at, o.updated_at,
       r.id AS restaurant_id, r.name AS restaurant_name,
       r.status AS restaurant_status, r.restaurant_token
     FROM owners o
     LEFT JOIN restaurants r ON r.owner_id = o.id
     WHERE o.id = $1`,
    [ownerId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Owner not found');
  }

  const row = result.rows[0];

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    restaurant: row.restaurant_id
      ? {
          id: row.restaurant_id,
          name: row.restaurant_name,
          status: row.restaurant_status,
          restaurantToken: row.restaurant_token,
        }
      : null,
  };
}

/**
 * Update owner account status (enable/disable).
 */
export async function updateOwnerStatus(
  ownerId: string,
  status: string
): Promise<{ id: string; status: string }> {
  if (status !== 'active' && status !== 'disabled') {
    throw new ValidationError('Invalid status value', [
      { field: 'status', message: 'Status must be "active" or "disabled"' },
    ]);
  }

  const result = await pool.query(
    `UPDATE owners SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, status`,
    [status, ownerId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Owner not found');
  }

  return {
    id: result.rows[0].id,
    status: result.rows[0].status,
  };
}
