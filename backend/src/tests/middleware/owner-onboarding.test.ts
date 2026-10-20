jest.mock('../../config/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../utils/token', () => ({ verifyToken: jest.fn(() => ({ sub: 'owner-id', role: 'owner' })) }));
import pool from '../../config/database';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { Response } from 'express';

describe('new-owner Google onboarding restriction', () => {
  const prior = process.env.OWNER_EMAIL_SIGNUP_ENABLED;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OWNER_EMAIL_SIGNUP_ENABLED = 'true';
    (pool.query as jest.Mock).mockResolvedValue({ rows: [{ status: 'active', requires_google_link: true }] });
  });
  afterAll(() => {
    if (prior === undefined) delete process.env.OWNER_EMAIL_SIGNUP_ENABLED;
    else process.env.OWNER_EMAIL_SIGNUP_ENABLED = prior;
  });
  it.each(['/api/owner/categories', '/api/owner/items/123', '/api/owner/tables'])('blocks business actions at %s', async (path) => {
    const req = { headers: { authorization: 'Bearer token' }, originalUrl: path } as AuthenticatedRequest;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await authenticate(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it.each(['/api/auth/google/link', '/api/auth/onboarding', '/api/owner/restaurant', '/api/owner/notifications/register'])('allows setup at %s', async (path) => {
    const req = { headers: { authorization: 'Bearer token' }, originalUrl: path } as AuthenticatedRequest;
    const next = jest.fn();
    await authenticate(req, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
  it('preserves existing owners that do not require linking', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [{ status: 'active', requires_google_link: false }] });
    const next = jest.fn();
    await authenticate({ headers: { authorization: 'Bearer token' }, originalUrl: '/api/owner/orders' } as AuthenticatedRequest,
      {} as Response, next);
    expect(next).toHaveBeenCalled();
  });
});
