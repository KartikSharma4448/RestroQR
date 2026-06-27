import { AppError } from './AppError';

/**
 * Thrown when a request conflicts with existing data (e.g., duplicate registration).
 * HTTP 409 - Conflict
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}
