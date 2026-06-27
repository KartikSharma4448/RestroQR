import { Request, Response, NextFunction } from 'express';
import { errorHandler } from './errorHandler';
import {
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  FileTooLargeError,
  UnsupportedFormatError,
  RateLimitError,
} from '../errors';

// Helper to create mock request/response/next
function createMocks() {
  const req = {} as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe('errorHandler middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('AppError handling', () => {
    it('should return 400 for ValidationError with details', () => {
      const { req, res, next } = createMocks();
      const details = [{ field: 'email', message: 'Email is required' }];
      const err = new ValidationError('Invalid input', details);

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details,
          }),
        })
      );
    });

    it('should return 401 for AuthenticationError', () => {
      const { req, res, next } = createMocks();
      const err = new AuthenticationError();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication failed',
          }),
        })
      );
    });

    it('should return 403 for ForbiddenError', () => {
      const { req, res, next } = createMocks();
      const err = new ForbiddenError('Account is disabled', 'ACCOUNT_DISABLED');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'ACCOUNT_DISABLED',
            message: 'Account is disabled',
          }),
        })
      );
    });

    it('should return 404 for NotFoundError', () => {
      const { req, res, next } = createMocks();
      const err = new NotFoundError('Restaurant not found');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Restaurant not found',
          }),
        })
      );
    });

    it('should return 409 for ConflictError', () => {
      const { req, res, next } = createMocks();
      const err = new ConflictError('Email already registered');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CONFLICT',
            message: 'Email already registered',
          }),
        })
      );
    });

    it('should return 413 for FileTooLargeError', () => {
      const { req, res, next } = createMocks();
      const err = new FileTooLargeError();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'FILE_TOO_LARGE',
          }),
        })
      );
    });

    it('should return 415 for UnsupportedFormatError', () => {
      const { req, res, next } = createMocks();
      const err = new UnsupportedFormatError();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(415);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNSUPPORTED_FORMAT',
          }),
        })
      );
    });

    it('should return 429 for RateLimitError', () => {
      const { req, res, next } = createMocks();
      const err = new RateLimitError();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'RATE_LIMITED',
          }),
        })
      );
    });

    it('should not include details when empty', () => {
      const { req, res, next } = createMocks();
      const err = new NotFoundError();

      errorHandler(err, req, res, next);

      const responseBody = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseBody.error.details).toBeUndefined();
    });
  });

  describe('Unknown error handling', () => {
    it('should return 500 for generic errors', () => {
      const { req, res, next } = createMocks();
      process.env.NODE_ENV = 'production';
      const err = new Error('Something broke');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          }),
        })
      );
    });

    it('should not expose original error message in production', () => {
      const { req, res, next } = createMocks();
      process.env.NODE_ENV = 'production';
      const err = new Error('Database connection failed: password invalid');

      errorHandler(err, req, res, next);

      const responseBody = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseBody.error.message).toBe('An unexpected error occurred');
      expect(responseBody.error.stack).toBeUndefined();
    });
  });

  describe('Stack trace handling', () => {
    it('should include stack trace in development for AppError', () => {
      const { req, res, next } = createMocks();
      process.env.NODE_ENV = 'development';
      const err = new NotFoundError('Item not found');

      errorHandler(err, req, res, next);

      const responseBody = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseBody.error.stack).toBeDefined();
      expect(responseBody.error.stack).toContain('NotFoundError');
    });

    it('should include stack trace in development for unknown errors', () => {
      const { req, res, next } = createMocks();
      process.env.NODE_ENV = 'development';
      const err = new Error('Unexpected failure');

      errorHandler(err, req, res, next);

      const responseBody = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseBody.error.stack).toBeDefined();
      expect(responseBody.error.message).toBe('Unexpected failure');
    });

    it('should strip stack trace in production for AppError', () => {
      const { req, res, next } = createMocks();
      process.env.NODE_ENV = 'production';
      const err = new NotFoundError();

      errorHandler(err, req, res, next);

      const responseBody = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseBody.error.stack).toBeUndefined();
    });

    it('should strip stack trace in production for unknown errors', () => {
      const { req, res, next } = createMocks();
      process.env.NODE_ENV = 'production';
      const err = new Error('Secret error details');

      errorHandler(err, req, res, next);

      const responseBody = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseBody.error.stack).toBeUndefined();
    });
  });

  describe('Logging', () => {
    it('should log the full error internally', () => {
      const { req, res, next } = createMocks();
      const err = new ValidationError('Bad input');

      errorHandler(err, req, res, next);

      expect(console.error).toHaveBeenCalledWith(
        '[Error]',
        expect.objectContaining({
          name: 'ValidationError',
          message: 'Bad input',
        })
      );
    });
  });
});
