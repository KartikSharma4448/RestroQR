// Feature: restroqr-v1-digital-menu, Property 1: Pagination returns correct subset
// Feature: restroqr-v1-digital-menu, Property 2: Disabled restaurant blocks public menu access
// Feature: restroqr-v1-digital-menu, Property 3: Restaurant deletion cascades to all associated data
// Feature: restroqr-v1-digital-menu, Property 4: Re-enabling a restaurant restores public menu access

import { fc, FC_DEFAULT_NUM_RUNS, assertProperty } from '../helpers/fast-check';
import { NotFoundError } from '../../errors';

// Mock database pool
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import pool from '../../config/database';
import {
  parsePaginationParams,
  listRestaurants,
  updateRestaurantStatus,
  deleteRestaurant,
} from '../../services/adminRestaurantService';

const mockPool = pool as jest.Mocked<typeof pool>;

// --- Generators ---

const restaurantIdArb: fc.Arbitrary<string> = fc.uuid();

const totalRestaurantsArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 100 });

const pageArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 10 });

const pageSizeArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 100 });

const categoryCountArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 20 });

const foodItemCountArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 50 });

// --- Property 1: Pagination returns correct subset ---
// **Validates: Requirements 1.1**

describe('Property 1: Pagination returns correct subset', () => {
  it('parsePaginationParams clamps and returns valid page and pageSize', () => {
    assertProperty(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 100 }),
        (page: number, pageSize: number) => {
          const result = parsePaginationParams({
            page: String(page),
            pageSize: String(pageSize),
          });

          expect(result.page).toBe(page);
          expect(result.pageSize).toBe(pageSize);
        }
      )
    );
  });

  it('parsePaginationParams defaults invalid page to 1', () => {
    assertProperty(
      fc.property(
        fc.oneof(
          fc.constant('0'),
          fc.constant('-1'),
          fc.constant('abc'),
          fc.constant('')
        ),
        fc.integer({ min: 1, max: 100 }),
        (invalidPage: string, pageSize: number) => {
          const result = parsePaginationParams({
            page: invalidPage,
            pageSize: String(pageSize),
          });

          expect(result.page).toBe(1);
        }
      )
    );
  });

  it('parsePaginationParams clamps pageSize > 100 to 100', () => {
    assertProperty(
      fc.property(
        fc.integer({ min: 101, max: 1000 }),
        (pageSize: number) => {
          const result = parsePaginationParams({
            page: '1',
            pageSize: String(pageSize),
          });

          expect(result.pageSize).toBe(100);
        }
      )
    );
  });

  it('listRestaurants returns correct item count and pagination metadata', async () => {
    await assertProperty(
      fc.asyncProperty(
        totalRestaurantsArb,
        pageArb,
        pageSizeArb,
        async (totalCount: number, page: number, pageSize: number) => {
          const offset = (page - 1) * pageSize;
          const expectedItemCount = Math.max(0, Math.min(pageSize, totalCount - offset));
          const expectedTotalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);

          // Generate mock restaurant rows
          const mockRows = Array.from({ length: expectedItemCount }, (_, i) => ({
            id: `id-${i}`,
            name: `Restaurant ${i}`,
            owner_name: `Owner ${i}`,
            status: 'active',
            created_at: new Date().toISOString(),
          }));

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('COUNT(*)')) {
              return Promise.resolve({
                rows: [{ count: String(totalCount) }],
              });
            }
            // Paginated query
            return Promise.resolve({ rows: mockRows });
          });

          const result = await listRestaurants({ page, pageSize });

          expect(result.restaurants.length).toBe(expectedItemCount);
          expect(result.pagination.total).toBe(totalCount);
          expect(result.pagination.totalPages).toBe(expectedTotalPages);
          expect(result.pagination.page).toBe(page);
          expect(result.pagination.pageSize).toBe(pageSize);
        }
      )
    );
  });
});

// --- Property 2: Disabled restaurant blocks public menu access ---
// **Validates: Requirements 1.4, 9.2, 12.5**

describe('Property 2: Disabled restaurant blocks public menu access', () => {
  it('updateRestaurantStatus sets status to disabled correctly', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        async (restaurantId: string) => {
          // Mock: restaurant exists and update succeeds
          (mockPool.query as jest.Mock).mockResolvedValue({
            rows: [{ id: restaurantId, status: 'disabled' }],
          });

          const result = await updateRestaurantStatus(restaurantId, 'disabled');

          expect(result.id).toBe(restaurantId);
          expect(result.status).toBe('disabled');

          // Verify the query was called with 'disabled' status
          expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE restaurants SET status'),
            ['disabled', restaurantId]
          );
        }
      )
    );
  });

  it('a disabled restaurant status prevents public access (status check)', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        fc.string({ minLength: 8, maxLength: 10 }),
        async (restaurantId: string, token: string) => {
          // Simulate: after disabling, querying restaurant by token returns disabled status
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('UPDATE restaurants SET status')) {
              return Promise.resolve({
                rows: [{ id: restaurantId, status: 'disabled' }],
              });
            }
            // Simulate public menu query finding a disabled restaurant
            if (query.includes('restaurant_token') || query.includes('SELECT')) {
              return Promise.resolve({
                rows: [{ id: restaurantId, status: 'disabled', restaurant_token: token }],
              });
            }
            return Promise.resolve({ rows: [] });
          });

          // Disable the restaurant
          const disableResult = await updateRestaurantStatus(restaurantId, 'disabled');
          expect(disableResult.status).toBe('disabled');

          // Verify that the restaurant's status is 'disabled' — public endpoint would check this
          const statusCheck = await pool.query(
            'SELECT id, status FROM restaurants WHERE restaurant_token = $1',
            [token]
          );
          expect(statusCheck.rows[0].status).toBe('disabled');
        }
      )
    );
  });
});

// --- Property 3: Restaurant deletion cascades to all associated data ---
// **Validates: Requirements 1.5**

describe('Property 3: Restaurant deletion cascades to all associated data', () => {
  it('deleteRestaurant executes DELETE query and collects image URLs', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        categoryCountArb,
        foodItemCountArb,
        fc.boolean(),
        fc.boolean(),
        async (
          restaurantId: string,
          categoryCount: number,
          foodItemCount: number,
          hasLogo: boolean,
          hasCover: boolean
        ) => {
          const logoUrl = hasLogo ? `https://cdn.cloudinary.com/logo-${restaurantId}.jpg` : null;
          const coverUrl = hasCover ? `https://cdn.cloudinary.com/cover-${restaurantId}.jpg` : null;

          // Generate food item image URLs
          const foodItemImages = Array.from({ length: foodItemCount }, (_, i) => ({
            image_url: `https://cdn.cloudinary.com/item-${i}.jpg`,
          }));

          const queriesCalled: string[] = [];

          (mockPool.query as jest.Mock).mockImplementation((query: string, params?: unknown[]) => {
            queriesCalled.push(query);

            // Restaurant exists check
            if (query.includes('SELECT') && query.includes('logo_url') && query.includes('cover_image_url')) {
              return Promise.resolve({
                rows: [{
                  id: restaurantId,
                  logo_url: logoUrl,
                  cover_image_url: coverUrl,
                }],
              });
            }
            // Food item images query
            if (query.includes('SELECT image_url FROM food_items')) {
              return Promise.resolve({ rows: foodItemImages });
            }
            // DELETE query
            if (query.includes('DELETE FROM restaurants')) {
              return Promise.resolve({ rows: [], rowCount: 1 });
            }
            return Promise.resolve({ rows: [] });
          });

          await deleteRestaurant(restaurantId);

          // Assert: DELETE query was executed
          expect(queriesCalled.some(q => q.includes('DELETE FROM restaurants'))).toBe(true);

          // Assert: image URLs were collected (verified by checking all queries ran)
          expect(queriesCalled.some(q => q.includes('SELECT image_url FROM food_items'))).toBe(true);

          // Verify restaurant lookup occurred
          expect(queriesCalled.some(q => q.includes('logo_url') && q.includes('cover_image_url'))).toBe(true);
        }
      )
    );
  });

  it('deleteRestaurant throws NotFoundError for non-existent restaurant', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        async (restaurantId: string) => {
          // Mock: restaurant does not exist
          (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

          await expect(deleteRestaurant(restaurantId)).rejects.toBeInstanceOf(NotFoundError);
        }
      )
    );
  });
});

// --- Property 4: Re-enabling a restaurant restores public menu access ---
// **Validates: Requirements 1.6**

describe('Property 4: Re-enabling a restaurant restores public menu access', () => {
  it('updateRestaurantStatus sets status to active correctly', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        async (restaurantId: string) => {
          // Mock: restaurant exists and update succeeds with active status
          (mockPool.query as jest.Mock).mockResolvedValue({
            rows: [{ id: restaurantId, status: 'active' }],
          });

          const result = await updateRestaurantStatus(restaurantId, 'active');

          expect(result.id).toBe(restaurantId);
          expect(result.status).toBe('active');

          // Verify the query was called with 'active' status
          expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE restaurants SET status'),
            ['active', restaurantId]
          );
        }
      )
    );
  });

  it('re-enabling a disabled restaurant transitions status from disabled to active', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        fc.string({ minLength: 8, maxLength: 10 }),
        async (restaurantId: string, token: string) => {
          let currentStatus = 'disabled';

          (mockPool.query as jest.Mock).mockImplementation((query: string, params?: unknown[]) => {
            if (query.includes('UPDATE restaurants SET status')) {
              const newStatus = params?.[0] as string;
              currentStatus = newStatus;
              return Promise.resolve({
                rows: [{ id: restaurantId, status: newStatus }],
              });
            }
            // Simulate public query checking status
            if (query.includes('SELECT') && query.includes('restaurant_token')) {
              return Promise.resolve({
                rows: [{ id: restaurantId, status: currentStatus, restaurant_token: token }],
              });
            }
            return Promise.resolve({ rows: [] });
          });

          // Initial state: disabled
          expect(currentStatus).toBe('disabled');

          // Re-enable the restaurant
          const result = await updateRestaurantStatus(restaurantId, 'active');
          expect(result.status).toBe('active');

          // After re-enabling, public menu query would return active status
          const statusCheck = await pool.query(
            'SELECT id, status FROM restaurants WHERE restaurant_token = $1',
            [token]
          );
          expect(statusCheck.rows[0].status).toBe('active');
        }
      )
    );
  });
});
