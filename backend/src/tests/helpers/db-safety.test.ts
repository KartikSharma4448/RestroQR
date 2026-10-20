import { getTestPool, closeTestPool } from './db';

const environment = { ...process.env };
afterEach(async () => {
  await closeTestPool();
  process.env = { ...environment };
});

it('rejects destructive tests against a non-test database name', () => {
  process.env.TEST_DATABASE_URL = 'postgresql://user:password@127.0.0.1:65432/restroqr';
  expect(() => getTestPool()).toThrow('must name a test database');
});

it('does not fall back to the production application connection', () => {
  delete process.env.TEST_DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://user:password@production.invalid:5432/restroqr';
  const pool = getTestPool();
  expect(pool.options.connectionString).toContain('127.0.0.1:5432/restroqr_test');
});
