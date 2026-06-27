import pool from '../config/database';
import { NotFoundError, ValidationError, ValidationDetail } from '../errors';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  restaurants: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface RestaurantListItem {
  id: string;
  name: string;
  ownerName: string;
  status: string;
  createdAt: string;
}

export interface RestaurantDetail {
  id: string;
  name: string;
  address: string;
  phone: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  restaurantToken: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
  };
}

export interface UpdateRestaurantInput {
  name?: string;
  address?: string;
  phone?: string;
}

/**
 * Parse and validate pagination params from query string.
 */
export function parsePaginationParams(query: {
  page?: string;
  pageSize?: string;
}): PaginationParams {
  let page = parseInt(query.page || '1', 10);
  let pageSize = parseInt(query.pageSize || '10', 10);

  if (isNaN(page) || page < 1) {
    page = 1;
  }

  if (isNaN(pageSize) || pageSize < 1) {
    pageSize = 10;
  }

  if (pageSize > 100) {
    pageSize = 100;
  }

  return { page, pageSize };
}

/**
 * Validate update restaurant input.
 */
export function validateUpdateInput(input: UpdateRestaurantInput): void {
  const errors: ValidationDetail[] = [];

  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name must be a non-empty string' });
    } else if (input.name.length > 100) {
      errors.push({ field: 'name', message: 'Name must not exceed 100 characters' });
    }
  }

  if (input.address !== undefined) {
    if (typeof input.address !== 'string' || input.address.trim().length === 0) {
      errors.push({ field: 'address', message: 'Address must be a non-empty string' });
    } else if (input.address.length > 250) {
      errors.push({ field: 'address', message: 'Address must not exceed 250 characters' });
    }
  }

  if (input.phone !== undefined) {
    if (typeof input.phone !== 'string' || input.phone.trim().length === 0) {
      errors.push({ field: 'phone', message: 'Phone must be a non-empty string' });
    } else if (input.phone.length > 20) {
      errors.push({ field: 'phone', message: 'Phone must not exceed 20 characters' });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }
}

/**
 * Get paginated list of all restaurants with owner names.
 */
export async function listRestaurants(
  params: PaginationParams
): Promise<PaginatedResult<RestaurantListItem>> {
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  // Get total count
  const countResult = await pool.query('SELECT COUNT(*) FROM restaurants');
  const total = parseInt(countResult.rows[0].count, 10);

  // Get paginated restaurants with owner name
  const result = await pool.query(
    `SELECT r.id, r.name, o.name AS owner_name, r.status, r.created_at
     FROM restaurants r
     JOIN owners o ON r.owner_id = o.id
     ORDER BY r.created_at DESC
     LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );

  const restaurants: RestaurantListItem[] = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    ownerName: row.owner_name,
    status: row.status,
    createdAt: row.created_at,
  }));

  return {
    restaurants,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Get full restaurant details by ID, including owner information.
 */
export async function getRestaurantById(id: string): Promise<RestaurantDetail> {
  const result = await pool.query(
    `SELECT r.id, r.name, r.address, r.phone, r.logo_url, r.cover_image_url,
            r.restaurant_token, r.status, r.created_at, r.updated_at,
            o.id AS owner_id, o.name AS owner_name, o.email AS owner_email,
            o.phone AS owner_phone, o.status AS owner_status
     FROM restaurants r
     JOIN owners o ON r.owner_id = o.id
     WHERE r.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Restaurant not found');
  }

  const row = result.rows[0];

  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    logoUrl: row.logo_url,
    coverImageUrl: row.cover_image_url,
    restaurantToken: row.restaurant_token,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner: {
      id: row.owner_id,
      name: row.owner_name,
      email: row.owner_email,
      phone: row.owner_phone,
      status: row.owner_status,
    },
  };
}

/**
 * Update restaurant details (name, address, phone only).
 */
export async function updateRestaurant(
  id: string,
  input: UpdateRestaurantInput
): Promise<RestaurantDetail> {
  validateUpdateInput(input);

  // Build dynamic update query
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(input.name.trim());
  }

  if (input.address !== undefined) {
    fields.push(`address = $${paramIndex++}`);
    values.push(input.address.trim());
  }

  if (input.phone !== undefined) {
    fields.push(`phone = $${paramIndex++}`);
    values.push(input.phone.trim());
  }

  if (fields.length === 0) {
    // No fields to update, just return current data
    return getRestaurantById(id);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const query = `UPDATE restaurants SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING id`;

  const result = await pool.query(query, values);

  if (result.rows.length === 0) {
    throw new NotFoundError('Restaurant not found');
  }

  return getRestaurantById(id);
}

/**
 * Update restaurant status (active/disabled).
 */
export async function updateRestaurantStatus(
  id: string,
  status: string
): Promise<{ id: string; status: string }> {
  if (status !== 'active' && status !== 'disabled') {
    throw new ValidationError('Validation failed', [
      { field: 'status', message: 'Status must be either "active" or "disabled"' },
    ]);
  }

  const result = await pool.query(
    `UPDATE restaurants SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status`,
    [status, id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Restaurant not found');
  }

  return {
    id: result.rows[0].id,
    status: result.rows[0].status,
  };
}

/**
 * Delete a restaurant and cascade delete all associated data.
 * Collects image URLs for Cloudinary cleanup before deletion.
 */
export async function deleteRestaurant(id: string): Promise<void> {
  // Verify restaurant exists
  const restaurantResult = await pool.query(
    'SELECT id, logo_url, cover_image_url FROM restaurants WHERE id = $1',
    [id]
  );

  if (restaurantResult.rows.length === 0) {
    throw new NotFoundError('Restaurant not found');
  }

  // Collect all image URLs for Cloudinary cleanup
  const imageUrls: string[] = [];
  const restaurant = restaurantResult.rows[0];

  if (restaurant.logo_url) {
    imageUrls.push(restaurant.logo_url);
  }
  if (restaurant.cover_image_url) {
    imageUrls.push(restaurant.cover_image_url);
  }

  // Collect food item images
  const foodItemImages = await pool.query(
    'SELECT image_url FROM food_items WHERE restaurant_id = $1 AND image_url IS NOT NULL',
    [id]
  );

  for (const row of foodItemImages.rows) {
    if (row.image_url) {
      imageUrls.push(row.image_url);
    }
  }

  // Delete restaurant (CASCADE will remove categories and food items via FK)
  await pool.query('DELETE FROM restaurants WHERE id = $1', [id]);

  // TODO: Call Cloudinary API to delete images
  // For now, log the URLs that would be cleaned up
  if (imageUrls.length > 0) {
    console.log(`[Cloudinary cleanup] Would delete ${imageUrls.length} images:`, imageUrls);
  }
}
