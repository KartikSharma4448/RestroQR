// Feature: restroqr-v2-ordering-system, Property 6: Order Item Validation (All-or-Nothing)
// Feature: restroqr-v2-ordering-system, Property 7: Order Total Integrity
// Feature: restroqr-v2-ordering-system, Property 8: Initial Order State Invariant
// Feature: restroqr-v2-ordering-system, Property 9: Multiple Orders Per Table

import { fc, assertProperty } from '../helpers/fast-check';
import { ValidationError } from '../../errors';

// Set TABLE_TOKEN_SECRET before importing services
process.env.TABLE_TOKEN_SECRET = 'test-secret-key-for-properties';

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

// Mock decryptTableToken from tableService
jest.mock('../../services/tableService', () => ({
  decryptTableToken: jest.fn(),
}));

import pool from '../../config/database';
import { decryptTableToken } from '../../services/tableService';
import { createOrder } from '../../services/orderService';

const mockPool = pool as jest.Mocked<typeof pool>;
const mockDecryptTableToken = decryptTableToken as jest.MockedFunction<typeof decryptTableToken>;

// Helper to get the mock client
function getMockClient() {
  return (mockPool.connect as jest.Mock).mock.results[0]?.value || {
    query: jest.fn(),
    release: jest.fn(),
  };
}

// --- Generators ---

const uuidArb = fc.uuid();

/** Generates a valid item with a price (as string decimal) and quantity */
const orderItemArb = fc.record({
  itemId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(9999.99), noNaN: true }).map((p) => p.toFixed(2)),
  quantity: fc.integer({ min: 1, max: 100 }),
});

/** Generates a non-empty array of valid order items (1 to 10) */
const validItemsArb = fc.array(orderItemArb, { minLength: 1, maxLength: 10 });

/** Generates a fake table token string */
const tableTokenArb = fc.string({ minLength: 10, maxLength: 50 });

// --- Property 6: Order Item Validation (All-or-Nothing) ---
// **Validates: Requirements 4.2, 4.6**

describe('Property 6: Order Item Validation (All-or-Nothing)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('when at least one item does not belong to the restaurant, the entire order is rejected and no DB record is created', async () => {
    await assertProperty(
      fc.asyncProperty(
        tableTokenArb,
        uuidArb, // restaurantId
        uuidArb, // tableId
        validItemsArb,
        fc.integer({ min: 0, max: 9 }), // index of invalid item (within items range)
        async (token, restaurantId, tableId, items, invalidIdx) => {
          jest.clearAllMocks();

          const mockClient = {
            query: jest.fn(),
            release: jest.fn(),
          };
          (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

          // Setup decryptTableToken to return valid IDs
          mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

          // Restaurant exists with qr_mode 'multi'
          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('FROM restaurants')) {
              return Promise.resolve({ rows: [{ id: restaurantId, qr_mode: 'multi' }] });
            }
            if (query.includes('FROM tables')) {
              return Promise.resolve({ rows: [{ id: tableId }] });
            }
            if (query.includes('FROM food_items')) {
              // Return all items EXCEPT the one at invalidIdx (making it "not found")
              const safeIdx = invalidIdx % items.length;
              const rows = items
                .filter((_, idx) => idx !== safeIdx)
                .map((item) => ({
                  id: item.itemId,
                  name: item.name,
                  price: item.price,
                  is_available: true,
                  restaurant_id: restaurantId,
                }));
              return Promise.resolve({ rows });
            }
            return Promise.resolve({ rows: [] });
          });

          const orderItems = items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          }));

          // The order should be rejected
          await expect(createOrder(token, orderItems)).rejects.toThrow(ValidationError);

          // No BEGIN/COMMIT should be called (no transaction started for DB insert)
          expect(mockClient.query).not.toHaveBeenCalledWith('BEGIN');
          expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
        }
      )
    );
  });

  it('when at least one item is marked unavailable, the entire order is rejected and no DB record is created', async () => {
    await assertProperty(
      fc.asyncProperty(
        tableTokenArb,
        uuidArb,
        uuidArb,
        validItemsArb,
        fc.integer({ min: 0, max: 9 }), // index of unavailable item
        async (token, restaurantId, tableId, items, unavailableIdx) => {
          jest.clearAllMocks();

          const mockClient = {
            query: jest.fn(),
            release: jest.fn(),
          };
          (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

          mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

          const safeIdx = unavailableIdx % items.length;

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('FROM restaurants')) {
              return Promise.resolve({ rows: [{ id: restaurantId, qr_mode: 'multi' }] });
            }
            if (query.includes('FROM tables')) {
              return Promise.resolve({ rows: [{ id: tableId }] });
            }
            if (query.includes('FROM food_items')) {
              // Return all items, but mark one as unavailable
              const rows = items.map((item, idx) => ({
                id: item.itemId,
                name: item.name,
                price: item.price,
                is_available: idx !== safeIdx,
                restaurant_id: restaurantId,
              }));
              return Promise.resolve({ rows });
            }
            return Promise.resolve({ rows: [] });
          });

          const orderItems = items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          }));

          await expect(createOrder(token, orderItems)).rejects.toThrow(ValidationError);

          // No transaction started
          expect(mockClient.query).not.toHaveBeenCalledWith('BEGIN');
          expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
        }
      )
    );
  });
});

// --- Property 7: Order Total Integrity ---
// **Validates: Requirements 4.7, 10.5**

describe('Property 7: Order Total Integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('for any valid order, the stored total equals sum of (price × quantity) for all items', async () => {
    await assertProperty(
      fc.asyncProperty(
        tableTokenArb,
        uuidArb,
        uuidArb,
        validItemsArb,
        async (token, restaurantId, tableId, items) => {
          jest.clearAllMocks();

          const now = new Date();
          const orderId = 'order-id-123';

          const mockClient = {
            query: jest.fn(),
            release: jest.fn(),
          };
          (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

          mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

          // Calculate expected total
          const expectedTotal = items.reduce(
            (sum, item) => sum + parseFloat(item.price) * item.quantity,
            0
          );

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('FROM restaurants')) {
              return Promise.resolve({ rows: [{ id: restaurantId, qr_mode: 'multi' }] });
            }
            if (query.includes('FROM tables')) {
              return Promise.resolve({ rows: [{ id: tableId }] });
            }
            if (query.includes('FROM food_items')) {
              const rows = items.map((item) => ({
                id: item.itemId,
                name: item.name,
                price: item.price,
                is_available: true,
                restaurant_id: restaurantId,
              }));
              return Promise.resolve({ rows });
            }
            return Promise.resolve({ rows: [] });
          });

          // Track the total passed to INSERT
          let capturedTotal: string | null = null;

          mockClient.query.mockImplementation((query: string, params?: unknown[]) => {
            if (query === 'BEGIN' || query === 'COMMIT' || query === 'ROLLBACK') {
              return Promise.resolve();
            }
            if (query.includes('SELECT id FROM orders WHERE order_ref')) {
              return Promise.resolve({ rows: [] }); // order_ref is unique
            }
            if (query.includes('INSERT INTO orders')) {
              capturedTotal = params?.[3] as string;
              return Promise.resolve({
                rows: [
                  {
                    id: orderId,
                    restaurant_id: restaurantId,
                    table_id: tableId,
                    order_ref: 'ORD-TEST01',
                    status: 'pending',
                    total: capturedTotal,
                    created_at: now,
                    accepted_at: null,
                    completed_at: null,
                    payment_received_at: null,
                    cancelled_at: null,
                    updated_at: now,
                  },
                ],
              });
            }
            if (query.includes('INSERT INTO order_items')) {
              return Promise.resolve({
                rows: [
                  {
                    id: `item-${Math.random()}`,
                    order_id: orderId,
                    food_item_id: params?.[1],
                    item_name: params?.[2],
                    item_price: params?.[3],
                    quantity: params?.[4],
                    created_at: now,
                  },
                ],
              });
            }
            return Promise.resolve({ rows: [] });
          });

          const orderItems = items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          }));

          const result = await createOrder(token, orderItems);

          // The total stored should equal our expected calculation
          expect(capturedTotal).toBe(expectedTotal.toFixed(2));
          expect(result.total).toBe(expectedTotal.toFixed(2));
        }
      )
    );
  });
});

// --- Property 8: Initial Order State Invariant ---
// **Validates: Requirements 4.3**

describe('Property 8: Initial Order State Invariant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('for any successfully created order, initial status is "pending" and table_id matches', async () => {
    await assertProperty(
      fc.asyncProperty(
        tableTokenArb,
        uuidArb,
        uuidArb,
        validItemsArb,
        async (token, restaurantId, tableId, items) => {
          jest.clearAllMocks();

          const now = new Date();
          const orderId = 'order-id-456';

          const mockClient = {
            query: jest.fn(),
            release: jest.fn(),
          };
          (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

          mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

          (mockPool.query as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('FROM restaurants')) {
              return Promise.resolve({ rows: [{ id: restaurantId, qr_mode: 'multi' }] });
            }
            if (query.includes('FROM tables')) {
              return Promise.resolve({ rows: [{ id: tableId }] });
            }
            if (query.includes('FROM food_items')) {
              const rows = items.map((item) => ({
                id: item.itemId,
                name: item.name,
                price: item.price,
                is_available: true,
                restaurant_id: restaurantId,
              }));
              return Promise.resolve({ rows });
            }
            return Promise.resolve({ rows: [] });
          });

          mockClient.query.mockImplementation((query: string, params?: unknown[]) => {
            if (query === 'BEGIN' || query === 'COMMIT' || query === 'ROLLBACK') {
              return Promise.resolve();
            }
            if (query.includes('SELECT id FROM orders WHERE order_ref')) {
              return Promise.resolve({ rows: [] });
            }
            if (query.includes('INSERT INTO orders')) {
              return Promise.resolve({
                rows: [
                  {
                    id: orderId,
                    restaurant_id: restaurantId,
                    table_id: tableId,
                    order_ref: 'ORD-ABC123',
                    status: 'pending',
                    total: '100.00',
                    created_at: now,
                    accepted_at: null,
                    completed_at: null,
                    payment_received_at: null,
                    cancelled_at: null,
                    updated_at: now,
                  },
                ],
              });
            }
            if (query.includes('INSERT INTO order_items')) {
              return Promise.resolve({
                rows: [
                  {
                    id: `item-${Math.random()}`,
                    order_id: orderId,
                    food_item_id: params?.[1],
                    item_name: params?.[2],
                    item_price: params?.[3],
                    quantity: params?.[4],
                    created_at: now,
                  },
                ],
              });
            }
            return Promise.resolve({ rows: [] });
          });

          const orderItems = items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          }));

          const result = await createOrder(token, orderItems);

          // Status must always be 'pending'
          expect(result.status).toBe('pending');
          // Table ID must match what was in the token
          expect(result.tableId).toBe(tableId);
        }
      )
    );
  });
});

// --- Property 9: Multiple Orders Per Table ---
// **Validates: Requirements 4.5**

describe('Property 9: Multiple Orders Per Table', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('N valid orders create N distinct records for the same table', async () => {
    await assertProperty(
      fc.asyncProperty(
        tableTokenArb,
        uuidArb,
        uuidArb,
        validItemsArb,
        fc.integer({ min: 2, max: 5 }), // N orders
        async (token, restaurantId, tableId, items, orderCount) => {
          const createdOrderIds: string[] = [];

          mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

          for (let n = 0; n < orderCount; n++) {
            jest.clearAllMocks();
            // Re-set the decrypt mock since clearAllMocks clears it
            mockDecryptTableToken.mockReturnValue({ restaurantId, tableId });

            const now = new Date();
            const orderId = `order-${n}-${Math.random().toString(36).slice(2)}`;

            const mockClient = {
              query: jest.fn(),
              release: jest.fn(),
            };
            (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

            (mockPool.query as jest.Mock).mockImplementation((query: string) => {
              if (query.includes('FROM restaurants')) {
                return Promise.resolve({ rows: [{ id: restaurantId, qr_mode: 'multi' }] });
              }
              if (query.includes('FROM tables')) {
                return Promise.resolve({ rows: [{ id: tableId }] });
              }
              if (query.includes('FROM food_items')) {
                const rows = items.map((item) => ({
                  id: item.itemId,
                  name: item.name,
                  price: item.price,
                  is_available: true,
                  restaurant_id: restaurantId,
                }));
                return Promise.resolve({ rows });
              }
              return Promise.resolve({ rows: [] });
            });

            mockClient.query.mockImplementation((query: string, params?: unknown[]) => {
              if (query === 'BEGIN' || query === 'COMMIT' || query === 'ROLLBACK') {
                return Promise.resolve();
              }
              if (query.includes('SELECT id FROM orders WHERE order_ref')) {
                return Promise.resolve({ rows: [] });
              }
              if (query.includes('INSERT INTO orders')) {
                return Promise.resolve({
                  rows: [
                    {
                      id: orderId,
                      restaurant_id: restaurantId,
                      table_id: tableId,
                      order_ref: `ORD-${n}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
                      status: 'pending',
                      total: '50.00',
                      created_at: now,
                      accepted_at: null,
                      completed_at: null,
                      payment_received_at: null,
                      cancelled_at: null,
                      updated_at: now,
                    },
                  ],
                });
              }
              if (query.includes('INSERT INTO order_items')) {
                return Promise.resolve({
                  rows: [
                    {
                      id: `item-${Math.random()}`,
                      order_id: orderId,
                      food_item_id: params?.[1],
                      item_name: params?.[2],
                      item_price: params?.[3],
                      quantity: params?.[4],
                      created_at: now,
                    },
                  ],
                });
              }
              return Promise.resolve({ rows: [] });
            });

            const orderItems = items.map((item) => ({
              itemId: item.itemId,
              quantity: item.quantity,
            }));

            const result = await createOrder(token, orderItems);
            createdOrderIds.push(result.id);
          }

          // All N orders should have distinct IDs
          const uniqueIds = new Set(createdOrderIds);
          expect(uniqueIds.size).toBe(orderCount);

          // All orders should be for the same table
          expect(createdOrderIds.length).toBe(orderCount);
        }
      )
    );
  });
});
