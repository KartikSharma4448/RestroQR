exports.up = pgm => {
  pgm.createTable('waiter_calls', {
    id: { type: 'uuid', primaryKey: true },
    restaurant_id: { type: 'uuid', notNull: true, references: 'restaurants(id)', onDelete: 'CASCADE' },
    table_id: { type: 'uuid', notNull: true, references: 'tables(id)', onDelete: 'CASCADE' },
    status: { type: 'varchar(16)', notNull: true, default: 'pending' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('waiter_calls','waiter_call_status', { check: "status IN ('pending','acknowledged','resolved')" });
  pgm.sql("CREATE UNIQUE INDEX waiter_one_active_table ON waiter_calls(table_id) WHERE status IN ('pending','acknowledged')");
  pgm.createIndex('waiter_calls',['restaurant_id','created_at']);
};
exports.down = pgm => pgm.dropTable('waiter_calls');
