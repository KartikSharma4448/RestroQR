/**
 * Migration: Create food_items table with price CHECK constraint
 */

exports.up = (pgm) => {
  pgm.createTable('food_items', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    category_id: {
      type: 'uuid',
      notNull: true,
      references: 'categories(id)',
      onDelete: 'CASCADE',
    },
    restaurant_id: {
      type: 'uuid',
      notNull: true,
      references: 'restaurants(id)',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'varchar(100)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    price: {
      type: 'decimal(8,2)',
      notNull: true,
    },
    image_url: {
      type: 'varchar(500)',
    },
    badge: {
      type: 'food_badge',
      notNull: true,
    },
    is_available: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Price must be between 0.01 and 999999.99
  pgm.addConstraint('food_items', 'food_items_price_check', {
    check: 'price >= 0.01 AND price <= 999999.99',
  });

  // Index for faster lookups by category
  pgm.createIndex('food_items', 'category_id');

  // Index for faster lookups by restaurant
  pgm.createIndex('food_items', 'restaurant_id');
};

exports.down = (pgm) => {
  pgm.dropTable('food_items');
};
