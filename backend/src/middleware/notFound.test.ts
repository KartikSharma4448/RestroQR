import { Request, Response } from 'express';
import { notFound } from './notFound';

describe('notFound middleware', () => {
  it('should return 404 with JSON error response', () => {
    const req = { method: 'GET', path: '/api/unknown' } as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;

    notFound(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route GET /api/unknown not found',
      },
    });
  });

  it('should include the HTTP method in the message', () => {
    const req = { method: 'POST', path: '/api/foo' } as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;

    notFound(req, res);

    const responseBody = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseBody.error.message).toBe('Route POST /api/foo not found');
  });
});
