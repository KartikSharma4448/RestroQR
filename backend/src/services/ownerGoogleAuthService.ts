import pool from '../config/database';
import { AuthenticationError, ConflictError, ForbiddenError } from '../errors';
import { signToken } from '../utils/token';
import { verifyGoogleIdentity } from './googleIdentityService';

export async function linkOwnerGoogle(ownerId: string, idToken: unknown) {
  const identity = await verifyGoogleIdentity(idToken);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT id, email, status, firebase_uid, google_subject FROM owners WHERE id = $1 FOR UPDATE',
      [ownerId],
    );
    const owner = result.rows[0];
    if (!owner) throw new AuthenticationError('Account not found');
    if (owner.status === 'disabled') throw new ForbiddenError('Account disabled', 'ACCOUNT_DISABLED');
    if (typeof owner.email !== 'string' || owner.email.trim().toLowerCase() !== identity.email) {
      throw new ConflictError('Use the Google account matching your owner email');
    }
    if ((owner.firebase_uid && owner.firebase_uid !== identity.uid) ||
        (owner.google_subject && owner.google_subject !== identity.subject)) {
      throw new ConflictError('A different Google identity is already linked');
    }
    await client.query(
      `UPDATE owners SET firebase_uid = $1, google_subject = $2,
       google_linked_at = COALESCE(google_linked_at, NOW()) WHERE id = $3`,
      [identity.uid, identity.subject, ownerId],
    );
    if (process.env.OWNER_EMAIL_SIGNUP_ENABLED === 'true') {
      await client.query('UPDATE owners SET requires_google_link=false WHERE id=$1', [ownerId]);
    }
    await client.query('COMMIT');
    return { googleLinked: true };
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') {
      throw new ConflictError('Google identity is already linked to another account');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function loginOwnerGoogle(idToken: unknown) {
  const identity = await verifyGoogleIdentity(idToken);
  // Never attach an identity or create a new owner using an email-only lookup.
  const result = await pool.query(
    `SELECT id, name, email, status FROM owners
     WHERE firebase_uid = $1 AND google_subject = $2`,
    [identity.uid, identity.subject],
  );
  const owner = result.rows[0];
  if (!owner || typeof owner.email !== 'string' ||
      owner.email.trim().toLowerCase() !== identity.email) {
    throw new AuthenticationError('Sign in with your password first to connect Google');
  }
  if (owner.status === 'disabled') throw new ForbiddenError('Account disabled', 'ACCOUNT_DISABLED');
  return { token: signToken(owner.id, 'owner'), user: { id: owner.id, name: owner.name, role: 'owner' } };
}
