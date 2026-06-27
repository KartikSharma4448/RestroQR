import pool from '../config/database';
import {
  ValidationError,
  ValidationDetail,
  NotFoundError,
} from '../errors';

export interface FoodItemRecord {
  id: string;
  categoryId: string;
  restaurantId: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  badge: 'veg' | 'non_veg';
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Maps a database row to the FoodItemRecord interface.
 */
function mapRow(row: Record<string, unknown>): FoodItemRecord {
  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    restaurantId: row.restaurant_id as string,
    name: row.name as string,
    description: row.description as string | null,
    price: row.price as string,
    imageUrl: row.image_url as string | null,
    badge: row.badge as 'veg' | 'non_veg',
    isAvailable: row.is_available as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Validates food item fields for create/update.
 * For create, all required fields must be present.
 * For update, only provided fields are validated.
 */
export function validateFoodItem(
  data: {
    name?: unknown;
    price?: unknown;
    badge?: unknown;
    description?: unknown;
  },
  isCreate: boolean
): { name?: string; price?: number; badge?: 'veg' | 'non_veg'; description?: string | null } {
  const errors: ValidationDetail[] = [];

  let validatedName: string | undefined;
  let validatedPrice: number | undefined;
  let validatedBadge: 'veg' | 'non_veg' | undefined;
  let validatedDescription: string | null | undefined;

  // Name validation
  if (isCreate || data.name !== undefined) {
    if (data.name === undefined || data.name === null || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name is required' });
    } else if (data.name.trim().length > 100) {
      errors.push({ field: 'name', message: 'Name must not exceed 100 characters' });
    } else {
      validatedName = data.name.trim();
    }
  }

  // Price validation
  if (isCreate || data.price !== undefined) {
    if (data.price === undefined || data.price === null) {
      errors.push({ field: 'price', message: 'Price is required' });
    } else {
      const priceNum = typeof data.price === 'string' ? parseFloat(data.price) : Number(data.price);
      if (isNaN(priceNum) || priceNum < 0.01 || priceNum > 999999.99) {
        errors.push({ field: 'price', message: 'Price must be between 0.01 and 999999.99' });
      } else {
        validatedPrice = priceNum;
      }
    }
  }

  // Badge validation
  if (isCreate || data.badge !== undefined) {
    if (data.badge === undefined || data.badge === null) {
      errors.push({ field: 'badge', message: 'Badge is required' });
    } else if (data.badge !== 'veg' && data.badge !== 'non_veg') {
      errors.push({ field: 'badge', message: "Badge must be 'veg' or 'non_veg'" });
    } else {
      validatedBadge = data.badge as 'veg' | 'non_veg';
    }
  }

  // Description validation (optional field)
  if (data.description !== undefined) {
    if (data.description === null) {
      validatedDescription = null;
    } else if (typeof data.description !== 'string') {
      errors.push({ field: 'description', message: 'Description must be a string' });
    } else if (data.description.length > 500) {
      errors.push({ field: 'description', message: 'Description must not exceed 500 characters' });
    } else {
      validatedDescription = data.description.trim();
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }

  const result: { name?: string; price?: number; badge?: 'veg' | 'non_veg'; description?: string | null } = {};
  if (validatedName !== undefined) result.name = validatedName;
  if (validatedPrice !== undefined) result.price = validatedPrice;
  if (validatedBadge !== undefined) result.badge = validatedBadge;
  if (validatedDescription !== undefined) result.description = validatedDescription;

  return result;
}

/**
 * Verifies that a category belongs to a specific restaurant.
 */
export async function verifyCategoryOwnership(categoryId: string, restaurantId: string): Promise<void> {
  const result = await pool.query(
    'SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2',
    [categoryId, restaurantId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Category not found');
  }
}

/**
 * Verifies that a food item belongs to a specific restaurant.
 * Returns the food item row if found.
 */
export async function verifyItemOwnership(
  itemId: string,
  restaurantId: string
): Promise<Record<string, unknown>> {
  const result = await pool.query(
    'SELECT * FROM food_items WHERE id = $1 AND restaurant_id = $2',
    [itemId, restaurantId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Food item not found');
  }

  return result.rows[0];
}

/**
 * Creates a new food item.
 */
export async function createFoodItem(
  restaurantId: string,
  categoryId: string,
  data: { name: string; description?: string | null; price: number; badge: 'veg' | 'non_veg'; imageUrl?: string | null }
): Promise<FoodItemRecord> {
  // Verify category belongs to restaurant
  await verifyCategoryOwnership(categoryId, restaurantId);

  const result = await pool.query(
    `INSERT INTO food_items (category_id, restaurant_id, name, description, price, image_url, badge, is_available)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     RETURNING id, category_id, restaurant_id, name, description, price, image_url, badge, is_available, created_at, updated_at`,
    [
      categoryId,
      restaurantId,
      data.name,
      data.description || null,
      data.price,
      data.imageUrl || null,
      data.badge,
    ]
  );

  return mapRow(result.rows[0]);
}

/**
 * Lists all food items in a category.
 */
export async function listFoodItems(
  categoryId: string,
  restaurantId: string
): Promise<FoodItemRecord[]> {
  // Verify category belongs to restaurant
  await verifyCategoryOwnership(categoryId, restaurantId);

  const result = await pool.query(
    `SELECT id, category_id, restaurant_id, name, description, price, image_url, badge, is_available, created_at, updated_at
     FROM food_items
     WHERE category_id = $1 AND restaurant_id = $2
     ORDER BY created_at ASC`,
    [categoryId, restaurantId]
  );

  return result.rows.map(mapRow);
}

/**
 * Updates a food item.
 */
export async function updateFoodItem(
  itemId: string,
  restaurantId: string,
  data: { name?: string; description?: string | null; price?: number; badge?: 'veg' | 'non_veg'; imageUrl?: string | null }
): Promise<FoodItemRecord> {
  // Verify item belongs to restaurant
  await verifyItemOwnership(itemId, restaurantId);

  // Build dynamic SET clause
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.price !== undefined) {
    setClauses.push(`price = $${paramIndex++}`);
    values.push(data.price);
  }
  if (data.badge !== undefined) {
    setClauses.push(`badge = $${paramIndex++}`);
    values.push(data.badge);
  }
  if (data.imageUrl !== undefined) {
    setClauses.push(`image_url = $${paramIndex++}`);
    values.push(data.imageUrl);
  }

  if (setClauses.length === 0) {
    // Nothing to update, just return current item
    const current = await pool.query(
      `SELECT id, category_id, restaurant_id, name, description, price, image_url, badge, is_available, created_at, updated_at
       FROM food_items WHERE id = $1`,
      [itemId]
    );
    return mapRow(current.rows[0]);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(itemId);

  const result = await pool.query(
    `UPDATE food_items SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, category_id, restaurant_id, name, description, price, image_url, badge, is_available, created_at, updated_at`,
    values
  );

  return mapRow(result.rows[0]);
}

/**
 * Deletes a food item. Returns the image_url if one exists (for Cloudinary cleanup).
 */
export async function deleteFoodItem(
  itemId: string,
  restaurantId: string
): Promise<string | null> {
  const item = await verifyItemOwnership(itemId, restaurantId);
  const imageUrl = item.image_url as string | null;

  // TODO: If imageUrl exists, delete from Cloudinary

  await pool.query('DELETE FROM food_items WHERE id = $1', [itemId]);

  return imageUrl;
}

/**
 * Toggles the availability of a food item.
 */
export async function toggleAvailability(
  itemId: string,
  restaurantId: string,
  isAvailable: boolean
): Promise<{ id: string; isAvailable: boolean }> {
  // Verify item belongs to restaurant
  await verifyItemOwnership(itemId, restaurantId);

  if (typeof isAvailable !== 'boolean') {
    throw new ValidationError('Validation failed', [
      { field: 'isAvailable', message: 'isAvailable must be a boolean' },
    ]);
  }

  const result = await pool.query(
    `UPDATE food_items SET is_available = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, is_available`,
    [isAvailable, itemId]
  );

  return {
    id: result.rows[0].id,
    isAvailable: result.rows[0].is_available,
  };
}
