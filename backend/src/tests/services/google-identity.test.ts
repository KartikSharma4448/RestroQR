jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => [{ name: 'restroqr-owner-auth-restroqr2' }]),
  initializeApp: jest.fn(), applicationDefault: jest.fn(),
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

import { getAuth } from 'firebase-admin/auth';
import { verifyGoogleIdentity } from '../../services/googleIdentityService';

describe('Firebase Google identity verification', () => {
  const verify = jest.fn();
  const prior = { enabled: process.env.GOOGLE_OWNER_AUTH_ENABLED,
    project: process.env.FIREBASE_PROJECT_ID, emulator: process.env.FIREBASE_AUTH_EMULATOR_HOST };
  const claims = () => ({ uid: 'uid', email: 'Owner@Example.test', email_verified: true,
    aud: 'restroqr2', iss: 'https://securetoken.google.com/restroqr2',
    auth_time: Math.floor(Date.now() / 1000),
    firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['subject'] } } });
  beforeEach(() => {
    process.env.GOOGLE_OWNER_AUTH_ENABLED = 'true';
    process.env.FIREBASE_PROJECT_ID = 'restroqr2';
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    verify.mockReset().mockResolvedValue(claims());
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken: verify });
  });
  afterAll(() => {
    for (const [key, value] of Object.entries({ GOOGLE_OWNER_AUTH_ENABLED: prior.enabled,
      FIREBASE_PROJECT_ID: prior.project, FIREBASE_AUTH_EMULATOR_HOST: prior.emulator })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  it('verifies revocation and normalizes the verified identity', async () => {
    await expect(verifyGoogleIdentity('token')).resolves.toEqual({ uid: 'uid', subject: 'subject', email: 'owner@example.test' });
    expect(verify).toHaveBeenCalledWith('token', true);
  });
  it.each([null, 123, '', ' '.repeat(10), 'a'.repeat(16385)])('rejects malformed input', async (input) => {
    await expect(verifyGoogleIdentity(input)).rejects.toThrow();
    expect(verify).not.toHaveBeenCalled();
  });
  it.each([
    { email_verified: false }, { aud: 'other' }, { iss: 'https://invalid.test' },
    { email: 'invalid' }, { auth_time: 0 }, { auth_time: Infinity }, { uid: '' },
    { firebase: { sign_in_provider: 'password', identities: { 'google.com': ['subject'] } } },
    { firebase: { sign_in_provider: 'google.com', identities: {} } },
  ])('rejects invalid identity claims: %j', async (override) => {
    verify.mockResolvedValue({ ...claims(), ...override });
    await expect(verifyGoogleIdentity('token')).rejects.toMatchObject({ statusCode: 401 });
  });
  it('fails closed until enabled', async () => {
    process.env.GOOGLE_OWNER_AUTH_ENABLED = 'false';
    await expect(verifyGoogleIdentity('token')).rejects.toMatchObject({ statusCode: 503 });
  });
  it('refuses emulator tokens even when enabled', async () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    await expect(verifyGoogleIdentity('token')).rejects.toMatchObject({ statusCode: 503 });
    expect(verify).not.toHaveBeenCalled();
  });
  it('redacts Firebase errors', async () => {
    verify.mockRejectedValue(new Error('secret token content'));
    await expect(verifyGoogleIdentity('token')).rejects.toThrow('Google verification failed. Please sign in again.');
  });
});
