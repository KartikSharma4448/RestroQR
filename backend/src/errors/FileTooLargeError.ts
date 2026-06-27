import { AppError } from './AppError';

/**
 * Thrown when an uploaded file exceeds the size limit.
 * HTTP 413 - Payload Too Large
 */
export class FileTooLargeError extends AppError {
  constructor(message: string = 'File size exceeds the allowed limit') {
    super(message, 413, 'FILE_TOO_LARGE');
  }
}
