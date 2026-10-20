exports.up = pgm => {
  pgm.createTable('order_payment_choices', {
    order_id: { type: 'uuid', primaryKey: true, references: 'orders(id)', onDelete: 'CASCADE' },
    restaurant_id: { type: 'uuid', notNull: true, references: 'restaurants(id)', onDelete: 'CASCADE' },
    upi_id: { type: 'varchar(160)' },
    payee_name: { type: 'varchar(100)', notNull: true },
    choice: { type: 'varchar(24)', notNull: true, default: 'unselected' },
    transaction_id: { type: 'varchar(64)' },
    proof_public_id: { type: 'text' },
    upload_attempts: { type: 'integer', notNull: true, default: 0 },
    expires_at: { type: 'timestamptz', notNull: true, default: pgm.func("NOW()+INTERVAL '24 hours'") },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('order_payment_choices', 'payment_choice_values', {
    check: "choice IN ('unselected','cash','upi_submitted') AND upload_attempts BETWEEN 0 AND 3",
  });
  pgm.sql('CREATE UNIQUE INDEX payment_transaction_unique ON order_payment_choices (restaurant_id,lower(transaction_id)) WHERE transaction_id IS NOT NULL');
};
exports.down = pgm => pgm.dropTable('order_payment_choices');
