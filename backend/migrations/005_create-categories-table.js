/**
 * Migration: Create categories table with case-insensitive unique constraint
 */

exports.up = (pgm) => {
  pgm.createTable('categories', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    restaurant_id: {
      type: 'uuid',
      notNull: true,
      references: 'restaurants(id)',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'varchar(50)',
      notNull: true,
    },
    display_order: {
      type: 'integer',
      notNull: true,
      default: 0,
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

  // Case-insensitive unique index on (restaurant_id, LOWER(name))
  pgm.sql(`
    CREATE UNIQUE INDEX categories_restaurant_id_lower_name_unique
    ON categories (restaurant_id, LOWER(name));
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('categories');
};
