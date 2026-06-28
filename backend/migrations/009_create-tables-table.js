/**
 * Migration: Create tables table for restaurant table management
 */

exports.up = (pgm) => {
  pgm.createTable('tables', {
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
    display_name: {
      type: 'varchar(50)',
      notNull: true,
    },
    table_token: {
      type: 'varchar(200)',
      notNull: true,
      unique: true,
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

  // Index for faster lookups by restaurant
  pgm.createIndex('tables', 'restaurant_id', { name: 'idx_tables_restaurant_id' });
};

exports.down = (pgm) => {
  pgm.dropTable('tables');
};
