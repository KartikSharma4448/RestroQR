jest.mock('../../config/database', () => ({ __esModule: true, default: {
  query: jest.fn(), connect: jest.fn(),
} }));
jest.mock('../../services/googleIdentityService', () => ({ verifyGoogleIdentity: jest.fn() }));
jest.mock('../../utils/token', () => ({ signToken: jest.fn(() => 'owner-jwt') }));

import pool from '../../config/database';
import { verifyGoogleIdentity } from '../../services/googleIdentityService';
import { linkOwnerGoogle, loginOwnerGoogle } from '../../services/ownerGoogleAuthService';

const identity = { uid: 'firebase-user', subject: 'google-subject', email: 'owner@example.test' };
const owner = { id: 'owner-1', name: 'Owner', email: 'Owner@Example.test', status: 'active' };

describe('owner Google account linking and login', () => {
  const query = jest.fn();
  const release = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyGoogleIdentity as jest.Mock).mockResolvedValue(identity);
    (pool.connect as jest.Mock).mockResolvedValue({ query, release });
    query.mockReset().mockImplementation(async (sql: string) => ({
      rows: sql.startsWith('SELECT') ? [owner] : [],
    }));
  });
  it('links a matching email only to the authenticated owner in a transaction', async () => {
    await expect(linkOwnerGoogle('owner-1', 'firebase-token')).resolves.toEqual({ googleLinked: true });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), ['owner-1']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE owners'),
      ['firebase-user', 'google-subject', 'owner-1']);
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalled();
  });
  it.each([
    { ...owner, email: 'other@example.test' },
    { ...owner, email: null },
    { ...owner, firebase_uid: 'another-user' },
    { ...owner, google_subject: 'another-google-user' },
    { ...owner, status: 'disabled' },
  ])('refuses mismatched, missing or disabled owner identity: %j', async (record) => {
    query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('SELECT') ? [record] : [] }));
    await expect(linkOwnerGoogle('owner-1', 'token')).rejects.toThrow();
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE owners'), expect.anything());
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalled();
  });
  it('handles the unique identity race without overwriting another owner', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('UPDATE')) throw Object.assign(new Error(), { code: '23505' });
      return { rows: sql.startsWith('SELECT') ? [owner] : [] };
    });
    await expect(linkOwnerGoogle('owner-1', 'token')).rejects.toMatchObject({ statusCode: 409 });
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });
  it('does no database work when Google verification fails', async () => {
    (verifyGoogleIdentity as jest.Mock).mockRejectedValue(new Error('invalid token'));
    await expect(linkOwnerGoogle('owner-1', 'token')).rejects.toThrow();
    expect(pool.connect).not.toHaveBeenCalled();
  });
  it('logs in only by linked UID and Google subject', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [owner] });
    await expect(loginOwnerGoogle('token')).resolves.toMatchObject({
      token: 'owner-jwt', user: { id: 'owner-1', role: 'owner' },
    });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE firebase_uid = $1 AND google_subject = $2'),
      ['firebase-user', 'google-subject']);
  });
  it.each([
    { rows: [] },
    { rows: [{ ...owner, status: 'disabled' }] },
    { rows: [{ ...owner, email: 'changed@example.test' }] },
  ])(
    'rejects unlinked, disabled or changed email accounts: %j', async (result) => {
      (pool.query as jest.Mock).mockResolvedValue(result);
      await expect(loginOwnerGoogle('token')).rejects.toThrow();
    },
  );
});
