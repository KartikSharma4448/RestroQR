// Feature: restroqr-v1-digital-menu, Property 9: Restaurant token generation correctness
// Feature: restroqr-v1-digital-menu, Property 10: Entity update round-trip
// Feature: restroqr-v1-digital-menu, Property 11: Restaurant profile field validation
// Feature: restroqr-v1-digital-menu, Property 12: Image upload validation

import { fc, assertProperty } from '../helpers/fast-check';
import {
  ValidationError,
  ValidationDetail,
  FileTooLargeError,
  UnsupportedFormatError,
} from '../../errors';

// Mock database pool
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

// Mock nanoid
jest.mock('nanoid', () => ({
  customAlphabet: jest.fn(() => {
    // Return a function that generates random 10-char alphanumeric tokens
    return () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
  }),
}));

// Mock cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
    },
  },
}));

import pool from '../../config/database';
import {
  createRestaurant,
  updateRestaurant,
  validateRestaurantInput,
  validateImageFile,
  CreateRestaurantInput,
  UploadedFile,
} from '../../services/ownerRestaurantService';

const mockPool = pool as jest.Mocked<typeof pool>;

// --- Generators ---

const validNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s: string) => s.trim().length > 0 && s.trim().length <= 100);

const validAddressArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 250 })
  .filter((s: string) => s.trim().length > 0 && s.trim().length <= 250);

const validPhoneArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s: string) => s.trim().length > 0 && s.trim().length <= 20);

const ownerIdArb: fc.Arbitrary<string> = fc.uuid();

const validCreateInputArb: fc.Arbitrary<CreateRestaurantInput> = fc.record({
  name: validNameArb,
  address: validAddressArb,
  phone: validPhoneArb,
  ownerId: ownerIdArb,
});

// Image generators
const validMimeTypeArb: fc.Arbitrary<string> = fc.constantFrom(
  'image/jpeg',
  'image/png',
  'image/webp'
);

const invalidMimeTypeArb: fc.Arbitrary<string> = fc.constantFrom(
  'image/gif',
  'image/bmp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'video/mp4',
  'application/octet-stream'
);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const validFileSizeArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: MAX_FILE_SIZE });
const oversizedFileSizeArb: fc.Arbitrary<number> = fc.integer({
  min: MAX_FILE_SIZE + 1,
  max: 10 * 1024 * 1024,
});

// --- Property 9: Restaurant token generation correctness ---
// **Validates: Requirements 4.2, 7.1, 7.2**

describe('Property 9: Restaurant token generation correctness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('token must be 10 chars, contain only [A-Za-z0-9], and be unique', async () => {
    await assertProperty(
      fc.asyncProperty(
        validCreateInputArb,
        async (input: CreateRestaurantInput) => {
          const now = new Date();

          // Mock: no existing restaurant for this owner
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('SELECT id FROM restaurants WHERE owner_id')) {
              return Promise.resolve({ rows: [] });
            }
            // Mock token uniqueness check — token is unique (no collision)
            if (query.includes('SELECT id FROM restaurants WHERE restaurant_token')) {
              return Promise.resolve({ rows: [] });
            }
            // Mock INSERT returning the created row
            if (query.includes('INSERT INTO restaurants')) {
              return Promise.resolve({
                rows: [{
                  id: 'restaurant-uuid-1',
                  owner_id: input.ownerId,
                  name: input.name.trim(),
                  address: input.address.trim(),
                  phone: input.phone.trim(),
                  logo_url: null,
                  cover_image_url: null,
                  restaurant_token: 'Ab3dEf7hIj', // will be overridden by the actual call
                  status: 'active',
                  created_at: now,
                  updated_at: now,
                }],
              });
            }
            return Promise.resolve({ rows: [] });
          });

          const result = await createRestaurant(input);

          // The restaurant_token in the INSERT call should match /^[A-Za-z0-9]{10}$/
          // We verify the token passed to the DB by inspecting the INSERT call args
          const insertCall = (mockPool.query as jest.Mock).mock.calls.find(
            (call: unknown[]) => (call[0] as string).includes('INSERT INTO restaurants')
          );
          expect(insertCall).toBeDefined();
          const tokenArg = insertCall![1][4]; // 5th param is restaurant_token
          expect(tokenArg).toMatch(/^[A-Za-z0-9]{10}$/);
          expect(tokenArg.length).toBeGreaterThanOrEqual(8);

          // Verify result has expected shape
          expect(result).toBeDefined();
          expect(result.restaurantToken).toBeDefined();
        }
      )
    );
  });

  it('token uniqueness is verified against database before assignment', async () => {
    await assertProperty(
      fc.asyncProperty(
        validCreateInputArb,
        async (input: CreateRestaurantInput) => {
          const now = new Date();
          let tokenCheckCount = 0;

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('SELECT id FROM restaurants WHERE owner_id')) {
              return Promise.resolve({ rows: [] });
            }
            if (query.includes('SELECT id FROM restaurants WHERE restaurant_token')) {
              tokenCheckCount++;
              // First call: collision, second call: unique
              if (tokenCheckCount === 1) {
                return Promise.resolve({ rows: [{ id: 'existing-id' }] });
              }
              return Promise.resolve({ rows: [] });
            }
            if (query.includes('INSERT INTO restaurants')) {
              return Promise.resolve({
                rows: [{
                  id: 'restaurant-uuid-1',
                  owner_id: input.ownerId,
                  name: input.name.trim(),
                  address: input.address.trim(),
                  phone: input.phone.trim(),
                  logo_url: null,
                  cover_image_url: null,
                  restaurant_token: 'Xy9aBcDeFg',
                  status: 'active',
                  created_at: now,
                  updated_at: now,
                }],
              });
            }
            return Promise.resolve({ rows: [] });
          });

          await createRestaurant(input);

          // Should have checked uniqueness at least twice (first collision, then success)
          expect(tokenCheckCount).toBeGreaterThanOrEqual(2);
        }
      )
    );
  });
});

// --- Property 10: Entity update round-trip ---
// **Validates: Requirements 4.3**

describe('Property 10: Entity update round-trip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updating name returns the new name in the result', async () => {
    await assertProperty(
      fc.asyncProperty(
        ownerIdArb,
        validNameArb,
        async (ownerId: string, newName: string) => {
          const now = new Date();

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('SELECT id FROM restaurants WHERE owner_id')) {
              return Promise.resolve({ rows: [{ id: 'rest-id-1' }] });
            }
            if (query.includes('UPDATE restaurants SET')) {
              return Promise.resolve({
                rows: [{
                  id: 'rest-id-1',
                  owner_id: ownerId,
                  name: newName.trim(),
                  address: '123 Main St',
                  phone: '1234567890',
                  logo_url: null,
                  cover_image_url: null,
                  restaurant_token: 'AbCdEfGhIj',
                  status: 'active',
                  created_at: now,
                  updated_at: now,
                }],
              });
            }
            return Promise.resolve({ rows: [] });
          });

          const result = await updateRestaurant(ownerId, { name: newName });

          expect(result.name).toBe(newName.trim());
        }
      )
    );
  });

  it('updating address returns the new address in the result', async () => {
    await assertProperty(
      fc.asyncProperty(
        ownerIdArb,
        validAddressArb,
        async (ownerId: string, newAddress: string) => {
          const now = new Date();

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('SELECT id FROM restaurants WHERE owner_id')) {
              return Promise.resolve({ rows: [{ id: 'rest-id-1' }] });
            }
            if (query.includes('UPDATE restaurants SET')) {
              return Promise.resolve({
                rows: [{
                  id: 'rest-id-1',
                  owner_id: ownerId,
                  name: 'Restaurant Name',
                  address: newAddress.trim(),
                  phone: '1234567890',
                  logo_url: null,
                  cover_image_url: null,
                  restaurant_token: 'AbCdEfGhIj',
                  status: 'active',
                  created_at: now,
                  updated_at: now,
                }],
              });
            }
            return Promise.resolve({ rows: [] });
          });

          const result = await updateRestaurant(ownerId, { address: newAddress });

          expect(result.address).toBe(newAddress.trim());
        }
      )
    );
  });

  it('updating phone returns the new phone in the result', async () => {
    await assertProperty(
      fc.asyncProperty(
        ownerIdArb,
        validPhoneArb,
        async (ownerId: string, newPhone: string) => {
          const now = new Date();

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('SELECT id FROM restaurants WHERE owner_id')) {
              return Promise.resolve({ rows: [{ id: 'rest-id-1' }] });
            }
            if (query.includes('UPDATE restaurants SET')) {
              return Promise.resolve({
                rows: [{
                  id: 'rest-id-1',
                  owner_id: ownerId,
                  name: 'Restaurant Name',
                  address: '123 Main St',
                  phone: newPhone.trim(),
                  logo_url: null,
                  cover_image_url: null,
                  restaurant_token: 'AbCdEfGhIj',
                  status: 'active',
                  created_at: now,
                  updated_at: now,
                }],
              });
            }
            return Promise.resolve({ rows: [] });
          });

          const result = await updateRestaurant(ownerId, { phone: newPhone });

          expect(result.phone).toBe(newPhone.trim());
        }
      )
    );
  });

  it('updating multiple fields returns all new values', async () => {
    await assertProperty(
      fc.asyncProperty(
        ownerIdArb,
        validNameArb,
        validAddressArb,
        validPhoneArb,
        async (ownerId: string, newName: string, newAddress: string, newPhone: string) => {
          const now = new Date();

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('SELECT id FROM restaurants WHERE owner_id')) {
              return Promise.resolve({ rows: [{ id: 'rest-id-1' }] });
            }
            if (query.includes('UPDATE restaurants SET')) {
              return Promise.resolve({
                rows: [{
                  id: 'rest-id-1',
                  owner_id: ownerId,
                  name: newName.trim(),
                  address: newAddress.trim(),
                  phone: newPhone.trim(),
                  logo_url: null,
                  cover_image_url: null,
                  restaurant_token: 'AbCdEfGhIj',
                  status: 'active',
                  created_at: now,
                  updated_at: now,
                }],
              });
            }
            return Promise.resolve({ rows: [] });
          });

          const result = await updateRestaurant(ownerId, {
            name: newName,
            address: newAddress,
            phone: newPhone,
          });

          expect(result.name).toBe(newName.trim());
          expect(result.address).toBe(newAddress.trim());
          expect(result.phone).toBe(newPhone.trim());
          // Token should remain unchanged
          expect(result.restaurantToken).toBe('AbCdEfGhIj');
        }
      )
    );
  });
});

// --- Property 11: Restaurant profile field validation ---
// **Validates: Requirements 4.4**

describe('Property 11: Restaurant profile field validation', () => {
  it('should throw ValidationError when name is missing', () => {
    assertProperty(
      fc.property(
        validAddressArb,
        validPhoneArb,
        (address: string, phone: string) => {
          expect(() =>
            validateRestaurantInput({ address, phone }, true)
          ).toThrow(ValidationError);

          try {
            validateRestaurantInput({ address, phone }, true);
          } catch (error) {
            const ve = error as ValidationError;
            const fields = ve.details!.map((d: any) => d.field);
            expect(fields).toContain('name');
          }
        }
      )
    );
  });

  it('should throw ValidationError when address is missing', () => {
    assertProperty(
      fc.property(
        validNameArb,
        validPhoneArb,
        (name: string, phone: string) => {
          expect(() =>
            validateRestaurantInput({ name, phone }, true)
          ).toThrow(ValidationError);

          try {
            validateRestaurantInput({ name, phone }, true);
          } catch (error) {
            const ve = error as ValidationError;
            const fields = ve.details!.map((d: any) => d.field);
            expect(fields).toContain('address');
          }
        }
      )
    );
  });

  it('should throw ValidationError when phone is missing', () => {
    assertProperty(
      fc.property(
        validNameArb,
        validAddressArb,
        (name: string, address: string) => {
          expect(() =>
            validateRestaurantInput({ name, address }, true)
          ).toThrow(ValidationError);

          try {
            validateRestaurantInput({ name, address }, true);
          } catch (error) {
            const ve = error as ValidationError;
            const fields = ve.details!.map((d: any) => d.field);
            expect(fields).toContain('phone');
          }
        }
      )
    );
  });

  it('should throw ValidationError with all missing fields when none provided', () => {
    assertProperty(
      fc.property(fc.constant(null), () => {
        expect(() => validateRestaurantInput({}, true)).toThrow(ValidationError);

        try {
          validateRestaurantInput({}, true);
        } catch (error) {
          const ve = error as ValidationError;
          const fields = ve.details!.map((d: any) => d.field);
          expect(fields).toContain('name');
          expect(fields).toContain('address');
          expect(fields).toContain('phone');
        }
      })
    );
  });

  it('should throw ValidationError when name exceeds 100 characters', () => {
    const longNameArb: fc.Arbitrary<string> = fc
      .string({ minLength: 101, maxLength: 200 })
      .filter((s: string) => s.trim().length > 100);

    assertProperty(
      fc.property(
        longNameArb,
        validAddressArb,
        validPhoneArb,
        (name: string, address: string, phone: string) => {
          expect(() =>
            validateRestaurantInput({ name, address, phone }, true)
          ).toThrow(ValidationError);

          try {
            validateRestaurantInput({ name, address, phone }, true);
          } catch (error) {
            const ve = error as ValidationError;
            const fields = ve.details!.map((d: any) => d.field);
            expect(fields).toContain('name');
          }
        }
      )
    );
  });

  it('should throw ValidationError when address exceeds 250 characters', () => {
    const longAddressArb: fc.Arbitrary<string> = fc
      .string({ minLength: 251, maxLength: 400 })
      .filter((s: string) => s.trim().length > 250);

    assertProperty(
      fc.property(
        validNameArb,
        longAddressArb,
        validPhoneArb,
        (name: string, address: string, phone: string) => {
          expect(() =>
            validateRestaurantInput({ name, address, phone }, true)
          ).toThrow(ValidationError);

          try {
            validateRestaurantInput({ name, address, phone }, true);
          } catch (error) {
            const ve = error as ValidationError;
            const fields = ve.details!.map((d: any) => d.field);
            expect(fields).toContain('address');
          }
        }
      )
    );
  });

  it('should throw ValidationError when phone exceeds 20 characters', () => {
    const longPhoneArb: fc.Arbitrary<string> = fc
      .string({ minLength: 21, maxLength: 40 })
      .filter((s: string) => s.trim().length > 20);

    assertProperty(
      fc.property(
        validNameArb,
        validAddressArb,
        longPhoneArb,
        (name: string, address: string, phone: string) => {
          expect(() =>
            validateRestaurantInput({ name, address, phone }, true)
          ).toThrow(ValidationError);

          try {
            validateRestaurantInput({ name, address, phone }, true);
          } catch (error) {
            const ve = error as ValidationError;
            const fields = ve.details!.map((d: any) => d.field);
            expect(fields).toContain('phone');
          }
        }
      )
    );
  });

  it('should accept valid input with all required fields within limits', () => {
    assertProperty(
      fc.property(
        validNameArb,
        validAddressArb,
        validPhoneArb,
        (name: string, address: string, phone: string) => {
          expect(() =>
            validateRestaurantInput({ name, address, phone, ownerId: 'some-uuid' }, true)
          ).not.toThrow();
        }
      )
    );
  });
});

// --- Property 12: Image upload validation ---
// **Validates: Requirements 4.5**

describe('Property 12: Image upload validation', () => {
  it('should accept files with valid mimetype AND size ≤ 5MB', () => {
    assertProperty(
      fc.property(
        validMimeTypeArb,
        validFileSizeArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        (mimetype: string, size: number, filename: string) => {
          const file: UploadedFile = {
            fieldname: 'logo',
            originalname: filename,
            mimetype,
            size,
            buffer: Buffer.alloc(0),
          };

          expect(() => validateImageFile(file)).not.toThrow();
        }
      )
    );
  });

  it('should reject files with size > 5MB with FileTooLargeError', () => {
    assertProperty(
      fc.property(
        validMimeTypeArb,
        oversizedFileSizeArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        (mimetype: string, size: number, filename: string) => {
          const file: UploadedFile = {
            fieldname: 'logo',
            originalname: filename,
            mimetype,
            size,
            buffer: Buffer.alloc(0),
          };

          expect(() => validateImageFile(file)).toThrow(FileTooLargeError);
        }
      )
    );
  });

  it('should reject files with unsupported mimetype with UnsupportedFormatError', () => {
    assertProperty(
      fc.property(
        invalidMimeTypeArb,
        validFileSizeArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        (mimetype: string, size: number, filename: string) => {
          const file: UploadedFile = {
            fieldname: 'cover',
            originalname: filename,
            mimetype,
            size,
            buffer: Buffer.alloc(0),
          };

          expect(() => validateImageFile(file)).toThrow(UnsupportedFormatError);
        }
      )
    );
  });

  it('should reject files with both invalid mimetype and oversized', () => {
    assertProperty(
      fc.property(
        invalidMimeTypeArb,
        oversizedFileSizeArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        (mimetype: string, size: number, filename: string) => {
          const file: UploadedFile = {
            fieldname: 'logo',
            originalname: filename,
            mimetype,
            size,
            buffer: Buffer.alloc(0),
          };

          // Should throw either UnsupportedFormatError or FileTooLargeError
          // (mimetype is checked first in the implementation)
          expect(() => validateImageFile(file)).toThrow(UnsupportedFormatError);
        }
      )
    );
  });

  it('should reject files at the exact boundary (size = 5MB + 1 byte)', () => {
    assertProperty(
      fc.property(
        validMimeTypeArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        (mimetype: string, filename: string) => {
          const file: UploadedFile = {
            fieldname: 'logo',
            originalname: filename,
            mimetype,
            size: MAX_FILE_SIZE + 1,
            buffer: Buffer.alloc(0),
          };

          expect(() => validateImageFile(file)).toThrow(FileTooLargeError);
        }
      )
    );
  });

  it('should accept files at the exact boundary (size = 5MB)', () => {
    assertProperty(
      fc.property(
        validMimeTypeArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        (mimetype: string, filename: string) => {
          const file: UploadedFile = {
            fieldname: 'cover',
            originalname: filename,
            mimetype,
            size: MAX_FILE_SIZE,
            buffer: Buffer.alloc(0),
          };

          expect(() => validateImageFile(file)).not.toThrow();
        }
      )
    );
  });
});
