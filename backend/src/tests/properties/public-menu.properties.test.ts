// Feature: restroqr-v1-digital-menu, Property 18: Menu items grouped by category in display order
// Feature: restroqr-v1-digital-menu, Property 19: Search and filter composition
// Feature: restroqr-v1-digital-menu, Property 20: Error pages do not leak internal information

import { fc, FC_DEFAULT_NUM_RUNS, assertProperty } from '../helpers/fast-check';
import { NotFoundError } from '../../errors';
import { filterMenuItems, FilterableMenuItem } from '../../utils/menuFilter';

// Mock database pool
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import pool from '../../config/database';
import { getPublicMenu } from '../../services/publicMenuService';

const mockPool = pool as jest.Mocked<typeof pool>;

// --- Generators ---

const displayOrderArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 1000 });

const categoryArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  displayOrder: displayOrderArb,
});

const badgeArb: fc.Arbitrary<'veg' | 'non_veg'> = fc.constantFrom('veg', 'non_veg');

const foodItemArb = (categoryId: string) =>
  fc.record({
    id: fc.uuid(),
    category_id: fc.constant(categoryId),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
    price: fc.double({ min: 0.01, max: 999999.99, noNaN: true, noDefaultInfinity: true }).map((p) => p.toFixed(2)),
    image_url: fc.option(fc.webUrl(), { nil: null }),
    badge: badgeArb,
    is_available: fc.boolean(),
  });

const filterableItemArb: fc.Arbitrary<FilterableMenuItem> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
  price: fc.double({ min: 0.01, max: 999999.99, noNaN: true, noDefaultInfinity: true }).map((p) => p.toFixed(2)),
  imageUrl: fc.option(fc.webUrl(), { nil: null }),
  badge: badgeArb,
  isAvailable: fc.boolean(),
});

// Valid alphanumeric token (8+ chars)
const validTokenArb: fc.Arbitrary<string> = fc.stringMatching(/^[A-Za-z0-9]{8,20}$/);

// --- Property 18: Menu items grouped by category in display order ---
// **Validates: Requirements 9.4**

describe('Property 18: Menu items grouped by category in display order', () => {
  it('public menu response returns categories ordered by display_order ascending', async () => {
    await assertProperty(
      fc.asyncProperty(
        validTokenArb,
        fc.array(categoryArb, { minLength: 1, maxLength: 5 }),
        async (token: string, categories) => {
          const restaurantId = 'restaurant-001';

          // Assign unique display orders to avoid ambiguity
          const categoriesWithOrder = categories.map((cat, i) => ({
            ...cat,
            displayOrder: i * 10 + Math.abs(cat.displayOrder % 100),
          }));

          // Sort by displayOrder ascending (expected behavior)
          const sortedCategories = [...categoriesWithOrder].sort(
            (a, b) => a.displayOrder - b.displayOrder
          );

          // Generate items for each category
          const allItems = categoriesWithOrder.flatMap((cat) => [
            {
              id: `item-${cat.id}-1`,
              category_id: cat.id,
              name: `Item for ${cat.name}`,
              description: null,
              price: '10.00',
              image_url: null,
              badge: 'veg',
              is_available: true,
            },
          ]);

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            // Restaurant lookup
            if (query.includes('restaurant_token')) {
              return Promise.resolve({
                rows: [
                  {
                    id: restaurantId,
                    name: 'Test Restaurant',
                    logo_url: null,
                    cover_image_url: null,
                    status: 'active',
                  },
                ],
              });
            }
            // Categories query - return in display_order ASC
            if (query.includes('categories') && query.includes('ORDER BY')) {
              return Promise.resolve({
                rows: sortedCategories.map((cat) => ({
                  id: cat.id,
                  name: cat.name,
                  display_order: cat.displayOrder,
                })),
              });
            }
            // Food items query
            if (query.includes('food_items')) {
              return Promise.resolve({ rows: allItems });
            }
            return Promise.resolve({ rows: [] });
          });

          const result = await getPublicMenu(token);

          // Assert: categories are in ascending display_order
          for (let i = 1; i < result.categories.length; i++) {
            expect(result.categories[i].displayOrder).toBeGreaterThanOrEqual(
              result.categories[i - 1].displayOrder
            );
          }
        }
      )
    );
  });

  it('each item appears in the correct category (matching category_id)', async () => {
    await assertProperty(
      fc.asyncProperty(
        validTokenArb,
        fc.integer({ min: 2, max: 5 }),
        async (token: string, numCategories: number) => {
          const restaurantId = 'restaurant-002';

          // Generate categories with unique IDs
          const categories = Array.from({ length: numCategories }, (_, i) => ({
            id: `cat-${i}`,
            name: `Category ${i}`,
            displayOrder: i,
          }));

          // Generate items assigned to specific categories
          const allItems = categories.flatMap((cat, catIndex) =>
            Array.from({ length: 2 }, (_, itemIndex) => ({
              id: `item-${catIndex}-${itemIndex}`,
              category_id: cat.id,
              name: `Item ${catIndex}-${itemIndex}`,
              description: null,
              price: '15.00',
              image_url: null,
              badge: catIndex % 2 === 0 ? 'veg' : 'non_veg',
              is_available: true,
            }))
          );

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('restaurant_token')) {
              return Promise.resolve({
                rows: [
                  {
                    id: restaurantId,
                    name: 'Test Restaurant',
                    logo_url: null,
                    cover_image_url: null,
                    status: 'active',
                  },
                ],
              });
            }
            if (query.includes('categories') && query.includes('ORDER BY')) {
              return Promise.resolve({
                rows: categories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  display_order: c.displayOrder,
                })),
              });
            }
            if (query.includes('food_items')) {
              return Promise.resolve({ rows: allItems });
            }
            return Promise.resolve({ rows: [] });
          });

          const result = await getPublicMenu(token);

          // Assert: each category contains only items that belong to it
          for (const category of result.categories) {
            const expectedItems = allItems.filter((item) => item.category_id === category.id);
            expect(category.items.length).toBe(expectedItems.length);

            for (const item of category.items) {
              const sourceItem = allItems.find((ai) => ai.id === item.id);
              expect(sourceItem).toBeDefined();
              expect(sourceItem!.category_id).toBe(category.id);
            }
          }
        }
      )
    );
  });
});

// --- Property 19: Search and filter composition ---
// **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

describe('Property 19: Search and filter composition', () => {
  it('filtering by veg returns only items with badge=veg', () => {
    assertProperty(
      fc.property(
        fc.array(filterableItemArb, { minLength: 1, maxLength: 20 }),
        (items: FilterableMenuItem[]) => {
          const result = filterMenuItems(items, '', 'veg');
          for (const item of result) {
            expect(item.badge).toBe('veg');
          }
          // All veg items should be present
          const expected = items.filter((i) => i.badge === 'veg');
          expect(result.length).toBe(expected.length);
        }
      )
    );
  });

  it('filtering by non_veg returns only items with badge=non_veg', () => {
    assertProperty(
      fc.property(
        fc.array(filterableItemArb, { minLength: 1, maxLength: 20 }),
        (items: FilterableMenuItem[]) => {
          const result = filterMenuItems(items, '', 'non_veg');
          for (const item of result) {
            expect(item.badge).toBe('non_veg');
          }
          const expected = items.filter((i) => i.badge === 'non_veg');
          expect(result.length).toBe(expected.length);
        }
      )
    );
  });

  it('search term matches are case-insensitive substring matches on name and description', () => {
    assertProperty(
      fc.property(
        fc.array(filterableItemArb, { minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (items: FilterableMenuItem[], searchTerm: string) => {
          const result = filterMenuItems(items, searchTerm, null);
          const term = searchTerm.toLowerCase();

          // Every result must match the search term in name or description
          for (const item of result) {
            const nameMatch = item.name.toLowerCase().includes(term);
            const descMatch = item.description
              ? item.description.toLowerCase().includes(term)
              : false;
            expect(nameMatch || descMatch).toBe(true);
          }

          // Every item that matches should be in the result
          const expected = items.filter((i) => {
            const nm = i.name.toLowerCase().includes(term);
            const dm = i.description ? i.description.toLowerCase().includes(term) : false;
            return nm || dm;
          });
          expect(result.length).toBe(expected.length);
        }
      )
    );
  });

  it('combining search + badge filter returns intersection', () => {
    assertProperty(
      fc.property(
        fc.array(filterableItemArb, { minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        badgeArb,
        (items: FilterableMenuItem[], searchTerm: string, badge: 'veg' | 'non_veg') => {
          const result = filterMenuItems(items, searchTerm, badge);
          const term = searchTerm.toLowerCase();

          for (const item of result) {
            // Must match badge
            expect(item.badge).toBe(badge);
            // Must match search term
            const nameMatch = item.name.toLowerCase().includes(term);
            const descMatch = item.description
              ? item.description.toLowerCase().includes(term)
              : false;
            expect(nameMatch || descMatch).toBe(true);
          }

          // Result size should equal the intersection
          const expected = items.filter((i) => {
            if (i.badge !== badge) return false;
            const nm = i.name.toLowerCase().includes(term);
            const dm = i.description ? i.description.toLowerCase().includes(term) : false;
            return nm || dm;
          });
          expect(result.length).toBe(expected.length);
        }
      )
    );
  });

  it('clearing filters returns all items', () => {
    assertProperty(
      fc.property(
        fc.array(filterableItemArb, { minLength: 0, maxLength: 20 }),
        (items: FilterableMenuItem[]) => {
          const result = filterMenuItems(items, '', null);
          expect(result.length).toBe(items.length);
          // Same items, same order
          expect(result).toEqual(items);
        }
      )
    );
  });
});

// --- Property 20: Error pages do not leak internal information ---
// **Validates: Requirements 12.1, 12.6**

describe('Property 20: Error pages do not leak internal information', () => {
  // Regex patterns for sensitive information
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const dbFieldNames = ['restaurant_token', 'owner_id', 'restaurant_id', 'category_id', 'password_hash', 'created_at', 'updated_at'];
  const stackTracePattern = /at\s+\w+.*\(.*:\d+:\d+\)/;

  // Invalid token generators
  const shortTokenArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 7 });
  const specialCharsTokenArb: fc.Arbitrary<string> = fc.stringMatching(/^[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]{1,20}$/);
  const emptyTokenArb: fc.Arbitrary<string> = fc.constant('');
  const uuidAsTokenArb: fc.Arbitrary<string> = fc.uuid();

  function assertNoInfoLeakage(error: unknown): void {
    expect(error).toBeInstanceOf(NotFoundError);

    const err = error as NotFoundError;

    // Should not contain UUIDs
    expect(err.message).not.toMatch(uuidPattern);

    // Should not contain database field names
    for (const field of dbFieldNames) {
      expect(err.message).not.toContain(field);
    }

    // Should not contain stack traces in message
    expect(err.message).not.toMatch(stackTracePattern);

    // All errors should have identical code, message, and statusCode
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Menu not found');
    expect(err.statusCode).toBe(404);
  }

  it('invalid short tokens produce generic errors without internal info', async () => {
    await assertProperty(
      fc.asyncProperty(shortTokenArb, async (token: string) => {
        (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

        try {
          await getPublicMenu(token);
          // Should always throw
          fail('Expected getPublicMenu to throw');
        } catch (error) {
          assertNoInfoLeakage(error);
        }
      })
    );
  });

  it('tokens with special characters produce generic errors without internal info', async () => {
    await assertProperty(
      fc.asyncProperty(specialCharsTokenArb, async (token: string) => {
        (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

        try {
          await getPublicMenu(token);
          fail('Expected getPublicMenu to throw');
        } catch (error) {
          assertNoInfoLeakage(error);
        }
      })
    );
  });

  it('empty tokens produce generic errors without internal info', async () => {
    await assertProperty(
      fc.asyncProperty(emptyTokenArb, async (token: string) => {
        (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

        try {
          await getPublicMenu(token);
          fail('Expected getPublicMenu to throw');
        } catch (error) {
          assertNoInfoLeakage(error);
        }
      })
    );
  });

  it('UUIDs used as tokens produce generic errors without internal info', async () => {
    await assertProperty(
      fc.asyncProperty(uuidAsTokenArb, async (token: string) => {
        // UUID contains dashes, so should fail format validation
        (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

        try {
          await getPublicMenu(token);
          fail('Expected getPublicMenu to throw');
        } catch (error) {
          assertNoInfoLeakage(error);
        }
      })
    );
  });

  it('non-existent valid tokens produce same error as invalid format tokens', async () => {
    await assertProperty(
      fc.asyncProperty(validTokenArb, async (token: string) => {
        // Token has valid format but does not exist in DB
        (mockPool.query as jest.Mock).mockImplementation((query: string) => {
          if (query.includes('restaurant_token')) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        });

        try {
          await getPublicMenu(token);
          fail('Expected getPublicMenu to throw');
        } catch (error) {
          assertNoInfoLeakage(error);
        }
      })
    );
  });

  it('disabled restaurant tokens produce same generic error as non-existent tokens', async () => {
    await assertProperty(
      fc.asyncProperty(validTokenArb, fc.uuid(), async (token: string, restaurantId: string) => {
        // Token exists but restaurant is disabled
        (mockPool.query as jest.Mock).mockImplementation((query: string) => {
          if (query.includes('restaurant_token')) {
            return Promise.resolve({
              rows: [
                {
                  id: restaurantId,
                  name: 'Disabled Restaurant',
                  logo_url: null,
                  cover_image_url: null,
                  status: 'disabled',
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        });

        try {
          await getPublicMenu(token);
          fail('Expected getPublicMenu to throw');
        } catch (error) {
          assertNoInfoLeakage(error);
        }
      })
    );
  });

  it('all error cases produce identical error structure', async () => {
    await assertProperty(
      fc.asyncProperty(
        fc.oneof(shortTokenArb, specialCharsTokenArb, emptyTokenArb, uuidAsTokenArb, validTokenArb),
        fc.constantFrom('invalid_format', 'not_found', 'disabled') as fc.Arbitrary<string>,
        async (token: string, scenario: string) => {
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('restaurant_token')) {
              if (scenario === 'not_found') {
                return Promise.resolve({ rows: [] });
              }
              if (scenario === 'disabled') {
                return Promise.resolve({
                  rows: [
                    {
                      id: 'some-id',
                      name: 'Restaurant',
                      logo_url: null,
                      cover_image_url: null,
                      status: 'disabled',
                    },
                  ],
                });
              }
            }
            return Promise.resolve({ rows: [] });
          });

          try {
            await getPublicMenu(token);
            // If token passes format validation and DB returns active restaurant, it won't throw.
            // That's fine — only error cases are tested here.
          } catch (error) {
            assertNoInfoLeakage(error);
          }
        }
      )
    );
  });
});
