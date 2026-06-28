import crypto from 'crypto';
import pool from '../config/database';
import { ValidationError, NotFoundError } from '../errors';
import { decryptTableToken } from './tableService';

// --- Types ---

export type OrderStatus = 'pending' | 'accepted' | 'completed' | 'payment_received' | 'cancelled';

export interface OrderItemInput {
  itemId: string;
  quantity: number;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  foodItemId: string | null;
  itemName: string;
  itemPrice: string;
  quantity: number;
  createdAt: string;
}

export interface OrderRecord {
  id: string;
  restaurantId: string;
  tableId: string;
  orderRef: string;
  status: OrderStatus;
  total: string;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  paymentReceivedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  items?: OrderItemRecord[];
  tableDisplayName?: string;
}

// --- Valid status transitions ---

const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending: ['accepted'],
  accepted: ['completed'],
  completed: ['payment_received'],
  payment_received: [],
  cancelled: [],
};

// States from which cancellation is allowed
const CANCELLABLE_STATES: OrderStatus[] = ['pending', 'accepted', 'completed'];

// Mapping of target status to the timestamp column that should be set
const STATUS_TIMESTAMP_MAP: Record<string, string> = {
  accepted: 'accepted_at',
  completed: 'completed_at',
  payment_received: 'payment_received_at',
  cancelled: 'cancelled_at',
};

// --- Helpers ---

/**
 * Generates a random order reference in the format "ORD-XXXXXX" (6 uppercase alphanumeric chars).
 */
function generateOrderRef(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(6);
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return `ORD-${result}`;
}

/**
 * Maps a database row to the OrderRecord interface.
 */
function mapOrderRow(row: Record<string, unknown>): OrderRecord {
  return {
    id: row.id as string,
    restaurantId: row.restaurant_id as string,
    tableId: row.table_id as string,
    orderRef: row.order_ref as string,
    status: row.status as OrderStatus,
    total: row.total as string,
    createdAt: (row.created_at as Date).toISOString(),
    acceptedAt: row.accepted_at ? (row.accepted_at as Date).toISOString() : null,
    completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
    paymentReceivedAt: row.payment_received_at ? (row.payment_received_at as Date).toISOString() : null,
    cancelledAt: row.cancelled_at ? (row.cancelled_at as Date).toISOString() : null,
    updatedAt: (row.updated_at as Date).toISOString(),
    tableDisplayName: row.display_name as string | undefined,
  };
}

/**
 * Maps a database row to the OrderItemRecord interface.
 */
function mapOrderItemRow(row: Record<string, unknown>): OrderItemRecord {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    foodItemId: (row.food_item_id as string) || null,
    itemName: row.item_name as string,
    itemPrice: row.item_price as string,
    quantity: row.quantity as number,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

// --- Service functions ---

/**
 * Creates a new order from a table token and list of items.
 * - Decrypts the table token to identify restaurant and table
 * - Validates restaurant qr_mode is 'multi'
 * - Validates all items belong to the restaurant and are available
 * - Calculates total server-side from current prices
 * - Inserts order + order_items with price snapshots
 * - Generates unique order_ref in format "ORD-XXXXXX"
 */
export async function createOrder(
  tableToken: string,
  items: OrderItemInput[]
): Promise<OrderRecord & { items: OrderItemRecord[] }> {
  // Validate items array is not empty
  if (!items || items.length === 0) {
    throw new ValidationError('At least one item is required', [
      { field: 'items', message: 'At least one item is required' },
    ]);
  }

  // Validate quantities
  for (const item of items) {
    if (!item.quantity || item.quantity < 1) {
      throw new ValidationError('Validation failed', [
        { field: 'quantity', message: 'Quantity must be at least 1' },
      ]);
    }
  }

  // Decrypt table token — throws NotFoundError('Menu not found') on failure
  const { restaurantId, tableId } = decryptTableToken(tableToken);

  // Validate restaurant exists and qr_mode is 'multi'
  const restaurantResult = await pool.query(
    'SELECT id, qr_mode FROM restaurants WHERE id = $1',
    [restaurantId]
  );
  if (restaurantResult.rows.length === 0 || restaurantResult.rows[0].qr_mode !== 'multi') {
    throw new NotFoundError('Menu not found');
  }

  // Validate table exists
  const tableResult = await pool.query(
    'SELECT id FROM tables WHERE id = $1 AND restaurant_id = $2',
    [tableId, restaurantId]
  );
  if (tableResult.rows.length === 0) {
    throw new NotFoundError('Menu not found');
  }

  // Fetch all requested item IDs from the database
  const itemIds = items.map((i) => i.itemId);
  const foodItemsResult = await pool.query(
    `SELECT id, name, price, is_available, restaurant_id
     FROM food_items
     WHERE id = ANY($1::uuid[])`,
    [itemIds]
  );

  const foundItems = new Map<string, { name: string; price: string; isAvailable: boolean; restaurantId: string }>();
  for (const row of foodItemsResult.rows) {
    foundItems.set(row.id, {
      name: row.name,
      price: row.price,
      isAvailable: row.is_available,
      restaurantId: row.restaurant_id,
    });
  }

  // Check for items not found or not belonging to the restaurant
  const notFoundIds: string[] = [];
  for (const itemId of itemIds) {
    const found = foundItems.get(itemId);
    if (!found || found.restaurantId !== restaurantId) {
      notFoundIds.push(itemId);
    }
  }
  if (notFoundIds.length > 0) {
    throw new ValidationError(`Items not found: ${notFoundIds.join(', ')}`, [
      { field: 'items', message: `Items not found: ${notFoundIds.join(', ')}` },
    ]);
  }

  // Check for unavailable items
  const unavailableItems: string[] = [];
  for (const item of items) {
    const found = foundItems.get(item.itemId)!;
    if (!found.isAvailable) {
      unavailableItems.push(found.name);
    }
  }
  if (unavailableItems.length > 0) {
    const error = new ValidationError(`Unavailable items: ${unavailableItems.join(', ')}`, [
      { field: 'items', message: `Unavailable items: ${unavailableItems.join(', ')}` },
    ]);
    // Override the code to ITEMS_UNAVAILABLE
    (error as unknown as { code: string }).code = 'ITEMS_UNAVAILABLE';
    throw error;
  }

  // Calculate total server-side
  let total = 0;
  for (const item of items) {
    const found = foundItems.get(item.itemId)!;
    total += parseFloat(found.price) * item.quantity;
  }

  // Generate unique order_ref with retry logic
  let orderRef = generateOrderRef();
  let retries = 0;
  const maxRetries = 5;

  // Use a transaction for atomicity
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure order_ref is unique
    while (retries < maxRetries) {
      const existing = await client.query(
        'SELECT id FROM orders WHERE order_ref = $1',
        [orderRef]
      );
      if (existing.rows.length === 0) break;
      orderRef = generateOrderRef();
      retries++;
    }

    // Insert order
    const orderResult = await client.query(
      `INSERT INTO orders (restaurant_id, table_id, order_ref, status, total)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING id, restaurant_id, table_id, order_ref, status, total, created_at, accepted_at, completed_at, payment_received_at, cancelled_at, updated_at`,
      [restaurantId, tableId, orderRef, total.toFixed(2)]
    );

    const order = mapOrderRow(orderResult.rows[0]);

    // Insert order_items with price snapshots
    const orderItems: OrderItemRecord[] = [];
    for (const item of items) {
      const found = foundItems.get(item.itemId)!;
      const itemResult = await client.query(
        `INSERT INTO order_items (order_id, food_item_id, item_name, item_price, quantity)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, order_id, food_item_id, item_name, item_price, quantity, created_at`,
        [order.id, item.itemId, found.name, found.price, item.quantity]
      );
      orderItems.push(mapOrderItemRow(itemResult.rows[0]));
    }

    await client.query('COMMIT');

    return { ...order, items: orderItems };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Retrieves paginated orders for a restaurant with optional status filter.
 * Orders are joined with table display names and sorted by creation time (newest first).
 */
export async function getOrders(
  restaurantId: string,
  options: { status?: OrderStatus; page?: number; pageSize?: number } = {}
): Promise<{ orders: OrderRecord[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize || 20));
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE o.restaurant_id = $1';
  const params: unknown[] = [restaurantId];
  let paramIndex = 2;

  if (options.status) {
    whereClause += ` AND o.status = $${paramIndex}`;
    params.push(options.status);
    paramIndex++;
  }

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated orders with table display names
  const ordersResult = await pool.query(
    `SELECT o.id, o.restaurant_id, o.table_id, o.order_ref, o.status, o.total,
            o.created_at, o.accepted_at, o.completed_at, o.payment_received_at,
            o.cancelled_at, o.updated_at, t.display_name
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     ${whereClause}
     ORDER BY o.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, pageSize, offset]
  );

  const orders = ordersResult.rows.map(mapOrderRow);

  // Fetch order items for each order
  if (orders.length > 0) {
    const orderIds = orders.map((o) => o.id);
    const itemsResult = await pool.query(
      `SELECT id, order_id, food_item_id, item_name, item_price, quantity, created_at
       FROM order_items
       WHERE order_id = ANY($1::uuid[])
       ORDER BY created_at ASC`,
      [orderIds]
    );

    const itemsByOrderId = new Map<string, OrderItemRecord[]>();
    for (const row of itemsResult.rows) {
      const item = mapOrderItemRow(row);
      if (!itemsByOrderId.has(item.orderId)) {
        itemsByOrderId.set(item.orderId, []);
      }
      itemsByOrderId.get(item.orderId)!.push(item);
    }

    for (const order of orders) {
      order.items = itemsByOrderId.get(order.id) || [];
    }
  }

  return { orders, total, page, pageSize };
}

/**
 * Updates an order's status, enforcing valid transitions per the state machine.
 * Valid transitions:
 * - pending → accepted
 * - accepted → completed
 * - completed → payment_received
 *
 * Sets the corresponding timestamp column on transition.
 */
export async function updateOrderStatus(
  orderId: string,
  restaurantId: string,
  newStatus: OrderStatus
): Promise<OrderRecord> {
  // Fetch current order
  const orderResult = await pool.query(
    `SELECT o.id, o.restaurant_id, o.table_id, o.order_ref, o.status, o.total,
            o.created_at, o.accepted_at, o.completed_at, o.payment_received_at,
            o.cancelled_at, o.updated_at, t.display_name
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     WHERE o.id = $1 AND o.restaurant_id = $2`,
    [orderId, restaurantId]
  );

  if (orderResult.rows.length === 0) {
    throw new NotFoundError('Order not found');
  }

  const currentStatus = orderResult.rows[0].status as OrderStatus;

  // Validate transition
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowedTransitions.includes(newStatus)) {
    const error = new ValidationError(
      `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: [${allowedTransitions.join(', ')}]`,
      [{ field: 'status', message: `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: [${allowedTransitions.join(', ')}]` }]
    );
    (error as unknown as { code: string }).code = 'INVALID_TRANSITION';
    throw error;
  }

  // Set the corresponding timestamp column
  const timestampCol = STATUS_TIMESTAMP_MAP[newStatus];
  await pool.query(
    `UPDATE orders SET status = $1, ${timestampCol} = NOW(), updated_at = NOW()
     WHERE id = $2 AND restaurant_id = $3`,
    [newStatus, orderId, restaurantId]
  );

  // Re-fetch with table display name
  const updatedResult = await pool.query(
    `SELECT o.id, o.restaurant_id, o.table_id, o.order_ref, o.status, o.total,
            o.created_at, o.accepted_at, o.completed_at, o.payment_received_at,
            o.cancelled_at, o.updated_at, t.display_name
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     WHERE o.id = $1`,
    [orderId]
  );

  return mapOrderRow(updatedResult.rows[0]);
}

/**
 * Cancels an order.
 * Cancellation is allowed from: pending, accepted, completed.
 * Cancellation is rejected from: payment_received, cancelled.
 */
export async function cancelOrder(
  orderId: string,
  restaurantId: string
): Promise<OrderRecord> {
  // Fetch current order
  const orderResult = await pool.query(
    `SELECT o.id, o.restaurant_id, o.table_id, o.order_ref, o.status, o.total,
            o.created_at, o.accepted_at, o.completed_at, o.payment_received_at,
            o.cancelled_at, o.updated_at, t.display_name
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     WHERE o.id = $1 AND o.restaurant_id = $2`,
    [orderId, restaurantId]
  );

  if (orderResult.rows.length === 0) {
    throw new NotFoundError('Order not found');
  }

  const currentStatus = orderResult.rows[0].status as OrderStatus;

  // Validate cancellation is allowed
  if (!CANCELLABLE_STATES.includes(currentStatus)) {
    if (currentStatus === 'payment_received') {
      const error = new ValidationError(
        "Cannot cancel an order that has been paid",
        [{ field: 'status', message: "Cannot cancel an order that has been paid" }]
      );
      (error as unknown as { code: string }).code = 'INVALID_TRANSITION';
      throw error;
    }
    // Already cancelled
    const error = new ValidationError(
      `Cannot transition from '${currentStatus}' to 'cancelled'. Allowed: []`,
      [{ field: 'status', message: `Cannot transition from '${currentStatus}' to 'cancelled'. Allowed: []` }]
    );
    (error as unknown as { code: string }).code = 'INVALID_TRANSITION';
    throw error;
  }

  // Set status to cancelled with timestamp
  await pool.query(
    `UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND restaurant_id = $2`,
    [orderId, restaurantId]
  );

  // Re-fetch with table display name
  const updatedResult = await pool.query(
    `SELECT o.id, o.restaurant_id, o.table_id, o.order_ref, o.status, o.total,
            o.created_at, o.accepted_at, o.completed_at, o.payment_received_at,
            o.cancelled_at, o.updated_at, t.display_name
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     WHERE o.id = $1`,
    [orderId]
  );

  return mapOrderRow(updatedResult.rows[0]);
}
