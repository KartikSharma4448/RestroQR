// Feature: restroqr-v1-digital-menu, Property 16: Food item creation validation
// Feature: restroqr-v1-digital-menu, Property 17: Token immutability across menu changes

import { fc, assertProperty } from '../helpers/fast-check';
import { ValidationError } from '../../errors';

// Mock database pool
jest.mock('../../config/database', () => {
  return {
    __esModule: true,
    default: {
      query: jest.fn(),
    },
  };
});

import pool from '../../config/database';
import {
  validateFoodItem,
  createFoodItem,
  updateFoodItem,
  deleteFoodItem,
} from '../../services/foodItemService';

const mockPool = pool as jest.Mocked<typeof pool>;

// --- Generators ---

/** Valid food item name: 1-100 non-empty characters after trimming */
const validNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length >= 1 && s.trim().length <= 100);

/** Invalid food item name: empty or exceeds 100 characters */
const invalidNameEmptyArb: fc.Arbitrary<unknown> = fc.constantFrom('', '   ', null, undefined);
const invalidNameTooLongArb: fc.Arbitrary<string> = fc
  .string({ minLength: 101, maxLength: 200 })
  .filter((s) => s.trim().length > 100);

/** Valid price: between 0.01 and 999999.99 */
const validPriceArb: fc.Arbitrary<number> = fc.double({
  min: 0.01,
  max: 999999.99,
  noNaN: true,
  noDefaultInfinity: true,
});

/** Invalid price: outside the valid range */
const invalidPriceTooLowArb: fc.Arbitrary<number> = fc.double({
  min: -100000,
  max: 0.009,
  noNaN: true,
  noDefaultInfinity: true,
});
const invalidPriceTooHighArb: fc.Arbitrary<number> = fc.double({
  min: 1000000,
  max: 9999999,
  noNaN: true,
  noDefaultInfinity: true,
});

/** Valid badge */
const validBadgeArb: fc.Arbitrary<'veg' | 'non_veg'> = fc.constantFrom('veg' as const, 'non_veg' as const);

/** Invalid badge */
const invalidBadgeArb: fc.Arbitrary<unknown> = fc.constantFrom(
  'vegetarian',
  'nonveg',
  'both',
  '',
  null,
  undefined,
  123
);

/** Valid description: optional, up to 500 chars */
const validDescriptionArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.string({ minLength: 0, maxLength: 500 })
);

/** Invalid description: exceeds 500 chars */
const invalidDescriptionArb: fc.Arbitrary<string> = fc.string({ minLength: 501, maxLength: 700 });

/** UUID generator */
const uuidArb: fc.Arbitrary<string> = fc.uuid();

/** Restaurant token generator (10 char alphanumeric) */
const alphanumChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const tokenArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...alphanumChars.split('')), { minLength: 10, maxLength: 10 })
  .map((chars) => chars.join(''));

// --- Property 16: Food item creation validation ---
// **Validates: Requirements 6.1, 6.5**

describe('Property 16: Food item creation validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('valid food item inputs pass validation without throwing', () => {
    assertProperty(
      fc.property(
        validNameArb,
        validPriceArb,
        validBadgeArb,
        validDescriptionArb,
        (name: string, price: number, badge: 'veg' | 'non_veg', description: string | undefined) => {
          const data: { name: unknown; price: unknown; badge: unknown; description?: unknown } = {
            name,
            price,
            badge,
          };
          if (description !== undefined) {
            data.description = description;
          }

          // Should not throw for valid inputs
          const result = validateFoodItem(data, true);
          expect(result.name).toBe(name.trim());
          expect(result.price).toBeCloseTo(price, 2);
          expect(result.badge).toBe(badge);
        }
      )
    );
  });

  it('food item with empty or missing name throws ValidationError', () => {
    assertProperty(
      fc.property(
        invalidNameEmptyArb,
        validPriceArb,
        validBadgeArb,
        (name: unknown, price: number, badge: 'veg' | 'non_veg') => {
          const data = { name, price, badge };

          expect(() => validateFoodItem(data, true)).toThrow(ValidationError);
        }
      )
    );
  });

  it('food item with name exceeding 100 characters throws ValidationError', () => {
    assertProperty(
      fc.property(
        invalidNameTooLongArb,
        validPriceArb,
        validBadgeArb,
        (name: string, price: number, badge: 'veg' | 'non_veg') => {
          const data = { name, price, badge };

          expect(() => validateFoodItem(data, true)).toThrow(ValidationError);
        }
      )
    );
  });

  it('food item with price below 0.01 throws ValidationError', () => {
    assertProperty(
      fc.property(
        validNameArb,
        invalidPriceTooLowArb,
        validBadgeArb,
        (name: string, price: number, badge: 'veg' | 'non_veg') => {
          const data = { name, price, badge };

          expect(() => validateFoodItem(data, true)).toThrow(ValidationError);
        }
      )
    );
  });

  it('food item with price above 999999.99 throws ValidationError', () => {
    assertProperty(
      fc.property(
        validNameArb,
        invalidPriceTooHighArb,
        validBadgeArb,
        (name: string, price: number, badge: 'veg' | 'non_veg') => {
          const data = { name, price, badge };

          expect(() => validateFoodItem(data, true)).toThrow(ValidationError);
        }
      )
    );
  });

  it('food item with invalid badge throws ValidationError', () => {
    assertProperty(
      fc.property(
        validNameArb,
        validPriceArb,
        invalidBadgeArb,
        (name: string, price: number, badge: unknown) => {
          const data = { name, price, badge };

          expect(() => validateFoodItem(data, true)).toThrow(ValidationError);
        }
      )
    );
  });

  it('food item with description exceeding 500 chars throws ValidationError', () => {
    assertProperty(
      fc.property(
        validNameArb,
        validPriceArb,
        validBadgeArb,
        invalidDescriptionArb,
        (name: string, price: number, badge: 'veg' | 'non_veg', description: string) => {
          const data = { name, price, badge, description };

          expect(() => validateFoodItem(data, true)).toThrow(ValidationError);
        }
      )
    );
  });

  it('food item with valid description ≤500 chars passes validation', () => {
    assertProperty(
      fc.property(
        validNameArb,
        validPriceArb,
        validBadgeArb,
        fc.string({ minLength: 1, maxLength: 500 }),
        (name: string, price: number, badge: 'veg' | 'non_veg', description: string) => {
          const data = { name, price, badge, description };

          const result = validateFoodItem(data, true);
          expect(result.description).toBe(description.trim());
        }
      )
    );
  });
});

// --- Property 17: Token immutability across menu changes ---
// **Validates: Requirements 7.4**

describe('Property 17: Token immutability across menu changes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createFoodItem does not issue any UPDATE query on the restaurants table', async () => {
    await assertProperty(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        validNameArb,
        validPriceArb,
        validBadgeArb,
        tokenArb,
        async (
          restaurantId: string,
          categoryId: string,
          name: string,
          price: number,
          badge: 'veg' | 'non_veg',
          token: string
        ) => {
          const queriesCalled: string[] = [];
          const now = new Date();

          (mockPool.query as jest.Mock).mockImplementation(
            (query: string, _params?: unknown[]) => {
              queriesCalled.push(query);

              // Category ownership check
              if (query.includes('SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2')) {
                return Promise.resolve({ rows: [{ id: categoryId }] });
              }
              // Insert food item
              if (query.includes('INSERT INTO food_items')) {
                return Promise.resolve({
                  rows: [
                    {
                      id: 'new-food-item-id',
                      category_id: categoryId,
                      restaurant_id: restaurantId,
                      name: name.trim(),
                      description: null,
                      price: price.toString(),
                      image_url: null,
                      badge,
                      is_available: true,
                      created_at: now,
                      updated_at: now,
                    },
                  ],
                });
              }
              return Promise.resolve({ rows: [] });
            }
          );

          await createFoodItem(restaurantId, categoryId, { name, price, badge });

          // Assert: no UPDATE query touches the restaurants table
          const restaurantUpdates = queriesCalled.filter(
            (q) => q.includes('UPDATE') && q.includes('restaurants')
          );
          expect(restaurantUpdates).toHaveLength(0);

          // Assert: no query modifies restaurant_token
          const tokenModifications = queriesCalled.filter((q) =>
            q.includes('restaurant_token')
          );
          const tokenWrites = tokenModifications.filter(
            (q) => q.includes('UPDATE') || q.includes('SET')
          );
          expect(tokenWrites).toHaveLength(0);
        }
      )
    );
  });

  it('updateFoodItem does not issue any UPDATE query on the restaurants table', async () => {
    await assertProperty(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        validNameArb,
        validPriceArb,
        validBadgeArb,
        tokenArb,
        async (
          restaurantId: string,
          itemId: string,
          name: string,
          price: number,
          badge: 'veg' | 'non_veg',
          _token: string
        ) => {
          const queriesCalled: string[] = [];
          const now = new Date();

          (mockPool.query as jest.Mock).mockImplementation(
            (query: string, _params?: unknown[]) => {
              queriesCalled.push(query);

              // Item ownership verification
              if (query.includes('SELECT * FROM food_items WHERE id = $1 AND restaurant_id = $2')) {
                return Promise.resolve({
                  rows: [
                    {
                      id: itemId,
                      category_id: 'cat-1',
                      restaurant_id: restaurantId,
                      name: 'Old Name',
                      description: null,
                      price: '10.00',
                      image_url: null,
                      badge: 'veg',
                      is_available: true,
                      created_at: now,
                      updated_at: now,
                    },
                  ],
                });
              }
              // Update food item
              if (query.includes('UPDATE food_items SET')) {
                return Promise.resolve({
                  rows: [
                    {
                      id: itemId,
                      category_id: 'cat-1',
                      restaurant_id: restaurantId,
                      name: name.trim(),
                      description: null,
                      price: price.toString(),
                      image_url: null,
                      badge,
                      is_available: true,
                      created_at: now,
                      updated_at: now,
                    },
                  ],
                });
              }
              return Promise.resolve({ rows: [] });
            }
          );

          await updateFoodItem(itemId, restaurantId, { name, price, badge });

          // Assert: no UPDATE query touches the restaurants table
          const restaurantUpdates = queriesCalled.filter(
            (q) => q.includes('UPDATE') && q.includes('restaurants')
          );
          expect(restaurantUpdates).toHaveLength(0);

          // Assert: no query modifies restaurant_token
          const tokenWrites = queriesCalled.filter(
            (q) => q.includes('restaurant_token') && (q.includes('UPDATE') || q.includes('SET'))
          );
          expect(tokenWrites).toHaveLength(0);
        }
      )
    );
  });

  it('deleteFoodItem does not issue any UPDATE query on the restaurants table', async () => {
    await assertProperty(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        tokenArb,
        async (restaurantId: string, itemId: string, _token: string) => {
          const queriesCalled: string[] = [];
          const now = new Date();

          (mockPool.query as jest.Mock).mockImplementation(
            (query: string, _params?: unknown[]) => {
              queriesCalled.push(query);

              // Item ownership verification
              if (query.includes('SELECT * FROM food_items WHERE id = $1 AND restaurant_id = $2')) {
                return Promise.resolve({
                  rows: [
                    {
                      id: itemId,
                      category_id: 'cat-1',
                      restaurant_id: restaurantId,
                      name: 'Item To Delete',
                      description: null,
                      price: '15.00',
                      image_url: null,
                      badge: 'veg',
                      is_available: true,
                      created_at: now,
                      updated_at: now,
                    },
                  ],
                });
              }
              // Delete food item
              if (query.includes('DELETE FROM food_items')) {
                return Promise.resolve({ rows: [], rowCount: 1 });
              }
              return Promise.resolve({ rows: [] });
            }
          );

          await deleteFoodItem(itemId, restaurantId);

          // Assert: no UPDATE query touches the restaurants table
          const restaurantUpdates = queriesCalled.filter(
            (q) => q.includes('UPDATE') && q.includes('restaurants')
          );
          expect(restaurantUpdates).toHaveLength(0);

          // Assert: no query modifies restaurant_token
          const tokenWrites = queriesCalled.filter(
            (q) => q.includes('restaurant_token') && (q.includes('UPDATE') || q.includes('SET'))
          );
          expect(tokenWrites).toHaveLength(0);
        }
      )
    );
  });

  it('across a sequence of create/update/delete food item operations, restaurant token remains unchanged', async () => {
    await assertProperty(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        validNameArb,
        validPriceArb,
        validBadgeArb,
        tokenArb,
        async (
          restaurantId: string,
          categoryId: string,
          itemId: string,
          name: string,
          price: number,
          badge: 'veg' | 'non_veg',
          originalToken: string
        ) => {
          const now = new Date();
          // Track all queries to verify token is never modified
          const allQueries: string[] = [];

          (mockPool.query as jest.Mock).mockImplementation(
            (query: string, _params?: unknown[]) => {
              allQueries.push(query);

              // Category ownership
              if (query.includes('SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2')) {
                return Promise.resolve({ rows: [{ id: categoryId }] });
              }
              // Insert food item
              if (query.includes('INSERT INTO food_items')) {
                return Promise.resolve({
                  rows: [
                    {
                      id: itemId,
                      category_id: categoryId,
                      restaurant_id: restaurantId,
                      name: name.trim(),
                      description: null,
                      price: price.toString(),
                      image_url: null,
                      badge,
                      is_available: true,
                      created_at: now,
                      updated_at: now,
                    },
                  ],
                });
              }
              // Item ownership verification
              if (query.includes('SELECT * FROM food_items WHERE id = $1 AND restaurant_id = $2')) {
                return Promise.resolve({
                  rows: [
                    {
                      id: itemId,
                      category_id: categoryId,
                      restaurant_id: restaurantId,
                      name: name.trim(),
                      description: null,
                      price: price.toString(),
                      image_url: null,
                      badge,
                      is_available: true,
                      created_at: now,
                      updated_at: now,
                    },
                  ],
                });
              }
              // Update food item
              if (query.includes('UPDATE food_items SET')) {
                return Promise.resolve({
                  rows: [
                    {
                      id: itemId,
                      category_id: categoryId,
                      restaurant_id: restaurantId,
                      name: 'Updated Name',
                      description: 'Updated desc',
                      price: '20.00',
                      image_url: null,
                      badge: 'non_veg',
                      is_available: true,
                      created_at: now,
                      updated_at: now,
                    },
                  ],
                });
              }
              // Delete food item
              if (query.includes('DELETE FROM food_items')) {
                return Promise.resolve({ rows: [], rowCount: 1 });
              }
              return Promise.resolve({ rows: [] });
            }
          );

          // Perform a sequence of menu operations
          await createFoodItem(restaurantId, categoryId, { name, price, badge });
          await updateFoodItem(itemId, restaurantId, { name: 'Updated Name', price: 20, badge: 'non_veg' });
          await deleteFoodItem(itemId, restaurantId);

          // Assert: No query touched restaurant_token in a write context
          const tokenWriteQueries = allQueries.filter(
            (q) =>
              q.includes('restaurant_token') &&
              (q.includes('UPDATE') || q.includes('INSERT INTO restaurants'))
          );
          expect(tokenWriteQueries).toHaveLength(0);

          // Assert: No UPDATE was issued against restaurants table at all
          const restaurantMutations = allQueries.filter(
            (q) => (q.includes('UPDATE') || q.includes('DELETE FROM')) && q.includes('restaurants')
          );
          expect(restaurantMutations).toHaveLength(0);
        }
      )
    );
  });
});
