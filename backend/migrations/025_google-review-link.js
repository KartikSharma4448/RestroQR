exports.up = (pgm) =>
  pgm.sql(`
ALTER TABLE restaurants ADD COLUMN google_review_url text
  CHECK (google_review_url IS NULL OR length(google_review_url) <= 500);
`);
exports.down = (pgm) => pgm.sql('ALTER TABLE restaurants DROP COLUMN google_review_url');
