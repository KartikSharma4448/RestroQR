exports.up = pgm => {
  pgm.dropConstraint('order_email_outbox','order_email_kind_check');
  pgm.addConstraint('order_email_outbox','order_email_kind_check', {
    check: "kind IN ('order-confirmation','order-accepted','order-ready','payment-receipt')",
  });
};
exports.down = pgm => {
  pgm.sql("DELETE FROM order_email_outbox WHERE kind IN ('order-accepted','order-ready')");
  pgm.dropConstraint('order_email_outbox','order_email_kind_check');
  pgm.addConstraint('order_email_outbox','order_email_kind_check', {
    check: "kind IN ('order-confirmation','payment-receipt')",
  });
};
