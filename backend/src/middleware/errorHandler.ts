import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';

/**
 * Error response structure sent to clients.
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown[];
    stack?: string;
  };
}

/**
 * Global error handling middleware.
 * Must be registered as the LAST middleware in the Express app.
 *
 * - Known errors (AppError instances) return their defined status code and structured response.
 * - Unknown errors return 500 with a generic message.
 * - Stack traces are included only in development mode.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // Log full error internally regardless of environment
  console.error('[Error]', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    ...(err instanceof AppError && {
      code: err.code,
      statusCode: err.statusCode,
      details: err.details,
    }),
  });

  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && err.details.length > 0 && { details: err.details }),
      },
    };

    // Include stack trace in development
    if (!isProduction) {
      response.error.stack = err.stack;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Unknown/unexpected errors — never leak internals
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };

  // Include stack trace in development for debugging
  if (!isProduction) {
    response.error.message = err.message || 'An unexpected error occurred';
    response.error.stack = err.stack;
  }

  res.status(500).json(response);
}
