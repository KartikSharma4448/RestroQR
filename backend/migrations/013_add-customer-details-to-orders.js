/**
 * Migration: Add customer_name and customer_phone to orders table
 */

exports.up = (pgm) => {
  pgm.addColumns('orders', {
    customer_name: {
      type: 'varchar(100)',
      notNull: false,
    },
    customer_phone: {
      type: 'varchar(20)',
      notNull: false,
    },
  });

  // Index for faster lookups of loyalty visits per customer per restaurant
  pgm.createIndex('orders', ['restaurant_id', 'customer_phone'], {
    name: 'idx_orders_customer_loyalty',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('orders', ['restaurant_id', 'customer_phone'], {
    name: 'idx_orders_customer_loyalty',
  });
  pgm.dropColumns('orders', ['customer_name', 'customer_phone']);
};
