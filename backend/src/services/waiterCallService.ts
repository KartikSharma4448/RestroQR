import { randomUUID } from 'crypto';
import pool from '../config/database';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../errors';
import { decryptTableToken } from './tableService';

export const waiterCallingEnabled = () => process.env.WAITER_CALLING_ENABLED === 'true';
function enabled() {
  if (!waiterCallingEnabled()) throw new AppError('Waiter calling is not available',503,'WAITER_CALLING_UNAVAILABLE');
}
function tableIdentity(input: unknown) {
  enabled();
  if (typeof input !== 'string' || input.length>1024 || !/^[A-Za-z0-9_-]+$/.test(input)) throw new NotFoundError('Table not found');
  return decryptTableToken(input);
}
const tableSql = `SELECT t.id,t.restaurant_id,t.display_name FROM tables t
  JOIN restaurants r ON r.id=t.restaurant_id JOIN owners o ON o.id=r.owner_id
  WHERE t.id=$1 AND t.restaurant_id=$2 AND t.table_token=$3
  AND r.status='active' AND o.status='active' AND r.qr_mode='multi'`;
interface CallRow { id:string; status:string; created_at:Date; updated_at:Date; display_name?:string }
function map(row: CallRow) {
  return { id: row.id, status: row.status, createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(), ...(row.display_name ? { tableName: row.display_name } : {}) };
}
export async function getTableWaiterCall(token: unknown) {
  const identity=tableIdentity(token);
  const table=(await pool.query(tableSql,[identity.tableId,identity.restaurantId,token])).rows[0];
  if (!table) throw new NotFoundError('Table not found');
  const row=(await pool.query('SELECT * FROM waiter_calls WHERE table_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[table.id])).rows[0];
  return row ? map(row) : null;
}
export async function callWaiter(token: unknown) {
  const identity=tableIdentity(token);
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const table=(await client.query(tableSql+' FOR UPDATE OF t',[identity.tableId,identity.restaurantId,token])).rows[0];
    if (!table) throw new NotFoundError('Table not found');
    const prior=(await client.query('SELECT * FROM waiter_calls WHERE table_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[table.id])).rows[0];
    if (prior && prior.status!=='resolved') {
      await client.query('COMMIT');
      return { call: map(prior), replayed: true, restaurantId: table.restaurant_id, tableName: table.display_name };
    }
    if (prior && Date.now()-new Date(prior.updated_at).getTime()<60000) throw new AppError('Please wait one minute before calling again',429,'WAITER_CALL_COOLDOWN');
    const row=(await client.query('INSERT INTO waiter_calls(id,restaurant_id,table_id) VALUES ($1,$2,$3) RETURNING *',[randomUUID(),table.restaurant_id,table.id])).rows[0];
    await client.query('COMMIT');
    return { call: map(row), replayed: false, restaurantId: table.restaurant_id, tableName: table.display_name };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function getOwnerWaiterCalls(restaurantId: string) {
  enabled();
  const rows=(await pool.query(`SELECT w.*,t.display_name FROM waiter_calls w JOIN tables t ON t.id=w.table_id
    WHERE w.restaurant_id=$1 AND w.status IN ('pending','acknowledged') ORDER BY w.created_at,w.id LIMIT 100`,[restaurantId])).rows;
  return rows.map(map);
}
export async function updateWaiterCall(id: string,restaurantId: string,status: unknown) {
  enabled();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new NotFoundError('Waiter call not found');
  if (status!=='acknowledged' && status!=='resolved') throw new ValidationError('Choose acknowledged or resolved');
  const row=(await pool.query('SELECT * FROM waiter_calls WHERE id=$1 AND restaurant_id=$2',[id,restaurantId])).rows[0];
  if (!row) throw new NotFoundError('Waiter call not found');
  if (row.status===status) return map(row);
  if ((status==='acknowledged' && row.status!=='pending') || (status==='resolved' && !['pending','acknowledged'].includes(row.status))) throw new ConflictError('Waiter request changed. Refresh and try again.');
  const result=await pool.query(`UPDATE waiter_calls SET status=$3,updated_at=NOW()
    WHERE id=$1 AND restaurant_id=$2 AND status=$4 RETURNING *`,[id,restaurantId,status,row.status]);
  if (!result.rowCount) throw new ConflictError('Waiter request changed. Refresh and try again.');
  return map(result.rows[0]);
}
