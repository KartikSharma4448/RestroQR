/**
 * Migration: Create fcm_tokens table for storing FCM device tokens
 */

exports.up = (pgm) => {
  pgm.createTable('fcm_tokens', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    owner_id: {
      type: 'uuid',
      notNull: true,
      references: 'owners(id)',
      onDelete: 'CASCADE',
    },
    token: {
      type: 'varchar(500)',
      notNull: true,
      unique: true,
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

  // Index for faster lookups by owner
  pgm.createIndex('fcm_tokens', 'owner_id', { name: 'idx_fcm_tokens_owner_id' });
};

exports.down = (pgm) => {
  pgm.dropTable('fcm_tokens');
};
