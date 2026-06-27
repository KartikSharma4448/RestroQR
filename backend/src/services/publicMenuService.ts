import pool from '../config/database';
import { NotFoundError } from '../errors';

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  badge: string;
  isAvailable: boolean;
}

export interface PublicCategory {
  id: string;
  name: string;
  displayOrder: number;
  items: PublicMenuItem[];
}

export interface PublicMenuResponse {
  restaurant: {
    name: string;
    logoUrl: string | null;
    coverImageUrl: string | null;
  };
  categories: PublicCategory[];
}

/**
 * Generic NOT_FOUND error for all failure cases.
 * SECURITY: Returns identical error for invalid format, non-existent token, and disabled restaurants.
 */
function menuNotFound(): NotFoundError {
  return new NotFoundError('Menu not found');
}

/**
 * Validates that a token has a plausible format.
 * Tokens are alphanumeric, URL-safe, and at least 8 characters.
 * SECURITY: Returns same error as non-existent to avoid information leakage.
 */
function isValidTokenFormat(token: string): boolean {
  return /^[A-Za-z0-9]{8,}$/.test(token);
}

/**
 * Fetches the full public menu for a given restaurant token.
 *
 * Returns restaurant info, categories (ordered by display_order), and food items per category.
 * Throws NOT_FOUND uniformly for invalid format, non-existent token, or disabled restaurant.
 */
export async function getPublicMenu(token: string): Promise<PublicMenuResponse> {
  // Validate token format — return generic error if invalid
  if (!token || !isValidTokenFormat(token)) {
    throw menuNotFound();
  }

  // Look up restaurant by token
  const restaurantResult = await pool.query(
    'SELECT id, name, logo_url, cover_image_url, status FROM restaurants WHERE restaurant_token = $1',
    [token]
  );

  // Non-existent token — return generic error
  if (restaurantResult.rows.length === 0) {
    throw menuNotFound();
  }

  const restaurant = restaurantResult.rows[0];

  // Disabled restaurant — return same generic error (no info leakage)
  if (restaurant.status === 'disabled') {
    throw menuNotFound();
  }

  // Fetch categories ordered by display_order
  const categoriesResult = await pool.query(
    'SELECT id, name, display_order FROM categories WHERE restaurant_id = $1 ORDER BY display_order ASC',
    [restaurant.id]
  );

  // Fetch all food items for this restaurant
  const itemsResult = await pool.query(
    `SELECT id, category_id, name, description, price, image_url, badge, is_available
     FROM food_items WHERE restaurant_id = $1`,
    [restaurant.id]
  );

  // Group items by category_id
  const itemsByCategory = new Map<string, PublicMenuItem[]>();
  for (const row of itemsResult.rows) {
    const categoryId = row.category_id as string;
    if (!itemsByCategory.has(categoryId)) {
      itemsByCategory.set(categoryId, []);
    }
    itemsByCategory.get(categoryId)!.push({
      id: row.id,
      name: row.name,
      description: row.description || null,
      price: parseFloat(row.price).toFixed(2),
      imageUrl: row.image_url || null,
      badge: row.badge,
      isAvailable: row.is_available,
    });
  }

  // Build categories with their items
  const categories: PublicCategory[] = categoriesResult.rows.map((cat) => ({
    id: cat.id,
    name: cat.name,
    displayOrder: cat.display_order,
    items: itemsByCategory.get(cat.id) || [],
  }));

  return {
    restaurant: {
      name: restaurant.name,
      logoUrl: restaurant.logo_url || null,
      coverImageUrl: restaurant.cover_image_url || null,
    },
    categories,
  };
}
