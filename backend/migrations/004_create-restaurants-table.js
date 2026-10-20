/**
 * Migration: Create restaurants table
 */

exports.up = (pgm) => {
  pgm.createTable('restaurants', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    owner_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'owners(id)',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'varchar(100)',
      notNull: true,
    },
    address: {
      type: 'varchar(250)',
      notNull: true,
    },
    phone: {
      type: 'varchar(20)',
      notNull: true,
    },
    logo_url: {
      type: 'varchar(500)',
    },
    cover_image_url: {
      type: 'varchar(500)',
    },
    restaurant_token: {
      type: 'varchar(20)',
      notNull: true,
      unique: true,
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
};

exports.down = (pgm) => {
  pgm.dropTable('restaurants');
};
