import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { AppError, AuthenticationError } from '../errors';

export interface GoogleIdentity {
  uid: string;
  subject: string;
  email: string;
}

export async function verifyGoogleIdentity(idToken: unknown): Promise<GoogleIdentity> {
  if (process.env.GOOGLE_OWNER_AUTH_ENABLED !== 'true' || !process.env.FIREBASE_PROJECT_ID) {
    throw new AppError('Google sign-in is not available yet', 503, 'GOOGLE_AUTH_UNAVAILABLE');
  }
  if (typeof idToken !== 'string' || idToken.length > 16384 || !idToken.trim()) {
    throw new AuthenticationError('Invalid Google sign-in');
  }
  // Never allow the Admin SDK emulator bypass on an application auth endpoint.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new AppError('Google sign-in configuration is invalid', 503, 'GOOGLE_AUTH_UNAVAILABLE');
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const name = `restroqr-owner-auth-${projectId}`;
  const app = getApps().find((candidate) => candidate.name === name) ?? initializeApp({
    projectId, credential: applicationDefault(),
  }, name);
  try {
    const { getAuth } = await import('firebase-admin/auth');
    // Revocation/disabled-user checks require backend service-account credentials.
    const token = await getAuth(app).verifyIdToken(idToken, true);
    const subjects = token.firebase?.identities?.['google.com'];
    const now = Math.floor(Date.now() / 1000);
    if (token.aud !== projectId || token.iss !== `https://securetoken.google.com/${projectId}` ||
        token.firebase?.sign_in_provider !== 'google.com' || token.email_verified !== true ||
        typeof token.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token.email) ||
        typeof token.uid !== 'string' || !token.uid || token.uid.length > 128 ||
        !Array.isArray(subjects) || subjects.length !== 1 ||
        typeof subjects[0] !== 'string' || !subjects[0] || subjects[0].length > 255 ||
        typeof token.auth_time !== 'number' || !Number.isFinite(token.auth_time) ||
        token.auth_time > now + 60 || now - token.auth_time > 300) {
      throw new AuthenticationError('Please sign in with Google again');
    }
    return { uid: token.uid, subject: subjects[0], email: token.email.trim().toLowerCase() };
  } catch {
    // Do not expose tokens or Firebase error details through API logs/responses.
    throw new AuthenticationError('Google verification failed. Please sign in again.');
  }
}
