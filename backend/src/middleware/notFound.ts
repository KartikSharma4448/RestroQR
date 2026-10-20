import { Request, Response } from 'express';

/**
 * Catch-all middleware for undefined routes.
 * Returns a 404 JSON response. Must be registered AFTER all route handlers
 * but BEFORE the error handler.
 */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
