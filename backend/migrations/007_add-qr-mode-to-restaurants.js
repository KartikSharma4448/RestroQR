/**
 * Migration: Add qr_mode column to restaurants table
 */

exports.up = (pgm) => {
  pgm.addColumns('restaurants', {
    qr_mode: {
      type: 'varchar(10)',
      notNull: true,
      default: "'single'",
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('restaurants', ['qr_mode']);
};
