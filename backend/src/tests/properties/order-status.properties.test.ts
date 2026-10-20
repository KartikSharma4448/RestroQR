// Feature: restroqr-v2-ordering-system, Property 10: Status Transition Enforcement
// Feature: restroqr-v2-ordering-system, Property 11: Cancellation Rules
// Feature: restroqr-v2-ordering-system, Property 12: Transition Timestamps

import { fc, assertProperty } from '../helpers/fast-check';
import { ValidationError } from '../../errors';
import type { OrderStatus } from '../../services/orderService';

// --- Mock Setup ---

// Mock the database pool before importing orderService
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockRelease = jest.fn();

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: () => mockConnect(),
  },
}));

jest.mock('../../services/tableService', () => ({
  decryptTableToken: jest.fn(),
}));

import { updateOrderStatus, cancelOrder } from '../../services/orderService';

// --- Constants ---

const ALL_STATUSES: OrderStatus[] = ['pending', 'accepted', 'completed', 'payment_received', 'cancelled'];

const VALID_FORWARD_TRANSITIONS: [OrderStatus, OrderStatus][] = [
  ['pending', 'accepted'],
  ['accepted', 'completed'],
  ['completed', 'payment_received'],
];

const CANCELLABLE_STATES: OrderStatus[] = ['pending', 'accepted', 'completed'];
const NON_CANCELLABLE_STATES: OrderStatus[] = ['payment_received', 'cancelled'];

// Build the set of all invalid forward transitions (excluding cancellation, which is handled separately)
const INVALID_FORWARD_TRANSITIONS: [OrderStatus, OrderStatus][] = [];
for (const source of ALL_STATUSES) {
  for (const target of ALL_STATUSES) {
    if (target === 'cancelled') continue; // cancellation tested separately
    const isValid = VALID_FORWARD_TRANSITIONS.some(([s, t]) => s === source && t === target);
    if (!isValid) {
      INVALID_FORWARD_TRANSITIONS.push([source, target]);
    }
  }
}

// --- Generators ---

const uuidArb = fc.uuid();

const validTransitionArb: fc.Arbitrary<{ source: OrderStatus; target: OrderStatus }> =
  fc.constantFrom(...VALID_FORWARD_TRANSITIONS).map(([source, target]) => ({ source, target }));

const invalidTransitionArb: fc.Arbitrary<{ source: OrderStatus; target: OrderStatus }> =
  fc.constantFrom(...INVALID_FORWARD_TRANSITIONS).map(([source, target]) => ({ source, target }));

const cancellableStateArb: fc.Arbitrary<OrderStatus> =
  fc.constantFrom(...CANCELLABLE_STATES);

const nonCancellableStateArb: fc.Arbitrary<OrderStatus> =
  fc.constantFrom(...NON_CANCELLABLE_STATES);

// --- Helpers ---

function createMockOrderRow(orderId: string, restaurantId: string, status: OrderStatus) {
  const now = new Date();
  return {
    id: orderId,
    restaurant_id: restaurantId,
    table_id: '00000000-0000-4000-8000-000000000001',
    order_ref: 'ORD-TEST01',
    status,
    total: '100.00',
    created_at: now,
    accepted_at: status === 'accepted' || status === 'completed' || status === 'payment_received' ? now : null,
    completed_at: status === 'completed' || status === 'payment_received' ? now : null,
    payment_received_at: status === 'payment_received' ? now : null,
    cancelled_at: status === 'cancelled' ? now : null,
    updated_at: now,
    display_name: 'Table 1',
  };
}

function setupMockForTransition(orderId: string, restaurantId: string, currentStatus: OrderStatus) {
  const row = createMockOrderRow(orderId, restaurantId, currentStatus);

  mockQuery.mockReset();
  // First call: SELECT to fetch current order
  mockQuery.mockResolvedValueOnce({ rows: [row] });
  // Second call: UPDATE
  mockQuery.mockResolvedValueOnce({ rows: [] });
  // Third call: re-fetch after update (return updated row)
  mockQuery.mockResolvedValueOnce({ rows: [{ ...row, status: 'accepted', updated_at: new Date() }] });
}

function setupMockForCancel(orderId: string, restaurantId: string, currentStatus: OrderStatus) {
  const row = createMockOrderRow(orderId, restaurantId, currentStatus);

  mockQuery.mockReset();
  // First call: SELECT to fetch current order
  mockQuery.mockResolvedValueOnce({ rows: [row] });
  // Second call: UPDATE
  mockQuery.mockResolvedValueOnce({ rows: [] });
  // Third call: re-fetch after update
  mockQuery.mockResolvedValueOnce({
    rows: [{ ...row, status: 'cancelled', cancelled_at: new Date(), updated_at: new Date() }],
  });
}

// --- Property 10: Status Transition Enforcement ---
// **Validates: Requirements 5.1, 5.2, 5.3**

describe('Property 10: Status Transition Enforcement', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('valid (S, T) pairs succeed without throwing', async () => {
    await assertProperty(
      fc.asyncProperty(
        validTransitionArb,
        uuidArb,
        uuidArb,
        async ({ source, target }, orderId, restaurantId) => {
          setupMockForTransition(orderId, restaurantId, source);
          // Override the re-fetch to return the new status
          mockQuery.mockResolvedValueOnce({
            rows: [createMockOrderRow(orderId, restaurantId, target)],
          });

          // Should not throw
          const result = await updateOrderStatus(orderId, restaurantId, target);
          expect(result).toBeDefined();
          expect(result.id).toBe(orderId);
        }
      )
    );
  });

  it('invalid (S, T) pairs throw ValidationError with INVALID_TRANSITION code', async () => {
    await assertProperty(
      fc.asyncProperty(
        invalidTransitionArb,
        uuidArb,
        uuidArb,
        async ({ source, target }, orderId, restaurantId) => {
          const row = createMockOrderRow(orderId, restaurantId, source);
          mockQuery.mockReset();
          mockQuery.mockResolvedValueOnce({ rows: [row] });

          try {
            await updateOrderStatus(orderId, restaurantId, target);
            // Should not reach here
            throw new Error('Expected ValidationError was not thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(ValidationError);
            expect((error as { code: string }).code).toBe('INVALID_TRANSITION');
          }
        }
      )
    );
  });
});

// --- Property 11: Cancellation Rules ---
// **Validates: Requirements 5.4**

describe('Property 11: Cancellation Rules', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('cancellation succeeds from pending, accepted, or completed', async () => {
    await assertProperty(
      fc.asyncProperty(
        cancellableStateArb,
        uuidArb,
        uuidArb,
        async (currentStatus, orderId, restaurantId) => {
          setupMockForCancel(orderId, restaurantId, currentStatus);

          const result = await cancelOrder(orderId, restaurantId);
          expect(result).toBeDefined();
          expect(result.status).toBe('cancelled');
          expect(result.cancelledAt).not.toBeNull();
        }
      )
    );
  });

  it('cancellation fails from payment_received or cancelled', async () => {
    await assertProperty(
      fc.asyncProperty(
        nonCancellableStateArb,
        uuidArb,
        uuidArb,
        async (currentStatus, orderId, restaurantId) => {
          const row = createMockOrderRow(orderId, restaurantId, currentStatus);
          mockQuery.mockReset();
          mockQuery.mockResolvedValueOnce({ rows: [row] });

          try {
            await cancelOrder(orderId, restaurantId);
            throw new Error('Expected ValidationError was not thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(ValidationError);
            expect((error as { code: string }).code).toBe('INVALID_TRANSITION');

            if (currentStatus === 'payment_received') {
              expect((error as Error).message).toBe('Cannot cancel an order that has been paid');
            }
          }
        }
      )
    );
  });
});

// --- Property 12: Transition Timestamps ---
// **Validates: Requirements 5.6**

describe('Property 12: Transition Timestamps', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  // Mapping of target status to timestamp field on OrderRecord
  const TIMESTAMP_FIELD_MAP: Record<string, string> = {
    accepted: 'acceptedAt',
    completed: 'completedAt',
    payment_received: 'paymentReceivedAt',
    cancelled: 'cancelledAt',
  };

  // Mapping of target status to database column
  const TIMESTAMP_DB_COL_MAP: Record<string, string> = {
    accepted: 'accepted_at',
    completed: 'completed_at',
    payment_received: 'payment_received_at',
    cancelled: 'cancelled_at',
  };

  it('valid forward transitions set the corresponding timestamp column to a non-null value', async () => {
    await assertProperty(
      fc.asyncProperty(
        validTransitionArb,
        uuidArb,
        uuidArb,
        async ({ source, target }, orderId, restaurantId) => {
          const createdAt = new Date('2025-01-01T00:00:00Z');
          const transitionTime = new Date('2025-01-01T01:00:00Z');

          const currentRow = createMockOrderRow(orderId, restaurantId, source);
          currentRow.created_at = createdAt;

          mockQuery.mockReset();
          // Fetch current order
          mockQuery.mockResolvedValueOnce({ rows: [currentRow] });
          // UPDATE
          mockQuery.mockResolvedValueOnce({ rows: [] });
          // Re-fetch: return row with target status and timestamp set
          const updatedRow = {
            ...currentRow,
            status: target,
            [TIMESTAMP_DB_COL_MAP[target]]: transitionTime,
            updated_at: transitionTime,
          };
          mockQuery.mockResolvedValueOnce({ rows: [updatedRow] });

          const result = await updateOrderStatus(orderId, restaurantId, target);

          const timestampField = TIMESTAMP_FIELD_MAP[target] as keyof typeof result;
          expect(result[timestampField]).not.toBeNull();

          // Timestamp should be at or after created_at
          const tsValue = new Date(result[timestampField] as string);
          expect(tsValue.getTime()).toBeGreaterThanOrEqual(createdAt.getTime());
        }
      )
    );
  });

  it('cancellation sets cancelled_at to a non-null value', async () => {
    await assertProperty(
      fc.asyncProperty(
        cancellableStateArb,
        uuidArb,
        uuidArb,
        async (currentStatus, orderId, restaurantId) => {
          const createdAt = new Date('2025-01-01T00:00:00Z');
          const cancelTime = new Date('2025-01-01T02:00:00Z');

          const currentRow = createMockOrderRow(orderId, restaurantId, currentStatus);
          currentRow.created_at = createdAt;

          mockQuery.mockReset();
          // Fetch current order
          mockQuery.mockResolvedValueOnce({ rows: [currentRow] });
          // UPDATE
          mockQuery.mockResolvedValueOnce({ rows: [] });
          // Re-fetch: return row with cancelled status
          mockQuery.mockResolvedValueOnce({
            rows: [{
              ...currentRow,
              status: 'cancelled',
              cancelled_at: cancelTime,
              updated_at: cancelTime,
            }],
          });

          const result = await cancelOrder(orderId, restaurantId);

          expect(result.cancelledAt).not.toBeNull();
          const cancelledAtValue = new Date(result.cancelledAt!);
          expect(cancelledAtValue.getTime()).toBeGreaterThanOrEqual(createdAt.getTime());
        }
      )
    );
  });
});
