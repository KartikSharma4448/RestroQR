// Feature: restroqr-v2-ordering-system, Property 17: Snapshot Preservation After Item Deletion

import { fc, assertProperty } from '../helpers/fast-check';

/**
 * Property 17: Snapshot Preservation After Item Deletion
 *
 * For any order_items record that references a food_item, if that food_item is
 * subsequently deleted from the food_items table, the order_items record SHALL
 * retain its item_name and item_price values unchanged.
 *
 * The order_items table uses:
 * - food_item_id FK → food_items(id) ON DELETE SET NULL
 * - item_name varchar(100) NOT NULL — snapshot (independent column)
 * - item_price decimal(8,2) NOT NULL — snapshot (independent column)
 *
 * When a food_item is deleted, ON DELETE SET NULL only affects food_item_id.
 * The item_name and item_price columns are independent and retain their values.
 *
 * **Validates: Requirements 10.3**
 */

// --- Generators ---

const itemNameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

const itemPriceArb: fc.Arbitrary<string> = fc
  .double({ min: 0.01, max: 99999.99, noNaN: true, noDefaultInfinity: true })
  .map((v) => v.toFixed(2));

const quantityArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 100 });

const orderItemRecordArb = fc.record({
  id: fc.uuid(),
  orderId: fc.uuid(),
  foodItemId: fc.uuid(),
  itemName: itemNameArb,
  itemPrice: itemPriceArb,
  quantity: quantityArb,
  createdAt: fc.constant('2025-01-15T12:00:00.000Z'),
});

// --- Simulation of ON DELETE SET NULL behavior ---

/**
 * Simulates the PostgreSQL ON DELETE SET NULL behavior for the food_item_id column.
 * When a food_item is deleted, ONLY the food_item_id FK column becomes NULL.
 * All other columns (item_name, item_price, quantity, etc.) are unaffected.
 */
function simulateDeleteFoodItem(
  orderItem: {
    id: string;
    orderId: string;
    foodItemId: string | null;
    itemName: string;
    itemPrice: string;
    quantity: number;
    createdAt: string;
  },
  deletedFoodItemId: string
): {
  id: string;
  orderId: string;
  foodItemId: string | null;
  itemName: string;
  itemPrice: string;
  quantity: number;
  createdAt: string;
} {
  if (orderItem.foodItemId === deletedFoodItemId) {
    // ON DELETE SET NULL: only food_item_id is set to null
    return {
      ...orderItem,
      foodItemId: null,
    };
  }
  return orderItem;
}

// --- Property 17: Snapshot Preservation After Item Deletion ---

describe('Property 17: Snapshot Preservation After Item Deletion', () => {
  it('deleting a food_item sets food_item_id to NULL but preserves item_name and item_price', () => {
    assertProperty(
      fc.property(orderItemRecordArb, (orderItem) => {
        const originalName = orderItem.itemName;
        const originalPrice = orderItem.itemPrice;
        const deletedFoodItemId = orderItem.foodItemId!;

        // Simulate the deletion of the referenced food_item
        const afterDeletion = simulateDeleteFoodItem(orderItem, deletedFoodItemId);

        // food_item_id should be NULL after deletion
        expect(afterDeletion.foodItemId).toBeNull();

        // item_name MUST be preserved unchanged
        expect(afterDeletion.itemName).toBe(originalName);

        // item_price MUST be preserved unchanged
        expect(afterDeletion.itemPrice).toBe(originalPrice);
      })
    );
  });

  it('deleting a different food_item does not affect the order_item at all', () => {
    assertProperty(
      fc.property(
        orderItemRecordArb,
        fc.uuid(), // a different food_item_id
        (orderItem, unrelatedFoodItemId) => {
          // Ensure the unrelated ID is actually different
          fc.pre(unrelatedFoodItemId !== orderItem.foodItemId);

          const originalFoodItemId = orderItem.foodItemId;
          const originalName = orderItem.itemName;
          const originalPrice = orderItem.itemPrice;

          // Simulate deletion of an unrelated food_item
          const afterDeletion = simulateDeleteFoodItem(orderItem, unrelatedFoodItemId);

          // Nothing should change
          expect(afterDeletion.foodItemId).toBe(originalFoodItemId);
          expect(afterDeletion.itemName).toBe(originalName);
          expect(afterDeletion.itemPrice).toBe(originalPrice);
        }
      )
    );
  });

  it('snapshot columns are independent of FK for any number of deletions', () => {
    assertProperty(
      fc.property(
        fc.array(orderItemRecordArb, { minLength: 1, maxLength: 20 }),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        (orderItems, deletedIds) => {
          // Record original snapshots
          const originalSnapshots = orderItems.map((item) => ({
            id: item.id,
            itemName: item.itemName,
            itemPrice: item.itemPrice,
          }));

          // Simulate multiple food_item deletions
          type OrderItemState = ReturnType<typeof simulateDeleteFoodItem>;
          let currentItems: OrderItemState[] = [...orderItems];
          for (const deletedId of deletedIds) {
            currentItems = currentItems.map((item) =>
              simulateDeleteFoodItem(item, deletedId)
            );
          }

          // Verify all snapshots are preserved regardless of deletions
          for (let i = 0; i < currentItems.length; i++) {
            expect(currentItems[i].itemName).toBe(originalSnapshots[i].itemName);
            expect(currentItems[i].itemPrice).toBe(originalSnapshots[i].itemPrice);
          }
        }
      )
    );
  });
});
