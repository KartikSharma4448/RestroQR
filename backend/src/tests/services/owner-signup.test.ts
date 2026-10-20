jest.mock('../../config/database', () => ({ __esModule: true, default: { connect: jest.fn() } }));
jest.mock('bcrypt', () => ({ hash: jest.fn(async () => 'password-hash') }));
jest.mock('../../services/emailService', () => ({ sendTransactionalEmail: jest.fn(async () => 'mail-id') }));
jest.mock('../../utils/token', () => ({ signToken: jest.fn(() => 'owner-session') }));

import pool from '../../config/database';
import { sendTransactionalEmail } from '../../services/emailService';
import { hashEmailOtp } from '../../utils/emailOtp';
import { startOwnerSignup, verifyOwnerSignup, resendOwnerSignup } from '../../services/ownerSignupService';

const id = '11111111-2222-4333-8444-555555555555';
const secret = 'a-test-only-secret-longer-than-thirty-two-bytes';
const input = { email: 'Owner@Example.test', name: 'Owner', password: 'password123' };

describe('email OTP owner signup', () => {
  const query = jest.fn();
  const release = jest.fn();
  const keys = ['OWNER_EMAIL_SIGNUP_ENABLED', 'GOOGLE_OWNER_AUTH_ENABLED', 'EMAIL_OTP_SECRET',
    'RESEND_API_KEY', 'RESEND_FROM_EMAIL'];
  const prior = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  let pending: Record<string, unknown> | undefined;
  let accounts: unknown[];
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OWNER_EMAIL_SIGNUP_ENABLED = 'true';
    process.env.GOOGLE_OWNER_AUTH_ENABLED = 'true';
    process.env.EMAIL_OTP_SECRET = secret;
    process.env.RESEND_API_KEY = 'fake-test-key';
    process.env.RESEND_FROM_EMAIL = 'mail@example.test';
    pending = undefined;
    accounts = [];
    (sendTransactionalEmail as jest.Mock).mockResolvedValue('mail-id');
    (pool.connect as jest.Mock).mockResolvedValue({ query, release });
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM owner_signup_challenges')) return { rows: pending ? [pending] : [] };
      if (sql.includes('FROM owners')) return { rows: accounts };
      if (sql.includes('INSERT INTO owners')) return { rows: [{ id: 'owner-id', email: input.email.toLowerCase(), name: input.name }] };
      return { rows: [] };
    });
  });
  afterAll(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  function validPending() {
    return { id, email: 'owner@example.test', name: 'Owner', phone: null,
      password_hash: 'password-hash', code_hash: hashEmailOtp(id, '123456', secret),
      expires_at: new Date(Date.now() + 600000), attempts: 0, consumed_at: null,
      sent_at: new Date(Date.now() - 120000), window_started_at: new Date(), send_count: 1 };
  }
  it('sends an OTP without creating an owner or returning a session/code', async () => {
    const result = await startOwnerSignup(input);
    expect(result).toMatchObject({ verificationRequired: true, expiresInSeconds: 600 });
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('code');
    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO owner_signup_challenges'));
    expect(insert![1][1]).toBe('owner@example.test');
    expect(insert![1][5]).toMatch(/^[a-f0-9]{64}$/);
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO owners'))).toBe(false);
    expect(sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@example.test' }));
    expect(query).toHaveBeenCalledWith('COMMIT');
  });
  it('fails closed while the rollout is disabled', async () => {
    process.env.OWNER_EMAIL_SIGNUP_ENABLED = 'false';
    await expect(startOwnerSignup(input)).rejects.toMatchObject({ statusCode: 503 });
    expect(pool.connect).not.toHaveBeenCalled();
  });
  it.each([
    { ...input, email: undefined, phone: '9999999999' },
    { ...input, name: 'a'.repeat(101) },
    { ...input, password: 'a'.repeat(73) },
  ])('requires bounded signup details: %j', async (details) => {
    await expect(startOwnerSignup(details)).rejects.toMatchObject({ statusCode: 400 });
    expect(pool.connect).not.toHaveBeenCalled();
  });
  it('reserves administrator/owner emails', async () => {
    accounts = [{ id: 'existing' }];
    await expect(startOwnerSignup(input)).rejects.toMatchObject({ statusCode: 409 });
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
  it.each([
    { sent_at: new Date() }, { send_count: 5 }, { attempts: 5 },
  ])('enforces cooldown/send/guess limits: %j', async (override) => {
    pending = { ...validPending(), ...override };
    await expect(startOwnerSignup(input)).rejects.toMatchObject({ statusCode: 429 });
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
  it('does not reset failed guesses on a resent challenge', async () => {
    pending = { ...validPending(), attempts: 3 };
    await startOwnerSignup(input);
    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO owner_signup_challenges'));
    expect(insert![1][10]).toBe(3);
    expect(insert![1][9]).toBe(2);
  });
  it('rolls back on email failure without exposing provider details', async () => {
    (sendTransactionalEmail as jest.Mock).mockRejectedValue(new Error('secret provider failure'));
    await expect(startOwnerSignup(input)).rejects.toMatchObject({ code: 'EMAIL_UNAVAILABLE' });
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(query).not.toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalled();
  });
  it('creates a verified owner requiring Google and consumes OTP atomically', async () => {
    pending = validPending();
    await expect(verifyOwnerSignup(id, '123456')).resolves.toMatchObject({
      token: 'owner-session', googleConnectionRequired: true,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), [id]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('requires_google_link'),
      ['owner@example.test', null, 'password-hash', 'Owner']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('consumed_at=NOW()'), [id]);
    expect(query).toHaveBeenCalledWith('COMMIT');
  });
  it('commits a wrong guess instead of rolling back the attempt counter', async () => {
    pending = validPending();
    await expect(verifyOwnerSignup(id, '654321')).rejects.toMatchObject({ statusCode: 401 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('attempts=attempts+1'), [id]);
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(query).not.toHaveBeenCalledWith('ROLLBACK');
  });
  it.each([
    { consumed_at: new Date() }, { expires_at: new Date(0) }, { attempts: 5 },
  ])('rejects replay, expiry or exhausted attempts: %j', async (override) => {
    pending = { ...validPending(), ...override };
    await expect(verifyOwnerSignup(id, '123456')).rejects.toMatchObject({ statusCode: 401 });
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO owners'))).toBe(false);
  });
  it('rejects malformed challenge IDs before querying PostgreSQL', async () => {
    await expect(verifyOwnerSignup('-'.repeat(36), '123456')).rejects.toMatchObject({ statusCode: 401 });
    expect(pool.connect).not.toHaveBeenCalled();
  });
  it('resends without resetting the stored failed guess counter', async () => {
    pending = { ...validPending(), attempts: 3 };
    await expect(resendOwnerSignup(id)).resolves.toMatchObject({ challengeId: id, resendAfterSeconds: 60 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('send_count=send_count+1'), expect.any(Array));
    expect(query.mock.calls.some(([sql]) => sql.includes('attempts='))).toBe(false);
    expect(sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: `owner-signup/${id}/2` }));
  });
  it.each([{ attempts: 5 }, { send_count: 5 }, { sent_at: new Date() }])(
    'rate-limits resending: %j', async (override) => {
      pending = { ...validPending(), ...override };
      await expect(resendOwnerSignup(id)).rejects.toMatchObject({ statusCode: 429 });
      expect(sendTransactionalEmail).not.toHaveBeenCalled();
    },
  );
  it('never resends a consumed challenge', async () => {
    pending = { ...validPending(), consumed_at: new Date() };
    await expect(resendOwnerSignup(id)).rejects.toMatchObject({ statusCode: 401 });
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
});
