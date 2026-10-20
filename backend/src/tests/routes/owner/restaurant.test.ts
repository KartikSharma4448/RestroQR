import {
  validateRestaurantInput,
  validateImageFile,
  UploadedFile,
} from '../../../services/ownerRestaurantService';
import { ValidationError } from '../../../errors/ValidationError';
import { FileTooLargeError } from '../../../errors/FileTooLargeError';
import { UnsupportedFormatError } from '../../../errors/UnsupportedFormatError';

describe('Owner Restaurant Service - Validation', () => {
  describe('validateRestaurantInput (create)', () => {
    it('should pass with valid input', () => {
      expect(() =>
        validateRestaurantInput(
          { name: 'Test Restaurant', address: '123 Main St', phone: '1234567890', ownerId: 'uuid' },
          true
        )
      ).not.toThrow();
    });

    it('should reject missing name', () => {
      expect(() =>
        validateRestaurantInput(
          { name: '', address: '123 Main St', phone: '1234567890', ownerId: 'uuid' },
          true
        )
      ).toThrow(ValidationError);
    });

    it('should reject missing address', () => {
      expect(() =>
        validateRestaurantInput(
          { name: 'Test', address: '', phone: '1234567890', ownerId: 'uuid' },
          true
        )
      ).toThrow(ValidationError);
    });

    it('should reject missing phone', () => {
      expect(() =>
        validateRestaurantInput(
          { name: 'Test', address: '123 Main St', phone: '', ownerId: 'uuid' },
          true
        )
      ).toThrow(ValidationError);
    });

    it('should reject name exceeding 100 characters', () => {
      expect(() =>
        validateRestaurantInput(
          { name: 'x'.repeat(101), address: '123 Main St', phone: '1234567890', ownerId: 'uuid' },
          true
        )
      ).toThrow(ValidationError);
    });

    it('should reject address exceeding 250 characters', () => {
      expect(() =>
        validateRestaurantInput(
          { name: 'Test', address: 'x'.repeat(251), phone: '1234567890', ownerId: 'uuid' },
          true
        )
      ).toThrow(ValidationError);
    });

    it('should reject phone exceeding 20 characters', () => {
      expect(() =>
        validateRestaurantInput(
          { name: 'Test', address: '123 Main St', phone: '1'.repeat(21), ownerId: 'uuid' },
          true
        )
      ).toThrow(ValidationError);
    });

    it('should collect multiple validation errors', () => {
      try {
        validateRestaurantInput(
          { name: '', address: '', phone: '', ownerId: 'uuid' },
          true
        );
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        const err = e as ValidationError;
        expect(err.details).toHaveLength(3);
      }
    });
  });

  describe('validateRestaurantInput (update)', () => {
    it('should pass with partial valid input', () => {
      expect(() =>
        validateRestaurantInput({ name: 'Updated Name' }, false)
      ).not.toThrow();
    });

    it('should pass with no fields (no-op update)', () => {
      expect(() => validateRestaurantInput({}, false)).not.toThrow();
    });

    it('should reject invalid name when provided for update', () => {
      expect(() =>
        validateRestaurantInput({ name: '' }, false)
      ).toThrow(ValidationError);
    });
  });

  describe('validateImageFile', () => {
    const makeFile = (overrides: Partial<UploadedFile> = {}): UploadedFile => ({
      fieldname: 'logo',
      originalname: 'test.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('fake'),
      ...overrides,
    });

    it('should accept JPEG files', () => {
      expect(() => validateImageFile(makeFile({ mimetype: 'image/jpeg' }))).not.toThrow();
    });

    it('should accept PNG files', () => {
      expect(() => validateImageFile(makeFile({ mimetype: 'image/png' }))).not.toThrow();
    });

    it('should accept WebP files', () => {
      expect(() => validateImageFile(makeFile({ mimetype: 'image/webp' }))).not.toThrow();
    });

    it('should reject GIF files', () => {
      expect(() =>
        validateImageFile(makeFile({ mimetype: 'image/gif' }))
      ).toThrow(UnsupportedFormatError);
    });

    it('should reject PDF files', () => {
      expect(() =>
        validateImageFile(makeFile({ mimetype: 'application/pdf' }))
      ).toThrow(UnsupportedFormatError);
    });

    it('should reject files larger than 5MB', () => {
      expect(() =>
        validateImageFile(makeFile({ size: 5 * 1024 * 1024 + 1 }))
      ).toThrow(FileTooLargeError);
    });

    it('should accept files exactly 5MB', () => {
      expect(() =>
        validateImageFile(makeFile({ size: 5 * 1024 * 1024 }))
      ).not.toThrow();
    });
  });
});
