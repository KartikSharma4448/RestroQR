exports.up = pgm => {
  pgm.addColumns('orders', {
    customer_email: { type: 'varchar(254)' },
    client_request_id: { type: 'uuid', unique: true },
    request_fingerprint: { type: 'varchar(64)' },
  });
  pgm.createIndex('orders', ['customer_email', 'created_at']);
  pgm.createTable('order_email_outbox', {
    id: { type: 'uuid', primaryKey: true },
    order_id: { type: 'uuid', notNull: true, references: 'orders(id)', onDelete: 'CASCADE', unique: true },
    recipient: { type: 'varchar(254)', notNull: true },
    sender: { type: 'varchar(320)' },
    subject: { type: 'varchar(255)', notNull: true },
    body: { type: 'text', notNull: true },
    status: { type: 'varchar(16)', notNull: true, default: 'pending' },
    attempts: { type: 'integer', notNull: true, default: 0 },
    next_attempt_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    first_attempt_at: { type: 'timestamptz' },
    lease_until: { type: 'timestamptz' },
    lease_token: { type: 'uuid' },
    provider_id: { type: 'varchar(255)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    sent_at: { type: 'timestamptz' },
  });
  pgm.addConstraint('order_email_outbox', 'order_email_status', { check: "status IN ('pending','sending','sent','failed','uncertain') AND attempts >= 0" });
  pgm.createIndex('order_email_outbox', ['status', 'next_attempt_at']);
};
exports.down = pgm => {
  pgm.dropTable('order_email_outbox');
  pgm.dropColumns('orders', ['customer_email', 'client_request_id', 'request_fingerprint']);
};
