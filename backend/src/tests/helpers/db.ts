import { Pool, PoolConfig } from 'pg';

let testPool: Pool | null = null;

/**
 * Get or create a connection pool for the test database.
 * Uses DATABASE_URL from environment or falls back to a test-specific default.
 */
export function getTestPool(): Pool {
  if (!testPool) {
    const config: PoolConfig = {
      connectionString:
        process.env.TEST_DATABASE_URL ||
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/restroqr_test',
      max: 5,
    };
    testPool = new Pool(config);
  }
  return testPool;
}

/**
 * Set up the test database schema.
 * Creates all required tables if they don't exist.
 */
export async function setupTestDatabase(): Promise<void> {
  const pool = getTestPool();

  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS admins (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS owners (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(20) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT owners_contact_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      owner_id UUID UNIQUE REFERENCES owners(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      address VARCHAR(250) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      logo_url VARCHAR(500),
      cover_image_url VARCHAR(500),
      restaurant_token VARCHAR(20) UNIQUE,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
      name VARCHAR(50) NOT NULL,
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_restaurant_name
      ON categories (restaurant_id, LOWER(name));

    CREATE TABLE IF NOT EXISTS food_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
      restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      price DECIMAL(8,2) NOT NULL CHECK (price >= 0.01 AND price <= 999999.99),
      image_url VARCHAR(500),
      badge VARCHAR(10) NOT NULL CHECK (badge IN ('veg', 'non_veg')),
      is_available BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

/**
 * Tear down the test database by dropping all tables.
 * Use this in afterAll hooks to clean up.
 */
export async function teardownTestDatabase(): Promise<void> {
  const pool = getTestPool();

  await pool.query(`
    DROP TABLE IF EXISTS food_items CASCADE;
    DROP TABLE IF EXISTS categories CASCADE;
    DROP TABLE IF EXISTS restaurants CASCADE;
    DROP TABLE IF EXISTS owners CASCADE;
    DROP TABLE IF EXISTS admins CASCADE;
  `);
}

/**
 * Clean all data from tables without dropping them.
 * Use this between tests for a fresh state.
 */
export async function cleanTestData(): Promise<void> {
  const pool = getTestPool();

  await pool.query(`
    DELETE FROM food_items;
    DELETE FROM categories;
    DELETE FROM restaurants;
    DELETE FROM owners;
    DELETE FROM admins;
  `);
}

/**
 * Close the test database pool connection.
 * Call this in the global teardown or afterAll.
 */
export async function closeTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}
