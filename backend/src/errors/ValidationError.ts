import { AppError } from './AppError';

export interface ValidationDetail {
  field: string;
  message: string;
}

/**
 * Thrown when request input fails validation.
 * HTTP 400 - Bad Request
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: ValidationDetail[]) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}
