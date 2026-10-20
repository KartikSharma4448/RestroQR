exports.up = (pgm) => {
  pgm.addColumns('owners', { profile_image_url: { type: 'varchar(500)' } });
  pgm.addColumns('restaurants', {
    business_upi_id: { type: 'varchar(255)' },
    onboarding_required: { type: 'boolean', notNull: true, default: false },
  });
};
exports.down = (pgm) => {
  pgm.dropColumns('restaurants', ['business_upi_id', 'onboarding_required']);
  pgm.dropColumns('owners', ['profile_image_url']);
};
