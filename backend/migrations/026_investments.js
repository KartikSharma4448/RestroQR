exports.up = (pgm) => {
  pgm.createTable('investments', {
    id: { type: 'uuid', primaryKey: true },
    restaurant_id: {
      type: 'uuid',
      notNull: true,
      references: 'restaurants(id)',
      onDelete: 'CASCADE',
    },
    topic: { type: 'varchar(100)', notNull: true },
    amount: { type: 'numeric(12,2)', notNull: true },
    spent_on: { type: 'date', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('investments', 'investments_amount_positive', { check: 'amount > 0' });
  pgm.addConstraint('investments', 'investments_topic_not_blank', {
    check: "length(btrim(topic)) > 0",
  });
  pgm.createIndex('investments', ['restaurant_id', 'spent_on']);
};
exports.down = (pgm) => pgm.dropTable('investments');
