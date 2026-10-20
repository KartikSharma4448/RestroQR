exports.up = pgm => {
  pgm.addColumn('food_items', { menu_options: { type: 'jsonb', notNull: true,
    default: pgm.func("'{\"variants\":[],\"addOns\":[]}'::jsonb") } });
  pgm.addColumn('order_items', { selected_options: { type: 'jsonb' } });
};
exports.down = pgm => {
  pgm.dropColumn('order_items', 'selected_options');
  pgm.dropColumn('food_items', 'menu_options');
};
