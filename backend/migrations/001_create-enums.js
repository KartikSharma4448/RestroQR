/**
 * Migration: Create custom ENUM types for the RestroQR database
 */

exports.up = (pgm) => {
  // Account status enum used by owners and restaurants
  pgm.createType('account_status', ['active', 'disabled']);

  // Food badge enum used by food items
  pgm.createType('food_badge', ['veg', 'non_veg']);
};

exports.down = (pgm) => {
  pgm.dropType('food_badge');
  pgm.dropType('account_status');
};
