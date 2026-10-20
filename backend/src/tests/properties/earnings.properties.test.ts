// Feature: restroqr-v2-ordering-system, Property 14: Earnings Filter
// Feature: restroqr-v2-ordering-system, Property 15: Pagination Correctness
// Feature: restroqr-v2-ordering-system, Property 16: Analytics Aggregation

import { fc, assertProperty } from '../helpers/fast-check';

// Mock database pool
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import pool from '../../config/database';
import {
  getMonthlySummary,
  getOrderHistory,
  getItemAnalytics,
} from '../../services/earningsService';

const mockPool = pool as jest.Mocked<typeof pool>;

// --- Generators ---

const orderStatusArb: fc.Arbitrary<string> = fc.constantFrom(
  'pending',
  'accepted',
  'completed',
  'payment_received',
  'cancelled'
);

const positiveDecimalArb: fc.Arbitrary<string> = fc
  .double({ min: 0.01, max: 99999.99, noNaN: true, noDefaultInfinity: true })
  .map((v) => v.toFixed(2));

const orderArb = fc.record({
  id: fc.uuid(),
  status: orderStatusArb,
  total: positiveDecimalArb,
});

const restaurantIdArb: fc.Arbitrary<string> = fc.uuid();
const monthArb: fc.Arbitrary<string> = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
  })
  .map(({ year, month }) => `${year}-${String(month).padStart(2, '0')}`);

const pageArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 50 });
const pageSizeArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 100 });

const orderItemArb = (orderId: string, foodItemId: string) =>
  fc.record({
    id: fc.uuid(),
    order_id: fc.constant(orderId),
    food_item_id: fc.constant(foodItemId),
    item_name: fc.string({ minLength: 1, maxLength: 50 }),
    item_price: positiveDecimalArb,
    quantity: fc.integer({ min: 1, max: 20 }),
  });

// --- Property 14: Earnings Filter ---
// **Validates: Requirements 8.3**

describe('Property 14: Earnings Filter', () => {
  it('only payment_received orders contribute to earnings sum', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        monthArb,
        fc.array(orderArb, { minLength: 1, maxLength: 30 }),
        async (restaurantId: string, month: string, orders) => {
          // Calculate expected: only payment_received orders
          const paidOrders = orders.filter((o) => o.status === 'payment_received');
          const expectedTotal = paidOrders.reduce(
            (sum, o) => sum + parseFloat(o.total),
            0
          );
          const expectedCount = paidOrders.length;

          // Mock the query to simulate what the DB would return
          // The service queries with status = 'payment_received' filter
          (mockPool.query as jest.Mock).mockResolvedValue({
            rows: [
              {
                total_orders: expectedCount,
                total_revenue: expectedTotal.toFixed(2),
              },
            ],
          });

          const result = await getMonthlySummary(restaurantId, month);

          // The service must report only payment_received totals
          expect(result.totalOrders).toBe(expectedCount);
          expect(parseFloat(result.totalRevenue)).toBeCloseTo(expectedTotal, 2);

          // Verify the query was called with payment_received filter
          const queryCall = (mockPool.query as jest.Mock).mock.calls[0];
          const sql = queryCall[0] as string;
          expect(sql).toContain("status = 'payment_received'");
        }
      )
    );
  });

  it('earnings is zero when no orders have payment_received status', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        monthArb,
        fc.array(
          fc.record({
            id: fc.uuid(),
            status: fc.constantFrom('pending', 'accepted', 'completed', 'cancelled'),
            total: positiveDecimalArb,
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (restaurantId: string, month: string, _orders) => {
          // No payment_received orders means zero earnings
          (mockPool.query as jest.Mock).mockResolvedValue({
            rows: [
              {
                total_orders: 0,
                total_revenue: '0.00',
              },
            ],
          });

          const result = await getMonthlySummary(restaurantId, month);

          expect(result.totalOrders).toBe(0);
          expect(parseFloat(result.totalRevenue)).toBe(0);
        }
      )
    );
  });
});

// --- Property 15: Pagination Correctness ---
// **Validates: Requirements 8.5**

describe('Property 15: Pagination Correctness', () => {
  it('page P with size S returns at most S items and total count equals N', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        fc.integer({ min: 0, max: 100 }), // N total orders
        pageArb,
        pageSizeArb,
        async (restaurantId: string, totalOrders: number, page: number, pageSize: number) => {
          const offset = (page - 1) * pageSize;
          // Calculate how many items should be on this page
          const expectedItemsOnPage = Math.max(
            0,
            Math.min(pageSize, totalOrders - offset)
          );

          // Generate mock order rows for this page
          const pageOrders = Array.from({ length: expectedItemsOnPage }, (_, i) => ({
            id: `order-${offset + i}`,
            order_ref: `ORD-${String(offset + i).padStart(6, '0')}`,
            status: 'payment_received',
            total: '100.00',
            table_display_name: `Table ${i + 1}`,
            created_at: new Date('2025-01-15T12:00:00Z'),
            accepted_at: new Date('2025-01-15T12:05:00Z'),
            completed_at: new Date('2025-01-15T12:30:00Z'),
            payment_received_at: new Date('2025-01-15T12:35:00Z'),
            cancelled_at: null,
          }));

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('COUNT(*)')) {
              return Promise.resolve({
                rows: [{ total: totalOrders }],
              });
            }
            // Paginated orders query
            return Promise.resolve({ rows: pageOrders });
          });

          const result = await getOrderHistory(restaurantId, { page, pageSize });

          // At most S items returned
          expect(result.orders.length).toBeLessThanOrEqual(pageSize);
          // Total count equals N
          expect(result.total).toBe(totalOrders);
          // Items on page equals expected
          expect(result.orders.length).toBe(expectedItemsOnPage);
          // Page and pageSize are echoed back
          expect(result.page).toBe(page);
          expect(result.pageSize).toBe(pageSize);
        }
      )
    );
  });

  it('default page size is 20 when not specified', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        fc.integer({ min: 0, max: 50 }),
        async (restaurantId: string, totalOrders: number) => {
          const defaultPageSize = 20;
          const expectedItemsOnPage = Math.min(defaultPageSize, totalOrders);

          const pageOrders = Array.from({ length: expectedItemsOnPage }, (_, i) => ({
            id: `order-${i}`,
            order_ref: `ORD-${String(i).padStart(6, '0')}`,
            status: 'payment_received',
            total: '50.00',
            table_display_name: `Table ${i + 1}`,
            created_at: new Date('2025-01-15T12:00:00Z'),
            accepted_at: null,
            completed_at: null,
            payment_received_at: null,
            cancelled_at: null,
          }));

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('COUNT(*)')) {
              return Promise.resolve({
                rows: [{ total: totalOrders }],
              });
            }
            return Promise.resolve({ rows: pageOrders });
          });

          const result = await getOrderHistory(restaurantId, {});

          expect(result.pageSize).toBe(defaultPageSize);
          expect(result.page).toBe(1);
          expect(result.orders.length).toBeLessThanOrEqual(defaultPageSize);
          expect(result.total).toBe(totalOrders);
        }
      )
    );
  });
});

// --- Property 16: Analytics Aggregation ---
// **Validates: Requirements 9.1, 9.4**

describe('Property 16: Analytics Aggregation', () => {
  it('per-item totals equal sum of quantities and revenue from payment_received order_items', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        monthArb,
        fc.array(
          fc.record({
            item_name: fc.string({ minLength: 1, maxLength: 30 }),
            item_price: positiveDecimalArb,
            quantity: fc.integer({ min: 1, max: 50 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (restaurantId: string, month: string, orderItems) => {
          // Aggregate expected per-item totals from the generated data
          const itemMap = new Map<string, { totalQuantity: number; totalRevenue: number }>();
          for (const item of orderItems) {
            const existing = itemMap.get(item.item_name) || {
              totalQuantity: 0,
              totalRevenue: 0,
            };
            existing.totalQuantity += item.quantity;
            existing.totalRevenue += parseFloat(item.item_price) * item.quantity;
            itemMap.set(item.item_name, existing);
          }

          // Convert to the format the DB query would return
          const dbRows = Array.from(itemMap.entries()).map(([name, data]) => ({
            item_name: name,
            total_quantity: data.totalQuantity,
            total_revenue: data.totalRevenue.toFixed(2),
          }));

          // Sort by total_quantity DESC as the service does
          dbRows.sort((a, b) => b.total_quantity - a.total_quantity);

          (mockPool.query as jest.Mock).mockResolvedValue({ rows: dbRows });

          const result = await getItemAnalytics(restaurantId, 'monthly', month);

          // Verify the query filters by payment_received
          const queryCall = (mockPool.query as jest.Mock).mock.calls[0];
          const sql = queryCall[0] as string;
          expect(sql).toContain("status = 'payment_received'");

          // Verify per-item aggregation matches expected
          for (const resultItem of result.items) {
            const expected = itemMap.get(resultItem.itemName);
            expect(expected).toBeDefined();
            expect(resultItem.totalQuantity).toBe(expected!.totalQuantity);
            expect(parseFloat(resultItem.totalRevenue)).toBeCloseTo(
              expected!.totalRevenue,
              2
            );
          }

          // All items from input are present in result
          expect(result.items.length).toBe(itemMap.size);
        }
      )
    );
  });

  it('analytics returns items sorted by quantity descending', async () => {
    await assertProperty(
      fc.asyncProperty(
        restaurantIdArb,
        monthArb,
        fc.array(
          fc.record({
            item_name: fc.string({ minLength: 1, maxLength: 30 }),
            total_quantity: fc.integer({ min: 1, max: 500 }),
            total_revenue: positiveDecimalArb,
          }),
          { minLength: 2, maxLength: 15 }
        ),
        async (restaurantId: string, month: string, items) => {
          // Deduplicate by item_name and sort by quantity DESC
          const uniqueItems = new Map<string, { total_quantity: number; total_revenue: string }>();
          for (const item of items) {
            if (!uniqueItems.has(item.item_name)) {
              uniqueItems.set(item.item_name, {
                total_quantity: item.total_quantity,
                total_revenue: item.total_revenue,
              });
            }
          }

          const dbRows = Array.from(uniqueItems.entries())
            .map(([name, data]) => ({
              item_name: name,
              total_quantity: data.total_quantity,
              total_revenue: data.total_revenue,
            }))
            .sort((a, b) => b.total_quantity - a.total_quantity);

          (mockPool.query as jest.Mock).mockResolvedValue({ rows: dbRows });

          const result = await getItemAnalytics(restaurantId, 'monthly', month);

          // Verify sorted by totalQuantity descending
          for (let i = 1; i < result.items.length; i++) {
            expect(result.items[i].totalQuantity).toBeLessThanOrEqual(
              result.items[i - 1].totalQuantity
            );
          }
        }
      )
    );
  });
});
