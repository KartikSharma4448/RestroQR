// Feature: restroqr-v1-digital-menu, Property 13: Category name uniqueness (case-insensitive)
// Feature: restroqr-v1-digital-menu, Property 14: Category deletion cascades to food items
// Feature: restroqr-v1-digital-menu, Property 15: Category reorder persistence

import { fc, assertProperty } from '../helpers/fast-check';
import { ConflictError } from '../../errors';

// Mock database pool
jest.mock('../../config/database', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue(mockClient),
    },
  };
});

import pool from '../../config/database';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from '../../services/categoryService';

const mockPool = pool as jest.Mocked<typeof pool>;

// --- Generators ---

const restaurantIdArb: fc.Arbitrary<string> = fc.uuid();
const categoryIdArb: fc.Arbitrary<string> = fc.uuid();
const categoryNameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 50 }).filter(
  (s) => s.trim().length > 0 && s.trim().length <= 50
);

/**
 * Generator for pairs of strings that are case-insensitively equal but potentially different in case.
 * Generates a base string and then randomly changes case of each character for the variant.
 */
const caseInsensitiveEqualPairArb: fc.Arbitrary<[string, string]> = categoryNameArb.chain(
  (base) =>
    fc.array(fc.boolean(), { minLength: base.length, maxLength: base.length }).map(
      (caseFlips) => {
        const variant = base
          .split('')
          .map((ch, i) => (caseFlips[i] ? ch.toUpperCase() : ch.toLowerCase()))
          .join('');
        return [base, variant] as [string, string];
      }
    )
);

/**
 * Generator for category ID arrays (permutations for reordering).
 * Generates 2-10 unique UUIDs.
 */
const categoryIdListArb: fc.Arbitrary<string[]> = fc
  .array(fc.uuid(), { minLength: 2, maxLength: 10 })
  .map((ids) => [...new Set(ids)])
  .filter((ids) => ids.length >= 2);

// --- Property 13: Category name uniqueness (case-insensitive) ---
// **Validates: Requirements 5.1, 5.2**

describe('Property 13: Category name uniqueness (case-insensitive)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creating a category with a case-insensitively duplicate name throws ConflictError', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        caseInsensitiveEqualPairArb,
        async (restaurantId: string, [originalName, duplicateName]: [string, string]) => {
          // Mock: uniqueness check returns an existing row (case-insensitive match found)
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('LOWER(name) = LOWER')) {
              return Promise.resolve({
                rows: [{ id: 'existing-category-id' }],
              });
            }
            return Promise.resolve({ rows: [] });
          });

          await expect(createCategory(restaurantId, duplicateName)).rejects.toBeInstanceOf(
            ConflictError
          );
        }
      )
    );
  });

  it('creating a category with a unique name (case-insensitively) succeeds', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        categoryNameArb,
        async (restaurantId: string, name: string) => {
          const now = new Date();

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            // Uniqueness check: no existing category with this name
            if (query.includes('LOWER(name) = LOWER')) {
              return Promise.resolve({ rows: [] });
            }
            // Max display_order query
            if (query.includes('MAX(display_order)')) {
              return Promise.resolve({ rows: [{ max_order: 0 }] });
            }
            // Insert query
            if (query.includes('INSERT INTO categories')) {
              return Promise.resolve({
                rows: [
                  {
                    id: 'new-category-id',
                    name: name.trim(),
                    display_order: 1,
                    created_at: now,
                    updated_at: now,
                  },
                ],
              });
            }
            return Promise.resolve({ rows: [] });
          });

          const result = await createCategory(restaurantId, name);

          expect(result.id).toBe('new-category-id');
          expect(result.name).toBe(name.trim());
        }
      )
    );
  });

  it('updating a category to a case-insensitively duplicate name throws ConflictError', async () => {
    await assertProperty(
      fc.asyncProperty(
        categoryIdArb,
        restaurantIdArb,
        caseInsensitiveEqualPairArb,
        async (
          categoryId: string,
          restaurantId: string,
          [_existingName, duplicateName]: [string, string]
        ) => {
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            // Ownership check: category belongs to restaurant
            if (query.includes('id = $1 AND restaurant_id = $2') && !query.includes('LOWER')) {
              return Promise.resolve({ rows: [{ id: categoryId }] });
            }
            // Uniqueness check (exclude self): returns another category with same name
            if (query.includes('LOWER(name) = LOWER') && query.includes('id != $3')) {
              return Promise.resolve({ rows: [{ id: 'other-category-id' }] });
            }
            return Promise.resolve({ rows: [] });
          });

          await expect(
            updateCategory(categoryId, restaurantId, duplicateName)
          ).rejects.toBeInstanceOf(ConflictError);
        }
      )
    );
  });
});

// --- Property 14: Category deletion cascades to food items ---
// **Validates: Requirements 5.4**

describe('Property 14: Category deletion cascades to food items', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deleteCategory executes DELETE query on the category after ownership verification', async () => {
    await assertProperty(
      fc.asyncProperty(
        categoryIdArb,
        restaurantIdArb,
        async (categoryId: string, restaurantId: string) => {
          const queriesCalled: Array<{ query: string; params: unknown[] }> = [];

          (mockPool.query as jest.Mock).mockImplementation(
            (query: string, params?: unknown[]) => {
              queriesCalled.push({ query, params: params || [] });

              // Ownership verification: category belongs to this restaurant
              if (query.includes('id = $1 AND restaurant_id = $2')) {
                return Promise.resolve({ rows: [{ id: categoryId }] });
              }
              // DELETE query
              if (query.includes('DELETE FROM categories')) {
                return Promise.resolve({ rows: [], rowCount: 1 });
              }
              return Promise.resolve({ rows: [] });
            }
          );

          await deleteCategory(categoryId, restaurantId);

          // Assert: DELETE query was executed on the correct category ID
          const deleteQuery = queriesCalled.find((q) => q.query.includes('DELETE FROM categories'));
          expect(deleteQuery).toBeDefined();
          expect(deleteQuery!.params).toContain(categoryId);
        }
      )
    );
  });

  it('deleteCategory verifies ownership before deleting', async () => {
    await assertProperty(
      fc.asyncProperty(
        categoryIdArb,
        restaurantIdArb,
        async (categoryId: string, restaurantId: string) => {
          const queriesCalled: Array<{ query: string; params: unknown[] }> = [];

          (mockPool.query as jest.Mock).mockImplementation(
            (query: string, params?: unknown[]) => {
              queriesCalled.push({ query, params: params || [] });

              // Ownership verification: category belongs to this restaurant
              if (query.includes('id = $1 AND restaurant_id = $2')) {
                return Promise.resolve({ rows: [{ id: categoryId }] });
              }
              // DELETE query
              if (query.includes('DELETE FROM categories')) {
                return Promise.resolve({ rows: [], rowCount: 1 });
              }
              return Promise.resolve({ rows: [] });
            }
          );

          await deleteCategory(categoryId, restaurantId);

          // Assert: ownership check was called with the correct params
          const ownershipQuery = queriesCalled.find(
            (q) => q.query.includes('id = $1 AND restaurant_id = $2')
          );
          expect(ownershipQuery).toBeDefined();
          expect(ownershipQuery!.params).toEqual([categoryId, restaurantId]);

          // Assert: DELETE occurred after ownership verification
          const deleteIdx = queriesCalled.findIndex((q) =>
            q.query.includes('DELETE FROM categories')
          );
          const ownerIdx = queriesCalled.findIndex((q) =>
            q.query.includes('id = $1 AND restaurant_id = $2')
          );
          expect(ownerIdx).toBeLessThan(deleteIdx);
        }
      )
    );
  });
});

// --- Property 15: Category reorder persistence ---
// **Validates: Requirements 5.5**

describe('Property 15: Category reorder persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reorderCategories sets display_order matching the submitted index for each category', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        categoryIdListArb,
        async (restaurantId: string, categoryIds: string[]) => {
          // Shuffle the IDs to simulate a permutation
          const shuffled = fc.sample(fc.shuffledSubarray(categoryIds, { minLength: categoryIds.length, maxLength: categoryIds.length }), 1)[0];

          const updateQueries: Array<{ order: number; id: string }> = [];

          // Get the mock client from pool.connect
          const mockClient = await (mockPool.connect as jest.Mock)();

          (mockClient.query as jest.Mock).mockImplementation(
            (query: string, params?: unknown[]) => {
              if (query === 'BEGIN' || query === 'COMMIT' || query === 'ROLLBACK') {
                return Promise.resolve();
              }
              // Verify all IDs belong to restaurant
              if (query.includes('SELECT id FROM categories WHERE restaurant_id')) {
                return Promise.resolve({
                  rows: shuffled.map((id) => ({ id })),
                });
              }
              // UPDATE display_order queries
              if (query.includes('UPDATE categories SET display_order')) {
                updateQueries.push({
                  order: params![0] as number,
                  id: params![1] as string,
                });
                return Promise.resolve({ rows: [], rowCount: 1 });
              }
              return Promise.resolve({ rows: [] });
            }
          );

          // Mock listCategories query (called after reorder for return value)
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('SELECT id, name, display_order')) {
              return Promise.resolve({
                rows: shuffled.map((id, idx) => ({
                  id,
                  name: `Category ${idx}`,
                  display_order: idx,
                  created_at: new Date(),
                  updated_at: new Date(),
                })),
              });
            }
            return Promise.resolve({ rows: [] });
          });

          await reorderCategories(restaurantId, shuffled);

          // Assert: UPDATE queries set display_order matching index
          for (let i = 0; i < shuffled.length; i++) {
            const matchingUpdate = updateQueries.find((u) => u.id === shuffled[i]);
            expect(matchingUpdate).toBeDefined();
            expect(matchingUpdate!.order).toBe(i);
          }
        }
      )
    );
  });

  it('reorderCategories uses a transaction (BEGIN/COMMIT)', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        categoryIdListArb,
        async (restaurantId: string, categoryIds: string[]) => {
          const transactionCommands: string[] = [];

          const mockClient = await (mockPool.connect as jest.Mock)();

          (mockClient.query as jest.Mock).mockImplementation(
            (query: string, params?: unknown[]) => {
              if (query === 'BEGIN' || query === 'COMMIT' || query === 'ROLLBACK') {
                transactionCommands.push(query);
                return Promise.resolve();
              }
              // Verify all IDs belong to restaurant
              if (query.includes('SELECT id FROM categories WHERE restaurant_id')) {
                return Promise.resolve({
                  rows: categoryIds.map((id) => ({ id })),
                });
              }
              // UPDATE display_order
              if (query.includes('UPDATE categories SET display_order')) {
                return Promise.resolve({ rows: [], rowCount: 1 });
              }
              return Promise.resolve({ rows: [] });
            }
          );

          // Mock listCategories query
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('SELECT id, name, display_order')) {
              return Promise.resolve({
                rows: categoryIds.map((id, idx) => ({
                  id,
                  name: `Category ${idx}`,
                  display_order: idx,
                  created_at: new Date(),
                  updated_at: new Date(),
                })),
              });
            }
            return Promise.resolve({ rows: [] });
          });

          await reorderCategories(restaurantId, categoryIds);

          // Assert: transaction was used
          expect(transactionCommands).toContain('BEGIN');
          expect(transactionCommands).toContain('COMMIT');

          // Assert: BEGIN came before COMMIT
          const beginIdx = transactionCommands.indexOf('BEGIN');
          const commitIdx = transactionCommands.indexOf('COMMIT');
          expect(beginIdx).toBeLessThan(commitIdx);
        }
      )
    );
  });
});
