import { getTestPool } from './db';

export interface TestOwner {
  id: string;
  email: string;
  phone: string | null;
  password_hash: string;
  name: string;
  status: string;
}

export interface TestRestaurant {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  phone: string;
  restaurant_token: string;
  status: string;
}

export interface TestCategory {
  id: string;
  restaurant_id: string;
  name: string;
  display_order: number;
}

export interface TestFoodItem {
  id: string;
  category_id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  badge: 'veg' | 'non_veg';
  is_available: boolean;
}

let fixtureCounter = 0;

function nextId(): number {
  return ++fixtureCounter;
}

/**
 * Reset the fixture counter. Call this in beforeEach if needed.
 */
export function resetFixtureCounter(): void {
  fixtureCounter = 0;
}

/**
 * Create a test owner in the database.
 */
export async function createTestOwner(
  overrides: Partial<Omit<TestOwner, 'id'>> = {}
): Promise<TestOwner> {
  const pool = getTestPool();
  const counter = nextId();

  const defaults = {
    email: `owner${counter}@test.com`,
    phone: null,
    password_hash: '$2b$10$testhashedpassword000000000000000000000000000000', // bcrypt placeholder
    name: `Test Owner ${counter}`,
    status: 'active',
  };

  const data = { ...defaults, ...overrides };

  const result = await pool.query(
    `INSERT INTO owners (email, phone, password_hash, name, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.email, data.phone, data.password_hash, data.name, data.status]
  );

  return result.rows[0];
}

/**
 * Create a test restaurant in the database.
 * Requires a valid owner_id.
 */
export async function createTestRestaurant(
  ownerId: string,
  overrides: Partial<Omit<TestRestaurant, 'id' | 'owner_id'>> = {}
): Promise<TestRestaurant> {
  const pool = getTestPool();
  const counter = nextId();

  const defaults = {
    name: `Test Restaurant ${counter}`,
    address: `${counter} Test Street, Test City`,
    phone: `555000${counter.toString().padStart(4, '0')}`,
    restaurant_token: `tkn${counter.toString().padStart(7, '0')}`,
    status: 'active',
  };

  const data = { ...defaults, ...overrides };

  const result = await pool.query(
    `INSERT INTO restaurants (owner_id, name, address, phone, restaurant_token, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [ownerId, data.name, data.address, data.phone, data.restaurant_token, data.status]
  );

  return result.rows[0];
}

/**
 * Create a test category in the database.
 * Requires a valid restaurant_id.
 */
export async function createTestCategory(
  restaurantId: string,
  overrides: Partial<Omit<TestCategory, 'id' | 'restaurant_id'>> = {}
): Promise<TestCategory> {
  const pool = getTestPool();
  const counter = nextId();

  const defaults = {
    name: `Category ${counter}`,
    display_order: counter,
  };

  const data = { ...defaults, ...overrides };

  const result = await pool.query(
    `INSERT INTO categories (restaurant_id, name, display_order)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [restaurantId, data.name, data.display_order]
  );

  return result.rows[0];
}

/**
 * Create a test food item in the database.
 * Requires valid category_id and restaurant_id.
 */
export async function createTestFoodItem(
  categoryId: string,
  restaurantId: string,
  overrides: Partial<Omit<TestFoodItem, 'id' | 'category_id' | 'restaurant_id'>> = {}
): Promise<TestFoodItem> {
  const pool = getTestPool();
  const counter = nextId();

  const defaults = {
    name: `Food Item ${counter}`,
    description: `Description for food item ${counter}`,
    price: 9.99 + counter,
    badge: 'veg' as const,
    is_available: true,
  };

  const data = { ...defaults, ...overrides };

  const result = await pool.query(
    `INSERT INTO food_items (category_id, restaurant_id, name, description, price, badge, is_available)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [categoryId, restaurantId, data.name, data.description, data.price, data.badge, data.is_available]
  );

  return result.rows[0];
}

/**
 * Create a complete restaurant setup with owner, restaurant, categories, and food items.
 * Useful for integration tests that need a fully populated database.
 */
export async function createFullRestaurantSetup(options?: {
  categoryCount?: number;
  itemsPerCategory?: number;
}): Promise<{
  owner: TestOwner;
  restaurant: TestRestaurant;
  categories: TestCategory[];
  foodItems: TestFoodItem[];
}> {
  const categoryCount = options?.categoryCount ?? 3;
  const itemsPerCategory = options?.itemsPerCategory ?? 2;

  const owner = await createTestOwner();
  const restaurant = await createTestRestaurant(owner.id);

  const categories: TestCategory[] = [];
  const foodItems: TestFoodItem[] = [];

  for (let i = 0; i < categoryCount; i++) {
    const category = await createTestCategory(restaurant.id, {
      name: `Category ${i + 1}`,
      display_order: i + 1,
    });
    categories.push(category);

    for (let j = 0; j < itemsPerCategory; j++) {
      const item = await createTestFoodItem(category.id, restaurant.id, {
        name: `Item ${i + 1}-${j + 1}`,
        badge: j % 2 === 0 ? 'veg' : 'non_veg',
        price: 10 + i * 5 + j,
      });
      foodItems.push(item);
    }
  }

  return { owner, restaurant, categories, foodItems };
}
