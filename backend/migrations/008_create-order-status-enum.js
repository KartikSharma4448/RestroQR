/**
 * Migration: Create order_status ENUM type for the ordering system
 */

exports.up = (pgm) => {
  pgm.createType('order_status', ['pending', 'accepted', 'completed', 'payment_received', 'cancelled']);
};

exports.down = (pgm) => {
  pgm.dropType('order_status');
};
