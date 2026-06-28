// Feature: restroqr-v2-ordering-system, Property 13: Notification Payload Completeness

import { fc, assertProperty } from '../helpers/fast-check';
import { buildOrderNotificationPayload } from '../../services/notificationService';

// --- Generators ---

/** Arbitrary non-empty table display name (e.g. "Table 5", "Patio 2") */
const tableNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s: string) => s.trim().length > 0);

/** Arbitrary order total as a decimal string (e.g. "450.00", "1200.50") */
const orderTotalArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 1, max: 99999 }),
    fc.integer({ min: 0, max: 99 })
  )
  .map(([whole, decimal]) => `${whole}.${decimal.toString().padStart(2, '0')}`);

// --- Property 13: Notification Payload Completeness ---
// **Validates: Requirements 7.3**

describe('Property 13: Notification Payload Completeness', () => {
  it('should include the table display name in the notification payload', () => {
    assertProperty(
      fc.property(
        tableNameArb,
        orderTotalArb,
        (tableName: string, orderTotal: string) => {
          const payload = buildOrderNotificationPayload(tableName, orderTotal);

          // The data field must contain the table name
          expect(payload.data.tableName).toBe(tableName);

          // The body must also reference the table name
          expect(payload.body).toContain(tableName);
        }
      )
    );
  });

  it('should include the order total in the notification payload', () => {
    assertProperty(
      fc.property(
        tableNameArb,
        orderTotalArb,
        (tableName: string, orderTotal: string) => {
          const payload = buildOrderNotificationPayload(tableName, orderTotal);

          // The data field must contain the order total
          expect(payload.data.orderTotal).toBe(orderTotal);

          // The body must also reference the order total
          expect(payload.body).toContain(orderTotal);
        }
      )
    );
  });

  it('should contain both table display name and order total in a single payload', () => {
    assertProperty(
      fc.property(
        tableNameArb,
        orderTotalArb,
        (tableName: string, orderTotal: string) => {
          const payload = buildOrderNotificationPayload(tableName, orderTotal);

          // Payload structure must be complete
          expect(payload).toHaveProperty('title');
          expect(payload).toHaveProperty('body');
          expect(payload).toHaveProperty('data');
          expect(payload.data).toHaveProperty('tableName', tableName);
          expect(payload.data).toHaveProperty('orderTotal', orderTotal);

          // Both values must appear in the body string
          expect(payload.body).toContain(tableName);
          expect(payload.body).toContain(orderTotal);

          // Title must be a non-empty string
          expect(payload.title.length).toBeGreaterThan(0);
        }
      )
    );
  });
});
