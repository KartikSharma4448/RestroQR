import { AppError } from './AppError';

/**
 * Thrown when a requested resource does not exist.
 * HTTP 404 - Not Found
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}
