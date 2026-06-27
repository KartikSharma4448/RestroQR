/**
 * Migration: Create owners table with CHECK constraint
 */

exports.up = (pgm) => {
  pgm.createTable('owners', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    email: {
      type: 'varchar(255)',
      unique: true,
    },
    phone: {
      type: 'varchar(20)',
      unique: true,
    },
    password_hash: {
      type: 'varchar(255)',
      notNull: true,
    },
    name: {
      type: 'varchar(100)',
      notNull: true,
    },
    status: {
      type: 'account_status',
      notNull: true,
      default: 'active',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // At least one of email or phone must be provided
  pgm.addConstraint('owners', 'owners_email_or_phone_check', {
    check: 'email IS NOT NULL OR phone IS NOT NULL',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('owners');
};
