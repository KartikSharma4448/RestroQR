// Feature: restroqr-v2-ordering-system, Property 1: QR Mode Validation
// Feature: restroqr-v2-ordering-system, Property 2: Mode Switch Round-Trip Preserves Data

import { fc, assertProperty } from '../helpers/fast-check';
import { ValidationError } from '../../errors';

// Mock database pool
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import pool from '../../config/database';
import { validateQrMode, updateQrMode } from '../../services/settingsService';

const mockPool = pool as jest.Mocked<typeof pool>;

// --- Generators ---

/** Generates only the two valid QR mode values */
const validQrModeArb: fc.Arbitrary<string> = fc.constantFrom('single', 'multi');

/** Generates arbitrary strings that are NOT 'single' or 'multi' */
const invalidQrModeArb: fc.Arbitrary<unknown> = fc.oneof(
  // Strings that are not 'single' or 'multi'
  fc.string().filter((s: string) => s !== 'single' && s !== 'multi'),
  // Non-string types
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.constant([]),
  fc.constant({})
);

/** Generates a random sequence of valid QR mode switches */
const modeSwitchSequenceArb: fc.Arbitrary<string[]> = fc
  .array(validQrModeArb, { minLength: 1, maxLength: 20 });

const restaurantIdArb: fc.Arbitrary<string> = fc.uuid();

// --- Property 1: QR Mode Validation ---
// **Validates: Requirements 1.1**

describe('Property 1: QR Mode Validation', () => {
  it('should accept only "single" or "multi" as valid qr_mode values', () => {
    assertProperty(
      fc.property(validQrModeArb, (mode: string) => {
        // Valid modes should not throw
        expect(() => validateQrMode(mode)).not.toThrow();
      })
    );
  });

  it('should reject all values that are not "single" or "multi" with a ValidationError', () => {
    assertProperty(
      fc.property(invalidQrModeArb, (mode: unknown) => {
        expect(() => validateQrMode(mode)).toThrow(ValidationError);
      })
    );
  });
});

// --- Property 2: Mode Switch Round-Trip Preserves Data ---
// **Validates: Requirements 1.5, 1.6, 1.7**

describe('Property 2: Mode Switch Round-Trip Preserves Data', () => {
  it('should preserve all table and order records through any sequence of mode switches', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        modeSwitchSequenceArb,
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 100 }),
        async (
          restaurantId: string,
          modeSequence: string[],
          tableCount: number,
          orderCount: number
        ) => {
          // Track what queries are executed to verify no DELETE/DROP on tables or orders
          const executedQueries: string[] = [];

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            executedQueries.push(query);

            // Restaurant exists
            if (query.includes('SELECT id FROM restaurants')) {
              return Promise.resolve({ rows: [{ id: restaurantId }] });
            }

            // UPDATE qr_mode — this is the expected mutation
            if (query.includes('UPDATE restaurants SET qr_mode')) {
              return Promise.resolve({ rowCount: 1 });
            }

            // Count tables for this restaurant
            if (query.includes('COUNT') && query.includes('tables')) {
              return Promise.resolve({ rows: [{ count: tableCount }] });
            }

            // Count orders for this restaurant
            if (query.includes('COUNT') && query.includes('orders')) {
              return Promise.resolve({ rows: [{ count: orderCount }] });
            }

            return Promise.resolve({ rows: [] });
          });

          // Execute the full sequence of mode switches
          for (const mode of modeSequence) {
            await updateQrMode(restaurantId, mode);
          }

          // Verify: no DELETE or DROP queries were executed against tables or orders
          const destructiveQueries = executedQueries.filter(
            (q) =>
              (q.toUpperCase().includes('DELETE') &&
                (q.includes('tables') || q.includes('orders') || q.includes('order_items'))) ||
              (q.toUpperCase().includes('DROP') &&
                (q.includes('tables') || q.includes('orders') || q.includes('order_items')))
          );

          expect(destructiveQueries).toHaveLength(0);

          // Verify: only UPDATE on restaurants table was performed (qr_mode column only)
          const updateQueries = executedQueries.filter((q) =>
            q.includes('UPDATE restaurants SET qr_mode')
          );
          expect(updateQueries.length).toBe(modeSequence.length);
        }
      )
    );
  });
});
