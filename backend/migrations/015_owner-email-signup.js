exports.up = (pgm) => {
  pgm.addColumns('owners', {
    email_verified_at: { type: 'timestamptz' },
    requires_google_link: { type: 'boolean', notNull: true, default: false },
  });
  pgm.createTable('owner_signup_challenges', {
    id: { type: 'uuid', primaryKey: true },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    name: { type: 'varchar(100)', notNull: true },
    phone: { type: 'varchar(20)' },
    password_hash: { type: 'varchar(255)', notNull: true },
    code_hash: { type: 'varchar(64)', notNull: true },
    expires_at: { type: 'timestamptz', notNull: true },
    sent_at: { type: 'timestamptz', notNull: true },
    window_started_at: { type: 'timestamptz', notNull: true },
    send_count: { type: 'integer', notNull: true, default: 1 },
    attempts: { type: 'integer', notNull: true, default: 0 },
    consumed_at: { type: 'timestamptz' },
  });
  pgm.addConstraint('owner_signup_challenges', 'signup_attempts_nonnegative', 'CHECK (attempts >= 0 AND send_count >= 1)');
};

exports.down = (pgm) => {
  pgm.dropTable('owner_signup_challenges');
  pgm.dropColumns('owners', ['email_verified_at', 'requires_google_link']);
};
