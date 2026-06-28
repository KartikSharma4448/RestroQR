import pool from '../config/database';

/**
 * Monthly summary result for a restaurant's earnings.
 * Only includes orders with status 'payment_received'.
 */
export interface MonthlySummary {
  totalOrders: number;
  totalRevenue: string;
}

/**
 * A single breakdown entry (daily, weekly, or monthly).
 */
export interface BreakdownEntry {
  date: string;
  totalOrders: number;
  totalRevenue: string;
}

/**
 * Paginated order history result.
 */
export interface OrderHistoryResult {
  orders: OrderHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrderHistoryItem {
  id: string;
  orderRef: string;
  status: string;
  total: string;
  tableDisplayName: string;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  paymentReceivedAt: string | null;
  cancelledAt: string | null;
}

/**
 * Per-item analytics entry.
 */
export interface ItemAnalyticsEntry {
  itemName: string;
  totalQuantity: number;
  totalRevenue: string;
}

export interface ItemAnalyticsResult {
  items: ItemAnalyticsEntry[];
}

/**
 * Returns the monthly earnings summary for a restaurant.
 * Only counts orders with status 'payment_received' within the given month.
 *
 * @param restaurantId - The restaurant UUID
 * @param month - Month in "YYYY-MM" format (e.g., "2025-01")
 */
export async function getMonthlySummary(
  restaurantId: string,
  month: string
): Promise<MonthlySummary> {
  const { startDate, endDate } = getMonthRange(month);

  const result = await pool.query(
    `SELECT
       COUNT(*)::int AS total_orders,
       COALESCE(SUM(total), 0)::text AS total_revenue
     FROM orders
     WHERE restaurant_id = $1
       AND status = 'payment_received'
       AND created_at >= $2
       AND created_at < $3`,
    [restaurantId, startDate, endDate]
  );

  const row = result.rows[0];
  return {
    totalOrders: row.total_orders,
    totalRevenue: row.total_revenue,
  };
}

/**
 * Returns earnings breakdown by period (daily, weekly, or monthly) for a given month.
 * Only includes orders with status 'payment_received'.
 *
 * @param restaurantId - The restaurant UUID
 * @param period - 'daily' | 'weekly' | 'monthly'
 * @param month - Month in "YYYY-MM" format (e.g., "2025-01")
 */
export async function getEarningsBreakdown(
  restaurantId: string,
  period: 'daily' | 'weekly' | 'monthly',
  month: string
): Promise<BreakdownEntry[]> {
  const { startDate, endDate } = getMonthRange(month);

  let dateExpression: string;
  switch (period) {
    case 'daily':
      dateExpression = `TO_CHAR(created_at, 'YYYY-MM-DD')`;
      break;
    case 'weekly':
      // Use the Monday of the ISO week
      dateExpression = `TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD')`;
      break;
    case 'monthly':
      dateExpression = `TO_CHAR(created_at, 'YYYY-MM')`;
      break;
  }

  const result = await pool.query(
    `SELECT
       ${dateExpression} AS date,
       COUNT(*)::int AS total_orders,
       COALESCE(SUM(total), 0)::text AS total_revenue
     FROM orders
     WHERE restaurant_id = $1
       AND status = 'payment_received'
       AND created_at >= $2
       AND created_at < $3
     GROUP BY ${dateExpression}
     ORDER BY date ASC`,
    [restaurantId, startDate, endDate]
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    date: row.date as string,
    totalOrders: row.total_orders as number,
    totalRevenue: row.total_revenue as string,
  }));
}

/**
 * Returns paginated order history for a restaurant with optional status filter.
 *
 * @param restaurantId - The restaurant UUID
 * @param options - Pagination and filter options
 */
export async function getOrderHistory(
  restaurantId: string,
  options: { page?: number; pageSize?: number; status?: string }
): Promise<OrderHistoryResult> {
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : 20;
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
    `SELECT COUNT(*)::int AS total FROM orders o ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  // Get paginated orders
  const orderParams = [...params, pageSize, offset];
  const ordersResult = await pool.query(
    `SELECT
       o.id,
       o.order_ref,
       o.status,
       o.total::text AS total,
       t.display_name AS table_display_name,
       o.created_at,
       o.accepted_at,
       o.completed_at,
       o.payment_received_at,
       o.cancelled_at
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     ${whereClause}
     ORDER BY o.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    orderParams
  );

  const orders: OrderHistoryItem[] = ordersResult.rows.map(
    (row: Record<string, unknown>) => ({
      id: row.id as string,
      orderRef: row.order_ref as string,
      status: row.status as string,
      total: row.total as string,
      tableDisplayName: (row.table_display_name as string) || 'Unknown',
      createdAt: (row.created_at as Date).toISOString(),
      acceptedAt: row.accepted_at ? (row.accepted_at as Date).toISOString() : null,
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
      paymentReceivedAt: row.payment_received_at
        ? (row.payment_received_at as Date).toISOString()
        : null,
      cancelledAt: row.cancelled_at ? (row.cancelled_at as Date).toISOString() : null,
    })
  );

  return {
    orders,
    total,
    page,
    pageSize,
  };
}

/**
 * Returns per-item analytics (quantity sold and revenue) for a restaurant.
 * Only includes items from orders with status 'payment_received'.
 *
 * @param restaurantId - The restaurant UUID
 * @param period - 'daily' | 'weekly' | 'monthly' (used with month to define the time range)
 * @param month - Month in "YYYY-MM" format (e.g., "2025-01")
 */
export async function getItemAnalytics(
  restaurantId: string,
  _period: 'daily' | 'weekly' | 'monthly',
  month: string
): Promise<ItemAnalyticsResult> {
  const { startDate, endDate } = getMonthRange(month);

  const result = await pool.query(
    `SELECT
       oi.item_name,
       SUM(oi.quantity)::int AS total_quantity,
       SUM(oi.item_price * oi.quantity)::text AS total_revenue
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.restaurant_id = $1
       AND o.status = 'payment_received'
       AND o.created_at >= $2
       AND o.created_at < $3
     GROUP BY oi.item_name
     ORDER BY total_quantity DESC`,
    [restaurantId, startDate, endDate]
  );

  const items: ItemAnalyticsEntry[] = result.rows.map(
    (row: Record<string, unknown>) => ({
      itemName: row.item_name as string,
      totalQuantity: row.total_quantity as number,
      totalRevenue: row.total_revenue as string,
    })
  );

  return { items };
}

/**
 * Helper: Parses a "YYYY-MM" month string into start and end date boundaries.
 * Returns the first day of the month and the first day of the next month.
 */
function getMonthRange(month: string): { startDate: string; endDate: string } {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);

  const startDate = new Date(Date.UTC(year, monthNum - 1, 1)).toISOString();

  // First day of next month
  const endDate = new Date(Date.UTC(year, monthNum, 1)).toISOString();

  return { startDate, endDate };
}
