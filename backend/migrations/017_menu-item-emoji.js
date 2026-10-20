exports.up = (pgm) => {
  pgm.addColumn('food_items', { emoji: { type: 'varchar(64)' } });
};

exports.down = (pgm) => { pgm.dropColumn('food_items', 'emoji'); };
