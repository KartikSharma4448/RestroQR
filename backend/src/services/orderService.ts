import crypto from 'crypto';
import { loyaltyEnabled, reviewsEnabled, recordPaidEngagement } from './customerEngagementService';
import { orderPaymentsEnabled } from './orderPaymentService';
import pool from '../config/database';
import { ValidationError, NotFoundError, ConflictError } from '../errors';
import { decryptTableToken } from './tableService';
import { getRestaurantOrderingState, profileActivationEnabled } from './restaurantProfileService';
import { menuOptionsEnabled, validateOptionSelections, priceLockedSelections, optionSummary, type OptionSnapshot } from './menuOptionsService';
import { customerEmailOrderingEnabled, validateCustomerEmail, validateOrderRequestId, orderFingerprint,
  checkCustomerEmailLimit, queueOrderConfirmation, paymentReceiptEmailEnabled, queuePaymentReceipt,
  orderLifecycleEmailEnabled, queueOrderStatusEmail } from './customerOrderEmailService';

// --- Types ---

export type OrderStatus = 'pending' | 'accepted' | 'completed' | 'payment_received' | 'cancelled';

export interface OrderItemInput {
  itemId: string;
  quantity: number;
  variantId?: string;
  addOnIds?: string[];
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  foodItemId: string | null;
  itemName: string;
  itemPrice: string;
  quantity: number;
  createdAt: string;
  selectedOptions?: OptionSnapshot | null;
  optionSummary?: string;
}

export interface OrderRecord {
  paymentSummary?: { choice: string; transactionId: string | null } | null;
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
  customerName?: string | null;
  customerPhone?: string | null;
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
    ...(row.payment_summary !== undefined ? { paymentSummary: row.payment_summary as OrderRecord['paymentSummary'] } : {}),
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
    customerName: row.customer_name as string | null | undefined,
    customerPhone: row.customer_phone as string | null | undefined,
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
    ...(row.selected_options ? { selectedOptions: row.selected_options as OptionSnapshot,
      optionSummary: optionSummary(row.selected_options as OptionSnapshot) } : {}),
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
  items: OrderItemInput[],
  customerName?: string,
  customerPhone?: string,
  checkout?: { customerEmail: unknown; requestId: unknown }
): Promise<OrderRecord & { items: OrderItemRecord[]; replayed?: boolean }> {
  // Validate items array is not empty
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    throw new ValidationError('At least one item is required', [
      { field: 'items', message: 'Provide between 1 and 50 items' },
    ]);
  }

  // Validate quantities
  for (const item of items) {
    if (!item || typeof item !== 'object' || typeof item.itemId !== 'string' || !item.itemId.trim() ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
      throw new ValidationError('Validation failed', [
        { field: 'items', message: 'Each item needs an ID and integer quantity between 1 and 100' },
      ]);
    }
  }
  validateOptionSelections(items);
  if (menuOptionsEnabled()) items = items.map(item => ({ ...item, itemId: item.itemId.toLowerCase() }));

  if (customerName !== undefined && (typeof customerName !== 'string' || customerName.trim().length > 100)) {
    throw new ValidationError('Customer name must be a string of at most 100 characters');
  }
  if (customerPhone !== undefined && (typeof customerPhone !== 'string' || !/^\d{10}$/.test(customerPhone.trim()))) {
    throw new ValidationError('Phone must be exactly 10 digits');
  }
  const emailFlow = customerEmailOrderingEnabled();
  const email = emailFlow ? validateCustomerEmail(checkout?.customerEmail) : null;
  const requestId = emailFlow ? validateOrderRequestId(checkout?.requestId) : null;
  if (emailFlow) customerName = customerName?.trim() || 'Guest';

  // Decrypt table token — throws NotFoundError('Menu not found') on failure
  const { restaurantId, tableId } = decryptTableToken(tableToken);
  const fingerprint = emailFlow ? orderFingerprint({ restaurantId, tableId, email, name: customerName,
    phone: customerPhone?.trim() || null, items: items.map(item => ({ id: item.itemId.toLowerCase(),
      quantity: item.quantity, variantId: item.variantId?.toLowerCase() || null,
      addOnIds: [...(item.addOnIds || [])].map(id => id.toLowerCase()).sort() })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) }) : null;

  // Validate restaurant exists and qr_mode is 'multi'
  const restaurantResult = await pool.query(
    `SELECT r.id, r.qr_mode, r.status, o.status AS owner_status
     FROM restaurants r JOIN owners o ON o.id = r.owner_id WHERE r.id = $1`,
    [restaurantId]
  );
  if (restaurantResult.rows.length === 0 || restaurantResult.rows[0].qr_mode !== 'multi' ||
      restaurantResult.rows[0].status !== 'active' || restaurantResult.rows[0].owner_status !== 'active') {
    throw new NotFoundError('Menu not found');
  }
  if (requestId) {
    const prior = (await pool.query('SELECT * FROM orders WHERE client_request_id=$1', [requestId])).rows[0];
    if (prior) {
      if (prior.request_fingerprint !== fingerprint) throw new ConflictError('This checkout request was already used. Start a new checkout.');
      const savedItems = (await pool.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY created_at,id', [prior.id])).rows;
      return { ...mapOrderRow(prior), items: savedItems.map(mapOrderItemRow), replayed: true };
    }
  }

  // Validate table exists
  if (profileActivationEnabled() && !(await getRestaurantOrderingState(restaurantId)).orderingEnabled) {
    throw new ConflictError('This restaurant is not accepting new orders yet');
  }

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
  let totalCents = 0;
  for (const item of menuOptionsEnabled() ? [] : items) {
    const found = foundItems.get(item.itemId)!;
    const priceCents = Math.round(Number(found.price) * 100);
    if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
      throw new ValidationError('Item price is invalid');
    }
    totalCents += priceCents * item.quantity;
  }
  if (!Number.isSafeInteger(totalCents) || totalCents > 9999999999) {
    throw new ValidationError('Order total exceeds the supported limit');
  }
  let total = totalCents / 100;

  // Generate unique order_ref with retry logic
  let orderRef = generateOrderRef();
  let retries = 0;
  const maxRetries = 5;

  // Use a transaction for atomicity
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (email && requestId) {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('order-request:' || $1,0))", [requestId]);
      const prior = (await client.query('SELECT * FROM orders WHERE client_request_id=$1', [requestId])).rows[0];
      if (prior) {
        if (prior.request_fingerprint !== fingerprint) throw new ConflictError('This checkout request was already used. Start a new checkout.');
        const savedItems = (await client.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY created_at,id', [prior.id])).rows;
        await client.query('COMMIT');
        return { ...mapOrderRow(prior), items: savedItems.map(mapOrderItemRow), replayed: true };
      }
      await checkCustomerEmailLimit(client, email);
    }

    // Hold profile/account locks through order insertion so concurrent setup or
    // disable changes cannot slip between the activation check and commit.
    if (profileActivationEnabled() && !(await getRestaurantOrderingState(restaurantId, client, true)).orderingEnabled) {
      throw new ConflictError('This restaurant is not accepting new orders yet');
    }

    const configured = menuOptionsEnabled() ? await priceLockedSelections(client, restaurantId, items) : null;
    if (configured) {
      const cents = configured.reduce((sum, line, index) => sum + line.cents * items[index].quantity, 0);
      if (!Number.isSafeInteger(cents) || cents > 9999999999) throw new ValidationError('Order total exceeds the supported limit');
      total = cents / 100;
    }

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
      `INSERT INTO orders (restaurant_id, table_id, order_ref, status, total, customer_name, customer_phone${emailFlow ? ',customer_email,client_request_id,request_fingerprint' : ''})
       VALUES ($1, $2, $3, 'pending', $4, $5, $6${emailFlow ? ',$7,$8,$9' : ''})
       RETURNING id, restaurant_id, table_id, order_ref, status, total, created_at, accepted_at, completed_at, payment_received_at, cancelled_at, updated_at, customer_name, customer_phone`,
      [restaurantId, tableId, orderRef, total.toFixed(2), customerName || null, customerPhone || null,
        ...(emailFlow ? [email, requestId, fingerprint] : [])]
    );

    const order = mapOrderRow(orderResult.rows[0]);

    // Insert order_items with price snapshots
    const orderItems: OrderItemRecord[] = [];
    for (const [index, item] of items.entries()) {
      const found = foundItems.get(item.itemId)!;
      const line = configured?.[index];
      const itemResult = await client.query(
        `INSERT INTO order_items (order_id, food_item_id, item_name, item_price, quantity${line ? ', selected_options' : ''})
         VALUES ($1, $2, $3, $4, $5${line ? ', $6::jsonb' : ''})
         RETURNING id, order_id, food_item_id, item_name, item_price, quantity, created_at${line ? ', selected_options' : ''}`,
        [order.id, item.itemId, line?.name ?? found.name, line?.price ?? found.price, item.quantity,
          ...(line ? [JSON.stringify(line.snapshot)] : [])]
      );
      orderItems.push(mapOrderItemRow(itemResult.rows[0]));
    }

    if (email && !orderLifecycleEmailEnabled()) await queueOrderConfirmation(client, email, restaurantId, { ...order, items: orderItems });
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
            o.cancelled_at, o.updated_at, o.customer_name, o.customer_phone, t.display_name
            ${orderPaymentsEnabled() ? ", (SELECT json_build_object('choice',p.choice,'transactionId',p.transaction_id) FROM order_payment_choices p WHERE p.order_id=o.id) AS payment_summary" : ''}
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
      `SELECT id, order_id, food_item_id, item_name, item_price, quantity, created_at${menuOptionsEnabled() ? ', selected_options' : ''}
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
  if ((newStatus === 'payment_received' && (paymentReceiptEmailEnabled() || loyaltyEnabled() || reviewsEnabled())) ||
      (orderLifecycleEmailEnabled() && (newStatus === 'accepted' || newStatus === 'completed'))) {
    return updateOrderWithEmail(orderId, restaurantId, newStatus);
  }
  // Fetch current order
  const orderResult = await pool.query(
    `SELECT o.id, o.restaurant_id, o.table_id, o.order_ref, o.status, o.total,
            o.created_at, o.accepted_at, o.completed_at, o.payment_received_at,
            o.cancelled_at, o.updated_at, o.customer_name, o.customer_phone, t.display_name
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
  const transitionResult = await pool.query(
    `UPDATE orders SET status = $1, ${timestampCol} = NOW(), updated_at = NOW()
     WHERE id = $2 AND restaurant_id = $3 AND status = $4`,
    [newStatus, orderId, restaurantId, currentStatus]
  );
  if (transitionResult.rowCount === 0) {
    throw new ConflictError('Order status changed. Refresh and try again.');
  }

  // Re-fetch with table display name
  const updatedResult = await pool.query(
    `SELECT o.id, o.restaurant_id, o.table_id, o.order_ref, o.status, o.total,
            o.created_at, o.accepted_at, o.completed_at, o.payment_received_at,
            o.cancelled_at, o.updated_at, o.customer_name, o.customer_phone, t.display_name
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     WHERE o.id = $1 AND o.restaurant_id = $2`,
    [orderId, restaurantId]
  );

  return mapOrderRow(updatedResult.rows[0]);
}

async function updateOrderWithEmail(orderId: string, restaurantId: string, newStatus: OrderStatus): Promise<OrderRecord> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query(`SELECT o.*,t.display_name FROM orders o
      LEFT JOIN tables t ON o.table_id=t.id WHERE o.id=$1 AND o.restaurant_id=$2 FOR UPDATE OF o`,
    [orderId, restaurantId])).rows[0];
    if (!row) throw new NotFoundError('Order not found');
    // Repeated status confirmation is a no-op; only the first transaction queues email.
    if (row.status === newStatus) {
      await client.query('COMMIT');
      return mapOrderRow(row);
    }
    if (!(VALID_TRANSITIONS[row.status] || []).includes(newStatus)) {
      const error = new ValidationError(`Cannot transition from '${row.status}' to '${newStatus}'`);
      (error as unknown as { code: string }).code = 'INVALID_TRANSITION';
      throw error;
    }
    const paid = (await client.query(`UPDATE orders SET status=$3,${STATUS_TIMESTAMP_MAP[newStatus]}=NOW(),updated_at=NOW()
      WHERE id=$1 AND restaurant_id=$2 RETURNING *`, [orderId, restaurantId,newStatus])).rows[0];
    const receiptLines = newStatus === 'payment_received' && (loyaltyEnabled() || reviewsEnabled())
      ? await recordPaidEngagement(client,paid) : [];
    if (row.customer_email) {
      const items = (await client.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY created_at,id', [orderId])).rows;
      const snapshot = {
        id: row.id, orderRef: row.order_ref, total: row.total, customerName: row.customer_name,
        tableName: row.display_name, paidAt: paid.payment_received_at, items: items.map(mapOrderItemRow), receiptLines,
      };
      if (newStatus === 'payment_received') await queuePaymentReceipt(client,row.customer_email,restaurantId,snapshot);
      else await queueOrderStatusEmail(client,row.customer_email,restaurantId,snapshot,newStatus === 'accepted' ? 'order-accepted' : 'order-ready');
    }
    await client.query('COMMIT');
    return mapOrderRow({ ...paid, display_name: row.display_name });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
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
            o.cancelled_at, o.updated_at, o.customer_name, o.customer_phone, t.display_name
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
  const cancellationResult = await pool.query(
    `UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND restaurant_id = $2 AND status = $3`,
    [orderId, restaurantId, currentStatus]
  );
  if (cancellationResult.rowCount === 0) {
    throw new ConflictError('Order status changed. Refresh and try again.');
  }

  // Re-fetch with table display name
  const updatedResult = await pool.query(
    `SELECT o.id, o.restaurant_id, o.table_id, o.order_ref, o.status, o.total,
            o.created_at, o.accepted_at, o.completed_at, o.payment_received_at,
            o.cancelled_at, o.updated_at, o.customer_name, o.customer_phone, t.display_name
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     WHERE o.id = $1 AND o.restaurant_id = $2`,
    [orderId, restaurantId]
  );

  return mapOrderRow(updatedResult.rows[0]);
}
