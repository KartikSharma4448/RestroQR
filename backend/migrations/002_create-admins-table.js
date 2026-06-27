/**
 * Migration: Create admins table
 */

exports.up = (pgm) => {
  pgm.createExtension('uuid-ossp', { ifNotExists: true });

  pgm.createTable('admins', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'varchar(255)',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('admins');
};
