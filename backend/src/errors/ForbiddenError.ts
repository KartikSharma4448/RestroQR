import { AppError } from './AppError';

/**
 * Thrown when user is authenticated but lacks permission or their account is disabled.
 * HTTP 403 - Forbidden
 */
export class ForbiddenError extends AppError {
  constructor(
    message: string = 'Access denied',
    code: string = 'FORBIDDEN'
  ) {
    super(message, 403, code);
  }
}
