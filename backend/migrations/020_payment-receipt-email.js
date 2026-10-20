exports.up = pgm => {
  pgm.addColumns('order_email_outbox', {
    kind: { type: 'varchar(24)', notNull: true, default: 'order-confirmation' },
  });
  pgm.dropConstraint('order_email_outbox', 'order_email_outbox_order_id_key');
  pgm.addConstraint('order_email_outbox', 'order_email_order_kind_unique', { unique: ['order_id', 'kind'] });
  pgm.addConstraint('order_email_outbox', 'order_email_kind_check', {
    check: "kind IN ('order-confirmation','payment-receipt')",
  });
};

exports.down = pgm => {
  pgm.sql("DELETE FROM order_email_outbox WHERE kind='payment-receipt'");
  pgm.dropConstraint('order_email_outbox', 'order_email_order_kind_unique');
  pgm.dropConstraint('order_email_outbox', 'order_email_kind_check');
  pgm.dropColumns('order_email_outbox', ['kind']);
  pgm.addConstraint('order_email_outbox', 'order_email_outbox_order_id_key', { unique: ['order_id'] });
};
