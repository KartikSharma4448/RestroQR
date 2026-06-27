import { AppError } from './AppError';

/**
 * Thrown when an uploaded file has an unsupported format.
 * HTTP 415 - Unsupported Media Type
 */
export class UnsupportedFormatError extends AppError {
  constructor(message: string = 'File format is not supported') {
    super(message, 415, 'UNSUPPORTED_FORMAT');
  }
}
