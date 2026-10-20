/**
 * Migration: Create order_items table for order line items
 */

exports.up = (pgm) => {
  pgm.createTable('order_items', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    order_id: {
      type: 'uuid',
      notNull: true,
      references: 'orders(id)',
      onDelete: 'CASCADE',
    },
    food_item_id: {
      type: 'uuid',
      references: 'food_items(id)',
      onDelete: 'SET NULL',
    },
    item_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    item_price: {
      type: 'decimal(8,2)',
      notNull: true,
    },
    quantity: {
      type: 'integer',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Quantity must be at least 1
  pgm.addConstraint('order_items', 'order_items_quantity_check', {
    check: 'quantity >= 1',
  });

  // Indexes for efficient querying
  pgm.createIndex('order_items', 'order_id', { name: 'idx_order_items_order_id' });
  pgm.createIndex('order_items', 'food_item_id', { name: 'idx_order_items_food_item_id' });
};

exports.down = (pgm) => {
  pgm.dropTable('order_items');
};
