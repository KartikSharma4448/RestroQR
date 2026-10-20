import { AppError } from './AppError';

/**
 * Thrown when a client exceeds the rate limit.
 * HTTP 429 - Too Many Requests
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests, please try again later') {
    super(message, 429, 'RATE_LIMITED');
  }
}
