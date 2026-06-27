import pool from '../config/database';
import {
  ValidationError,
  ValidationDetail,
  NotFoundError,
  ConflictError,
} from '../errors';

export interface CategoryRecord {
  id: string;
  name: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Maps a database row to the CategoryRecord interface.
 */
function mapRow(row: Record<string, unknown>): CategoryRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    displayOrder: row.display_order as number,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Validates category name: 1-50 chars, non-empty after trim.
 */
export function validateCategoryName(name: unknown): string {
  const errors: ValidationDetail[] = [];

  if (name === undefined || name === null || typeof name !== 'string' || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (name.trim().length > 50) {
    errors.push({ field: 'name', message: 'Name must not exceed 50 characters' });
  }

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }

  return (name as string).trim();
}

/**
 * Gets the restaurant ID for an owner. Throws NotFoundError if not found.
 */
export async function getRestaurantIdForOwner(ownerId: string): Promise<string> {
  const result = await pool.query(
    'SELECT id FROM restaurants WHERE owner_id = $1',
    [ownerId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Restaurant profile not found. Please create one first.');
  }

  return result.rows[0].id;
}

/**
 * Creates a new category for a restaurant.
 */
export async function createCategory(
  restaurantId: string,
  name: string
): Promise<CategoryRecord> {
  const trimmedName = validateCategoryName(name);

  // Check case-insensitive uniqueness
  const existing = await pool.query(
    'SELECT id FROM categories WHERE restaurant_id = $1 AND LOWER(name) = LOWER($2)',
    [restaurantId, trimmedName]
  );

  if (existing.rows.length > 0) {
    throw new ConflictError('A category with this name already exists');
  }

  // Get max display_order for the restaurant
  const maxOrderResult = await pool.query(
    'SELECT COALESCE(MAX(display_order), 0) AS max_order FROM categories WHERE restaurant_id = $1',
    [restaurantId]
  );
  const nextOrder = (maxOrderResult.rows[0].max_order as number) + 1;

  // Insert category
  const result = await pool.query(
    `INSERT INTO categories (restaurant_id, name, display_order)
     VALUES ($1, $2, $3)
     RETURNING id, name, display_order, created_at, updated_at`,
    [restaurantId, trimmedName, nextOrder]
  );

  return mapRow(result.rows[0]);
}

/**
 * Lists all categories for a restaurant ordered by display_order ASC.
 */
export async function listCategories(restaurantId: string): Promise<CategoryRecord[]> {
  const result = await pool.query(
    `SELECT id, name, display_order, created_at, updated_at
     FROM categories
     WHERE restaurant_id = $1
     ORDER BY display_order ASC`,
    [restaurantId]
  );

  return result.rows.map(mapRow);
}

/**
 * Updates a category name. Validates ownership and uniqueness.
 */
export async function updateCategory(
  categoryId: string,
  restaurantId: string,
  name: string
): Promise<CategoryRecord> {
  const trimmedName = validateCategoryName(name);

  // Verify category belongs to this restaurant
  const categoryResult = await pool.query(
    'SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2',
    [categoryId, restaurantId]
  );

  if (categoryResult.rows.length === 0) {
    throw new NotFoundError('Category not found');
  }

  // Check case-insensitive uniqueness (exclude self)
  const existing = await pool.query(
    'SELECT id FROM categories WHERE restaurant_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
    [restaurantId, trimmedName, categoryId]
  );

  if (existing.rows.length > 0) {
    throw new ConflictError('A category with this name already exists');
  }

  // Update
  const result = await pool.query(
    `UPDATE categories SET name = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, name, display_order, created_at, updated_at`,
    [trimmedName, categoryId]
  );

  return mapRow(result.rows[0]);
}

/**
 * Deletes a category. CASCADE handles food item deletion via FK.
 */
export async function deleteCategory(
  categoryId: string,
  restaurantId: string
): Promise<void> {
  // Verify category belongs to this restaurant
  const categoryResult = await pool.query(
    'SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2',
    [categoryId, restaurantId]
  );

  if (categoryResult.rows.length === 0) {
    throw new NotFoundError('Category not found');
  }

  await pool.query('DELETE FROM categories WHERE id = $1', [categoryId]);
}

/**
 * Reorders categories. Accepts array of category IDs and updates display_order accordingly.
 * Uses a transaction for atomicity.
 */
export async function reorderCategories(
  restaurantId: string,
  categoryIds: string[]
): Promise<CategoryRecord[]> {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    throw new ValidationError('Validation failed', [
      { field: 'categoryIds', message: 'categoryIds must be a non-empty array' },
    ]);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify all IDs belong to this restaurant
    const verifyResult = await client.query(
      'SELECT id FROM categories WHERE restaurant_id = $1',
      [restaurantId]
    );

    const restaurantCategoryIds = new Set(verifyResult.rows.map((r) => r.id));

    for (const id of categoryIds) {
      if (!restaurantCategoryIds.has(id)) {
        throw new ValidationError('Validation failed', [
          { field: 'categoryIds', message: `Category ID '${id}' does not belong to your restaurant` },
        ]);
      }
    }

    // Update display_order for each category
    for (let i = 0; i < categoryIds.length; i++) {
      await client.query(
        'UPDATE categories SET display_order = $1, updated_at = NOW() WHERE id = $2',
        [i, categoryIds[i]]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // Return updated list
  return listCategories(restaurantId);
}
