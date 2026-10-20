import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import pool from '../config/database';
import { AppError, AuthenticationError, ConflictError, ValidationError } from '../errors';
import { RegisterInput, validateRegisterInput } from './authService';
import { sendTransactionalEmail } from './emailService';
import { signToken } from '../utils/token';
import { generateEmailOtp, hashEmailOtp, matchesEmailOtp, EMAIL_OTP_TTL_MS,
  EMAIL_OTP_MAX_ATTEMPTS, EMAIL_OTP_RESEND_COOLDOWN_MS } from '../utils/emailOtp';

export function emailSignupEnabled(): boolean {
  return process.env.OWNER_EMAIL_SIGNUP_ENABLED === 'true';
}

function otpSecret(): string {
  const secret = process.env.EMAIL_OTP_SECRET ?? '';
  if (!emailSignupEnabled() || process.env.GOOGLE_OWNER_AUTH_ENABLED !== 'true' ||
      Buffer.byteLength(secret) < 32 || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new AppError('Email signup is not available yet', 503, 'SIGNUP_UNAVAILABLE');
  }
  return secret;
}

function retryLater(): never {
  throw new AppError('Please wait before requesting another code', 429, 'OTP_RATE_LIMITED');
}

export async function startOwnerSignup(input: RegisterInput) {
  const secret = otpSecret();
  validateRegisterInput(input);
  if (typeof input.email !== 'string' || !input.email.trim() || input.email.trim().length > 255 ||
      input.name.trim().length > 100 || Buffer.byteLength(input.password) > 72) {
    throw new ValidationError('A valid email, name and password of at most 72 bytes are required');
  }
  const email = input.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize requests for an email, including when no challenge exists yet.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [email]);
    const accounts = await client.query(
      `SELECT id FROM owners WHERE LOWER(email) = $1
       UNION ALL SELECT id FROM admins WHERE LOWER(email) = $1`, [email],
    );
    if (accounts.rows.length) throw new ConflictError('An account with this email already exists');
    const previous = (await client.query(
      'SELECT * FROM owner_signup_challenges WHERE email = $1 FOR UPDATE', [email],
    )).rows[0];
    const now = Date.now();
    const sameWindow = previous && now - new Date(previous.window_started_at).getTime() < 3600000;
    if (previous && now - new Date(previous.sent_at).getTime() < EMAIL_OTP_RESEND_COOLDOWN_MS) retryLater();
    if (sameWindow && (previous.send_count >= 5 || previous.attempts >= EMAIL_OTP_MAX_ATTEMPTS)) retryLater();
    const challengeId = randomUUID();
    const code = generateEmailOtp();
    await client.query(
      `INSERT INTO owner_signup_challenges
       (id,email,name,phone,password_hash,code_hash,expires_at,sent_at,window_started_at,send_count,attempts,consumed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL)
       ON CONFLICT (email) DO UPDATE SET id=EXCLUDED.id,name=EXCLUDED.name,phone=EXCLUDED.phone,
       password_hash=EXCLUDED.password_hash,code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,
       sent_at=EXCLUDED.sent_at,window_started_at=EXCLUDED.window_started_at,
       send_count=EXCLUDED.send_count,attempts=EXCLUDED.attempts,consumed_at=NULL`,
      [challengeId, email, input.name.trim(), input.phone?.trim() || null, passwordHash,
        hashEmailOtp(challengeId, code, secret), new Date(now + EMAIL_OTP_TTL_MS), new Date(now),
        sameWindow ? previous.window_started_at : new Date(now),
        sameWindow ? previous.send_count + 1 : 1, sameWindow ? previous.attempts : 0],
    );
    // Provider timeout is bounded; rollback preserves the previous valid challenge on failure.
    try {
      await sendTransactionalEmail({ to: email, subject: 'Verify your RestroQR owner email',
        text: `Your RestroQR verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
        idempotencyKey: `owner-signup/${challengeId}` });
    } catch {
      throw new AppError('Verification email could not be sent. Please try again.', 503, 'EMAIL_UNAVAILABLE');
    }
    await client.query('COMMIT');
    return { verificationRequired: true, challengeId, expiresInSeconds: 600, resendAfterSeconds: 60 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function verifyOwnerSignup(challengeId: unknown, code: unknown) {
  const secret = otpSecret();
  if (typeof challengeId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(challengeId) ||
      typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new AuthenticationError('Invalid or expired verification code');
  }
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    const row = (await client.query(
      'SELECT * FROM owner_signup_challenges WHERE id = $1 FOR UPDATE', [challengeId],
    )).rows[0];
    if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now() ||
        row.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
      throw new AuthenticationError('Invalid or expired verification code');
    }
    if (!matchesEmailOtp(challengeId, code, row.code_hash, secret)) {
      // Commit failed guesses so a rollback cannot reset the attempt counter.
      await client.query('UPDATE owner_signup_challenges SET attempts=attempts+1 WHERE id=$1', [challengeId]);
      await client.query('COMMIT');
      committed = true;
      throw new AuthenticationError('Invalid or expired verification code');
    }
    const existing = await client.query(
      `SELECT id FROM owners WHERE LOWER(email)=$1
       UNION ALL SELECT id FROM admins WHERE LOWER(email)=$1`, [row.email],
    );
    if (existing.rows.length) throw new ConflictError('An account with this email already exists');
    const owner = (await client.query(
      `INSERT INTO owners (email,phone,password_hash,name,email_verified_at,requires_google_link)
       VALUES ($1,$2,$3,$4,NOW(),true) RETURNING id,email,phone,name`,
      [row.email, row.phone, row.password_hash, row.name],
    )).rows[0];
    await client.query('UPDATE owner_signup_challenges SET consumed_at=NOW() WHERE id=$1', [challengeId]);
    // Sign before commit so a bad JWT configuration cannot consume the signup.
    const token = signToken(owner.id, 'owner');
    await client.query('COMMIT');
    committed = true;
    return { token, owner, googleConnectionRequired: true };
  } catch (error) {
    if (!committed) await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') throw new ConflictError('Account details already registered');
    throw error;
  } finally { client.release(); }
}

export async function resendOwnerSignup(challengeId: unknown) {
  const secret = otpSecret();
  if (typeof challengeId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(challengeId)) {
    throw new AuthenticationError('Restart signup to request a new code');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query(
      'SELECT * FROM owner_signup_challenges WHERE id=$1 FOR UPDATE', [challengeId],
    )).rows[0];
    const now = Date.now();
    if (!row || row.consumed_at || now - new Date(row.window_started_at).getTime() >= 3600000) {
      throw new AuthenticationError('Restart signup to request a new code');
    }
    if (now - new Date(row.sent_at).getTime() < EMAIL_OTP_RESEND_COOLDOWN_MS ||
        row.attempts >= EMAIL_OTP_MAX_ATTEMPTS || row.send_count >= 5) retryLater();
    const code = generateEmailOtp();
    await client.query(
      `UPDATE owner_signup_challenges SET code_hash=$1, expires_at=$2, sent_at=$3,
       send_count=send_count+1 WHERE id=$4`,
      [hashEmailOtp(challengeId, code, secret), new Date(now + EMAIL_OTP_TTL_MS), new Date(now), challengeId],
    );
    try {
      await sendTransactionalEmail({ to: row.email, subject: 'Verify your RestroQR owner email',
        text: `Your RestroQR verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
        idempotencyKey: `owner-signup/${challengeId}/${row.send_count + 1}` });
    } catch {
      throw new AppError('Verification email could not be sent. Please try again.', 503, 'EMAIL_UNAVAILABLE');
    }
    await client.query('COMMIT');
    return { challengeId, expiresInSeconds: 600, resendAfterSeconds: 60 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
