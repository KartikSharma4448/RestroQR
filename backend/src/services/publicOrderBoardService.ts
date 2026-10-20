import pool from '../config/database';
import { NotFoundError } from '../errors';

export async function getPublicOrderBoard(token: string) {
  if (!/^[A-Za-z0-9]{8,128}$/.test(token)) throw new NotFoundError('Order board not found');
  const restaurant = await pool.query(
    `SELECT r.id FROM restaurants r JOIN owners o ON o.id = r.owner_id
     WHERE r.restaurant_token = $1 AND r.status = 'active' AND o.status = 'active'`, [token]);
  if (!restaurant.rows.length) throw new NotFoundError('Order board not found');
  const result = await pool.query(
    `SELECT o.order_ref, o.status, o.customer_name, t.display_name AS table_name
     FROM orders o JOIN tables t ON t.id = o.table_id AND t.restaurant_id = o.restaurant_id
     WHERE o.restaurant_id = $1 AND o.created_at >= NOW() - INTERVAL '24 hours'
       AND (o.status IN ('pending', 'accepted', 'completed')
         OR o.updated_at >= NOW() - INTERVAL '30 minutes')
     ORDER BY o.created_at DESC LIMIT 100`, [restaurant.rows[0].id]);
  return result.rows.map(row => ({
    orderRef: row.order_ref, tableName: row.table_name, status: row.status,
    customerName: typeof row.customer_name === 'string' && row.customer_name.trim()
      ? row.customer_name.trim().split(/\s+/).slice(0, 3).map((part: string) => `${Array.from(part)[0]}.`).join(' ')
      : 'Guest',
  }));
}
