exports.up = (pgm) => {
  pgm.addColumns('owners', {
    firebase_uid: { type: 'varchar(128)', unique: true },
    google_subject: { type: 'varchar(255)', unique: true },
    google_linked_at: { type: 'timestamptz' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('owners', ['firebase_uid', 'google_subject', 'google_linked_at']);
};
