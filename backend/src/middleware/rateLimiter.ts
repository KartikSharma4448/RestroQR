import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Standard rate limiter for public routes.
 * Allows 60 requests per minute per IP address.
 */
export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per window per IP
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again shortly',
      },
    });
  },
});

/**
 * Stricter rate limiter for authentication endpoints (login/register).
 * Allows 10 requests per minute per IP to prevent brute force attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again shortly',
      },
    });
  },
});
