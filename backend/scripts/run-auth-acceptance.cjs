const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');

const connection = process.env.RESTROQR_ACCEPTANCE_DATABASE_URL;
if (!connection) {
  console.error('Set RESTROQR_ACCEPTANCE_DATABASE_URL to a disposable local restroqr_auth_acceptance_* database.');
  process.exit(1);
}
let target;
try { target = new URL(connection); } catch { process.exit(1); }
if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.hostname !== '127.0.0.1' ||
    !/^\/restroqr_auth_acceptance_[a-z0-9_]+$/.test(target.pathname) || target.search || target.hash) {
  console.error('Refusing database target: acceptance tests require an explicitly named disposable database on 127.0.0.1.');
  process.exit(1);
}
const env = { ...process.env, DATABASE_URL: connection, NODE_ENV: 'test',
  WAITER_CALLING_ENABLED:'false',
  LOYALTY_ENABLED:'false', CUSTOMER_REVIEWS_ENABLED:'false', CUSTOMER_BASE_URL:'http://127.0.0.1:3001',
  OWNER_EMAIL_SIGNUP_ENABLED: 'true', GOOGLE_OWNER_AUTH_ENABLED: 'true',
  OWNER_PROFILE_ACTIVATION_ENABLED: 'true', TABLE_TOKEN_SECRET: randomBytes(32).toString('hex'),
  MENU_MEDIA_ENABLED: 'true',
  MENU_OPTIONS_ENABLED: 'true',
  CUSTOMER_EMAIL_ORDERING_ENABLED: 'false', ORDER_EMAIL_DELIVERY_ENABLED: 'false', PAYMENT_RECEIPT_EMAIL_ENABLED: 'false', ORDER_PAYMENTS_ENABLED: 'false', ORDER_LIFECYCLE_EMAIL_ENABLED: 'false', ORDER_EMAIL_DELIVERY_NOT_BEFORE: '',
  EMAIL_OTP_SECRET: randomBytes(32).toString('hex'), JWT_SECRET: randomBytes(32).toString('hex'),
  RESEND_API_KEY: 'acceptance-tests-never-send-email', RESEND_FROM_EMAIL: 'test@example.test',
};
// No dotenv import: a production DATABASE_URL must never be a fallback here.
const run = (script, args) => spawnSync(process.execPath, [script, ...args], {
  cwd: require('node:path').resolve(__dirname, '..'), env, stdio: 'inherit',
});
const migration = run(require.resolve('node-pg-migrate/bin/node-pg-migrate'),
  ['up', '--migrations-dir', 'migrations', '--migration-file-language', 'js']);
if (migration.status !== 0) process.exit(migration.status || 1);
const tests = run(require.resolve('jest/bin/jest'), [
  '--runInBand', '--testMatch', '**/acceptance/*.postgres.ts',
]);
process.exit(tests.status || (tests.error ? 1 : 0));
