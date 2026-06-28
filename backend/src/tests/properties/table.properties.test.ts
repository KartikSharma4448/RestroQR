// Feature: restroqr-v2-ordering-system, Property 3: Table Token Encryption Round-Trip
// Feature: restroqr-v2-ordering-system, Property 4: Table Token Uniqueness
// Feature: restroqr-v2-ordering-system, Property 5: Invalid Token Handling

import { fc, assertProperty } from '../helpers/fast-check';
import { NotFoundError } from '../../errors';

// Set TABLE_TOKEN_SECRET before importing tableService (it reads env on key derivation)
process.env.TABLE_TOKEN_SECRET = 'a]3Bf!$z9Kx#mP7nQ2wR5tY8uI0oL4jH6gF1dS';

import { encryptTableToken, decryptTableToken } from '../../services/tableService';

// --- Generators ---

const uuidArb: fc.Arbitrary<string> = fc.uuid();

// Generator for sets of N table/restaurant UUID pairs
const tableSetArb = (minSize: number, maxSize: number) =>
  fc.array(
    fc.record({ tableId: fc.uuid(), restaurantId: fc.uuid() }),
    { minLength: minSize, maxLength: maxSize }
  );

// Generator for invalid token strings (random strings, malformed base64, truncated, etc.)
const invalidTokenArb: fc.Arbitrary<string> = fc.oneof(
  // Random ASCII strings
  fc.string({ minLength: 1, maxLength: 100 }),
  // Random alphanumeric (looks like base64url but won't decrypt)
  fc.stringMatching(/^[A-Za-z0-9_-]{1,80}$/),
  // Empty string
  fc.constant(''),
  // Short strings (too short to contain iv + tag + ciphertext)
  fc.string({ minLength: 1, maxLength: 10 }),
  // Valid base64url characters but random content (won't decrypt correctly)
  fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 29, maxLength: 64 }).map(
    (bytes) => Buffer.from(bytes).toString('base64url')
  )
);

// --- Property 3: Table Token Encryption Round-Trip ---
// **Validates: Requirements 2.2, 3.1**

describe('Property 3: Table Token Encryption Round-Trip', () => {
  it('for any valid table UUID and restaurant UUID, encrypt then decrypt returns original values', () => {
    assertProperty(
      fc.property(
        uuidArb,
        uuidArb,
        (tableId: string, restaurantId: string) => {
          const token = encryptTableToken(tableId, restaurantId);
          const decrypted = decryptTableToken(token);

          expect(decrypted.tableId).toBe(tableId);
          expect(decrypted.restaurantId).toBe(restaurantId);
        }
      )
    );
  });

  it('encrypted token is a non-empty URL-safe base64 string', () => {
    assertProperty(
      fc.property(
        uuidArb,
        uuidArb,
        (tableId: string, restaurantId: string) => {
          const token = encryptTableToken(tableId, restaurantId);

          // Token should be non-empty
          expect(token.length).toBeGreaterThan(0);
          // Token should be valid base64url (only A-Z, a-z, 0-9, -, _)
          expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
        }
      )
    );
  });
});

// --- Property 4: Table Token Uniqueness ---
// **Validates: Requirements 2.1**

describe('Property 4: Table Token Uniqueness', () => {
  it('for any N tables, all generated tokens are distinct', () => {
    assertProperty(
      fc.property(
        tableSetArb(2, 20),
        (tables) => {
          const tokens = tables.map(({ tableId, restaurantId }) =>
            encryptTableToken(tableId, restaurantId)
          );

          const uniqueTokens = new Set(tokens);
          expect(uniqueTokens.size).toBe(tokens.length);
        }
      )
    );
  });

  it('encrypting the same tableId and restaurantId twice produces different tokens (random IV)', () => {
    assertProperty(
      fc.property(
        uuidArb,
        uuidArb,
        (tableId: string, restaurantId: string) => {
          const token1 = encryptTableToken(tableId, restaurantId);
          const token2 = encryptTableToken(tableId, restaurantId);

          // Due to random IV, tokens should differ even for same input
          expect(token1).not.toBe(token2);
        }
      )
    );
  });
});

// --- Property 5: Invalid Token Handling ---
// **Validates: Requirements 3.3**

describe('Property 5: Invalid Token Handling', () => {
  it('for any non-valid token string, decryption throws a generic NotFoundError', () => {
    assertProperty(
      fc.property(
        invalidTokenArb,
        (invalidToken: string) => {
          expect(() => decryptTableToken(invalidToken)).toThrow(NotFoundError);
        }
      )
    );
  });

  it('error message is generic "Menu not found" without internal details', () => {
    assertProperty(
      fc.property(
        invalidTokenArb,
        (invalidToken: string) => {
          try {
            decryptTableToken(invalidToken);
            // If we get here somehow, fail the test
            throw new Error('Expected NotFoundError was not thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(NotFoundError);
            expect((error as NotFoundError).message).toBe('Menu not found');
            expect((error as NotFoundError).statusCode).toBe(404);
            // Ensure no internal crypto details leak
            expect((error as NotFoundError).message).not.toContain('decrypt');
            expect((error as NotFoundError).message).not.toContain('cipher');
            expect((error as NotFoundError).message).not.toContain('AES');
            expect((error as NotFoundError).message).not.toContain('GCM');
          }
        }
      )
    );
  });

  it('tokens encrypted with a different key cannot be decrypted', () => {
    assertProperty(
      fc.property(
        uuidArb,
        uuidArb,
        (tableId: string, restaurantId: string) => {
          // Encrypt with current key
          const token = encryptTableToken(tableId, restaurantId);

          // Temporarily change the secret to simulate a different key
          const originalSecret = process.env.TABLE_TOKEN_SECRET;
          process.env.TABLE_TOKEN_SECRET = 'completely-different-secret-key-for-testing';

          try {
            expect(() => decryptTableToken(token)).toThrow(NotFoundError);
          } finally {
            // Restore original secret
            process.env.TABLE_TOKEN_SECRET = originalSecret;
          }
        }
      )
    );
  });
});
