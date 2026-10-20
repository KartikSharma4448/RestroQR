import { AppError } from './AppError';

/**
 * Thrown when authentication fails (invalid credentials).
 * HTTP 401 - Unauthorized
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_FAILED');
  }
}
