import crypto from 'crypto';
import QRCode from 'qrcode';
import { v2 as cloudinary } from 'cloudinary';
import pool from '../config/database';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../errors';
import { customerEmailOrderingEnabled } from './customerOrderEmailService';
import { validateProfileImage } from './restaurantProfileService';
import type { UploadedFile } from './ownerRestaurantService';

export const orderPaymentsEnabled = () => customerEmailOrderingEnabled() && process.env.ORDER_PAYMENTS_ENABLED === 'true';
function enabled() {
  if (!orderPaymentsEnabled()) throw new AppError('Payment options are not enabled', 503, 'PAYMENTS_UNAVAILABLE');
}
function accessToken(id: string, requestId: string) {
  if (!process.env.JWT_SECRET) throw new AppError('Payment options are unavailable', 503, 'PAYMENTS_UNAVAILABLE');
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`order-payment-v1:${id}:${requestId}`).digest('hex');
}
export async function issueOrderPayment(orderId: string) {
  enabled();
  const row = (await pool.query(`SELECT o.id,o.client_request_id,r.id AS restaurant_id,r.name,r.business_upi_id
    FROM orders o JOIN restaurants r ON r.id=o.restaurant_id WHERE o.id=$1`, [orderId])).rows[0];
  if (!row?.client_request_id) throw new NotFoundError('Order payment not found');
  const upi = typeof row.business_upi_id === 'string' && /^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9.-]{1,}$/.test(row.business_upi_id)
    ? row.business_upi_id : null;
  await pool.query(`INSERT INTO order_payment_choices(order_id,restaurant_id,upi_id,payee_name)
    VALUES ($1,$2,$3,$4) ON CONFLICT (order_id) DO NOTHING`, [row.id,row.restaurant_id,upi,String(row.name).slice(0,100)]);
  return { orderId, token: accessToken(orderId,row.client_request_id) };
}

export async function authorizeOrderPayment(orderId: string, token: unknown) {
  enabled();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId) || typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) throw new NotFoundError('Order payment not found');
  const row = (await pool.query(`SELECT p.*,o.client_request_id,o.status,o.total,o.order_ref,r.status AS restaurant_status,
    owner.status AS owner_status FROM order_payment_choices p JOIN orders o ON o.id=p.order_id
    JOIN restaurants r ON r.id=p.restaurant_id JOIN owners owner ON owner.id=r.owner_id WHERE p.order_id=$1`, [orderId])).rows[0];
  if (!row || !crypto.timingSafeEqual(Buffer.from(token,'hex'),Buffer.from(accessToken(orderId,row.client_request_id),'hex')) ||
    new Date(row.expires_at).getTime() <= Date.now() || row.restaurant_status !== 'active' || row.owner_status !== 'active') throw new NotFoundError('Order payment not found');
  return row;
}

export async function getOrderPayment(orderId: string, token: unknown) {
  const row = await authorizeOrderPayment(orderId,token);
  const payable = !['cancelled','payment_received'].includes(row.status);
  const params = new URLSearchParams({ pa: row.upi_id || '', pn: row.payee_name, am: String(row.total), cu: 'INR', tn: row.order_ref, tr: row.order_id });
  const upiUrl = payable && row.upi_id ? `upi://pay?${params}` : null;
  return { orderRef: row.order_ref, total: row.total, payeeName: row.payee_name, upiId: row.upi_id,
    choice: row.choice, orderStatus: row.status, transactionId: row.transaction_id,
    upiUrl, qrDataUrl: upiUrl ? await QRCode.toDataURL(upiUrl,{ width: 256, margin: 2 }) : null };
}

export async function chooseCash(orderId: string, token: unknown) {
  await authorizeOrderPayment(orderId,token);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = (await client.query('SELECT status FROM orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
    if (!order || ['cancelled','payment_received'].includes(order.status)) throw new ConflictError('This order is closed');
    const result = await client.query(`UPDATE order_payment_choices SET choice='cash',updated_at=NOW()
      WHERE order_id=$1 AND choice IN ('unselected','cash') RETURNING order_id`,[orderId]);
    if (!result.rowCount) throw new ConflictError('Proof is already submitted. Contact the restaurant.');
    await client.query('COMMIT');
    return { choice: 'cash' };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

function configureStorage() {
  try {
    const url = new URL(process.env.CLOUDINARY_URL || '');
    if (url.protocol !== 'cloudinary:' || !url.username || !url.password || !url.hostname) throw new Error();
    cloudinary.config({ cloud_name: url.hostname, api_key: decodeURIComponent(url.username), api_secret: decodeURIComponent(url.password), secure: true });
  } catch { throw new AppError('Proof storage is unavailable',503,'PROOF_STORAGE_UNAVAILABLE'); }
}

export async function submitPaymentProof(orderId: string, token: unknown, transactionId: unknown, file?: UploadedFile) {
  const row = await authorizeOrderPayment(orderId,token);
  if (typeof transactionId !== 'string' || !/^[A-Za-z0-9]{8,64}$/.test(transactionId.trim())) throw new ValidationError('Enter a transaction ID of 8 to 64 letters or digits');
  const utr = transactionId.trim();
  if (['cancelled','payment_received'].includes(row.status)) throw new ConflictError('This order is closed');
  if (row.choice === 'upi_submitted') {
    if (row.transaction_id.toLowerCase() === utr.toLowerCase()) return { choice: 'upi_submitted' };
    throw new ConflictError('Proof is already submitted. Contact the restaurant for corrections.');
  }
  if (!row.upi_id) throw new ConflictError('Online payment is not available');
  if (!file) throw new ValidationError('Choose a payment screenshot');
  validateProfileImage(file);
  if (file.size > 2 * 1024 * 1024) throw new ValidationError('Choose a screenshot up to 2MB');
  configureStorage();
  // Reserve a bounded upload attempt before using external storage; failed uploads count too.
  const reserved = await pool.query(`UPDATE order_payment_choices p SET upload_attempts=upload_attempts+1
    FROM orders o WHERE p.order_id=$1 AND o.id=p.order_id AND p.choice<>'upi_submitted' AND p.upload_attempts<3
    AND o.status NOT IN ('cancelled','payment_received') RETURNING p.order_id`,[orderId]);
  if (!reserved.rowCount) throw new ConflictError('Proof upload limit reached or order closed. Contact the restaurant.');
  const publicId = await new Promise<string>((resolve,reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: `restroqr/${row.restaurant_id}/payment-proofs`,
      type: 'authenticated', resource_type: 'image', format: 'jpg', allowed_formats: ['jpg','jpeg','png','webp'], timeout: 30000,
      transformation: [{ width: 1600, height: 2000, crop: 'limit' }] },(error,result) => {
      if (error || !result?.public_id) reject(new AppError('Screenshot upload failed. Try again.',503,'PROOF_UPLOAD_FAILED'));
      else resolve(result.public_id);
    });
    stream.end(file.buffer);
  });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const order = (await client.query('SELECT status FROM orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
      if (!order || ['cancelled','payment_received'].includes(order.status)) throw new ConflictError('This order is closed');
      const saved = await client.query(`UPDATE order_payment_choices SET choice='upi_submitted',transaction_id=$2,
        proof_public_id=$3,updated_at=NOW() WHERE order_id=$1 AND choice<>'upi_submitted' RETURNING order_id`,[orderId,utr,publicId]);
      if (!saved.rowCount) throw new ConflictError('Payment details changed. Refresh before trying again.');
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } catch (error) {
    const cleanup = { type: 'authenticated' as const, resource_type: 'image' as const, timeout: 20000 };
    try { await cloudinary.uploader.destroy(publicId,cleanup); } catch { /* Operator can reconcile orphaned private assets. */ }
    if ((error as { code?: string }).code === '23505') throw new ConflictError('This transaction ID has already been submitted');
    throw error;
  }
  return { choice: 'upi_submitted' };
}

export async function getOwnerPaymentProof(orderId: string, restaurantId: string) {
  enabled();
  const row = (await pool.query('SELECT * FROM order_payment_choices WHERE order_id=$1 AND restaurant_id=$2',[orderId,restaurantId])).rows[0];
  if (!row) throw new NotFoundError('Order payment not found');
  let proofUrl: string | null = null;
  if (row.proof_public_id) {
    configureStorage();
    proofUrl = cloudinary.utils.private_download_url(row.proof_public_id,'jpg', { type: 'authenticated', resource_type: 'image', expires_at: Math.floor(Date.now()/1000)+60 });
  }
  return { choice: row.choice, transactionId: row.transaction_id, proofUrl };
}
