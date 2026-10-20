import { Request, Response, NextFunction } from 'express';
import { authenticate, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { signToken } from '../../utils/token';
import pool from '../../config/database';

const TEST_SECRET = 'test-secret-key-for-jwt';

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

// Mock the database pool
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

const mockPool = pool as jest.Mocked<typeof pool>;

function createMockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function createMockReq(headers: Record<string, string> = {}): AuthenticatedRequest {
  return { headers } as AuthenticatedRequest;
}

describe('authenticate middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should return 401 if no Authorization header is present', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Missing or invalid authorization token',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if Authorization header does not start with Bearer', async () => {
    const req = createMockReq({ authorization: 'Basic abc123' });
    const res = createMockRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid', async () => {
    const req = createMockReq({ authorization: 'Bearer invalid-token' });
    const res = createMockRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Invalid or expired token',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next and attach user for a valid admin token', async () => {
    const token = signToken('admin-1', 'admin');
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.sub).toBe('admin-1');
    expect(req.user!.role).toBe('admin');
  });

  it('should call next for a valid owner token with active account', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ status: 'active' }],
    });

    const token = signToken('owner-1', 'owner');
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();

    await authenticate(req, res, next);

    expect(mockPool.query).toHaveBeenCalledWith(
      'SELECT status FROM owners WHERE id = $1',
      ['owner-1']
    );
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.sub).toBe('owner-1');
    expect(req.user!.role).toBe('owner');
  });

  it('should return 403 ACCOUNT_DISABLED for a disabled owner', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ status: 'disabled' }],
    });

    const token = signToken('owner-2', 'owner');
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'Your account has been disabled. Please contact support.',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if owner not found in database', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [],
    });

    const token = signToken('nonexistent-owner', 'owner');
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Account not found',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 500 if database query fails', async () => {
    (mockPool.query as jest.Mock).mockRejectedValueOnce(
      new Error('Connection failed')
    );

    const token = signToken('owner-3', 'owner');
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  it('should return 401 if no user is attached to request', () => {
    const req = createMockReq() as AuthenticatedRequest;
    const res = createMockRes();

    const middleware = requireRole('admin');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication required',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 FORBIDDEN if user role does not match', () => {
    const req = createMockReq() as AuthenticatedRequest;
    req.user = { sub: 'owner-1', role: 'owner', iat: 0, exp: 0 };
    const res = createMockRes();

    const middleware = requireRole('admin');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next if user role matches admin', () => {
    const req = createMockReq() as AuthenticatedRequest;
    req.user = { sub: 'admin-1', role: 'admin', iat: 0, exp: 0 };
    const res = createMockRes();

    const middleware = requireRole('admin');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should call next if user role matches owner', () => {
    const req = createMockReq() as AuthenticatedRequest;
    req.user = { sub: 'owner-1', role: 'owner', iat: 0, exp: 0 };
    const res = createMockRes();

    const middleware = requireRole('owner');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
