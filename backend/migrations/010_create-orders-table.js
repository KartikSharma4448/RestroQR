/**
 * Migration: Create orders table for the ordering system
 */

exports.up = (pgm) => {
  pgm.createTable('orders', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    restaurant_id: {
      type: 'uuid',
      notNull: true,
      references: 'restaurants(id)',
    },
    table_id: {
      type: 'uuid',
      notNull: true,
      references: 'tables(id)',
    },
    order_ref: {
      type: 'varchar(20)',
      notNull: true,
      unique: true,
    },
    status: {
      type: 'order_status',
      notNull: true,
      default: pgm.func("'pending'"),
    },
    total: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    accepted_at: {
      type: 'timestamp',
    },
    completed_at: {
      type: 'timestamp',
    },
    payment_received_at: {
      type: 'timestamp',
    },
    cancelled_at: {
      type: 'timestamp',
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Indexes for efficient querying
  pgm.createIndex('orders', 'restaurant_id', { name: 'idx_orders_restaurant_id' });
  pgm.createIndex('orders', 'table_id', { name: 'idx_orders_table_id' });
  pgm.createIndex('orders', 'status', { name: 'idx_orders_status' });
  pgm.createIndex('orders', 'created_at', { name: 'idx_orders_created_at' });
  pgm.createIndex('orders', ['restaurant_id', 'status'], { name: 'idx_orders_restaurant_status' });
  pgm.createIndex('orders', [{ name: 'restaurant_id' }, { name: 'created_at', sort: 'DESC' }], { name: 'idx_orders_restaurant_created' });
};

exports.down = (pgm) => {
  pgm.dropTable('orders');
};
