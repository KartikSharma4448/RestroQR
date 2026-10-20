jest.mock('cloudinary', () => ({ v2: {
  config: jest.fn(), uploader: { upload_stream: jest.fn(), destroy: jest.fn(async () => ({})) },
  utils: { private_download_url: jest.fn(() => 'https://private.example.test/signed-proof') },
} }));
import { randomUUID } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import request from 'supertest';

const url = new URL(process.env.RESTROQR_ACCEPTANCE_DATABASE_URL || 'http://invalid');
if (url.hostname !== '127.0.0.1' || !/^\/restroqr_auth_acceptance_[a-z0-9_]+$/.test(url.pathname) || process.env.DATABASE_URL !== process.env.RESTROQR_ACCEPTANCE_DATABASE_URL) throw Error('Unsafe test database');
const pool = require('../config/database').default;
const payments: typeof import('../services/orderPaymentService') = require('../services/orderPaymentService');
const orders = require('../services/orderService');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=','base64');
const file = { fieldname: 'image', buffer: png, size: png.length, mimetype: 'image/png', originalname: 'proof.png' };
beforeEach(async () => {
  process.env.CUSTOMER_EMAIL_ORDERING_ENABLED='true'; process.env.ORDER_PAYMENTS_ENABLED='true';
  process.env.ORDER_EMAIL_DELIVERY_ENABLED='false'; process.env.CLOUDINARY_URL='cloudinary://fake-key:fake-secret@test-cloud';
  await pool.query('TRUNCATE owners RESTART IDENTITY CASCADE');
  jest.clearAllMocks();
  (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_options,callback) => ({ end: () => callback(null,{ public_id: `private-test/${randomUUID()}` }) }));
});
afterAll(async () => { await pool.end(); });
async function fixture() {
  const owner=(await pool.query("INSERT INTO owners(name,email,password_hash) VALUES ('Test Owner','owner@example.test','not-a-login') RETURNING id")).rows[0];
  const restaurant=await require('../services/ownerRestaurantService').createRestaurant({ownerId:owner.id,name:'Payment Cafe',address:'Jaipur',phone:'9999999999'});
  await pool.query("UPDATE restaurants SET qr_mode='multi',onboarding_required=false,business_upi_id='cafe@upi' WHERE id=$1",[restaurant.id]);
  const table=await require('../services/tableService').createTable(restaurant.id,'A');
  const category=(await pool.query("INSERT INTO categories(restaurant_id,name) VALUES ($1,'Drinks') RETURNING id",[restaurant.id])).rows[0];
  const item=await require('../services/foodItemService').createFoodItem(restaurant.id,category.id,{name:'Tea',price:10,badge:'veg'});
  const order=await orders.createOrder(table.tableToken,[{itemId:item.id,quantity:2}],undefined,undefined,{customerEmail:'buyer@example.test',requestId:randomUUID()});
  const access=await payments.issueOrderPayment(order.id);
  return { owner,restaurant,table,item,order,access };
}
it('creates stable private checkout access and server-authoritative UPI amount/payee snapshots', async () => {
  const f=await fixture();
  expect(await payments.issueOrderPayment(f.order.id)).toEqual(f.access);
  await pool.query("UPDATE restaurants SET business_upi_id='changed@upi',name='Changed' WHERE id=$1",[f.restaurant.id]);
  const data=await payments.getOrderPayment(f.order.id,f.access.token);
  expect(data.total).toBe('20.00'); expect(data.upiId).toBe('cafe@upi'); expect(data.payeeName).toBe('Payment Cafe');
  const parsed=new URL(data.upiUrl!);
  expect(parsed.searchParams.get('am')).toBe('20.00'); expect(parsed.searchParams.get('cu')).toBe('INR');
  expect(data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  expect(data).not.toHaveProperty('customer_email'); expect(data).not.toHaveProperty('proof_public_id');
});
it('requires an unguessable order-bound capability and rejects expired access', async () => {
  const f=await fixture();
  await expect(payments.getOrderPayment(f.order.id,'b'.repeat(64))).rejects.toMatchObject({statusCode:404});
  await expect(payments.getOrderPayment(randomUUID(),f.access.token)).rejects.toMatchObject({statusCode:404});
  await pool.query("UPDATE order_payment_choices SET expires_at=NOW()-INTERVAL '1 second'");
  await expect(payments.getOrderPayment(f.order.id,f.access.token)).rejects.toMatchObject({statusCode:404});
});
it('records cash idempotently without marking paid and blocks cancelled/paid changes', async () => {
  const f=await fixture();
  await payments.chooseCash(f.order.id,f.access.token); await payments.chooseCash(f.order.id,f.access.token);
  expect((await payments.getOrderPayment(f.order.id,f.access.token)).choice).toBe('cash');
  expect((await pool.query('SELECT status FROM orders WHERE id=$1',[f.order.id])).rows[0].status).toBe('pending');
  await pool.query("UPDATE orders SET status='cancelled' WHERE id=$1",[f.order.id]);
  await expect(payments.chooseCash(f.order.id,f.access.token)).rejects.toMatchObject({statusCode:409});
  expect((await payments.getOrderPayment(f.order.id,f.access.token)).upiUrl).toBeNull();
});
it('accepts private screenshot and transaction ID once, never marking paid or sending receipt', async () => {
  const f=await fixture();
  await payments.submitPaymentProof(f.order.id,f.access.token,'TX12345678',file);
  await payments.submitPaymentProof(f.order.id,f.access.token,'TX12345678',file);
  expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(1);
  expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(expect.objectContaining({type:'authenticated',format:'jpg',timeout:30000}),expect.any(Function));
  expect((await pool.query('SELECT status FROM orders WHERE id=$1',[f.order.id])).rows[0].status).toBe('pending');
  expect((await pool.query("SELECT id FROM order_email_outbox WHERE kind='payment-receipt'")).rowCount).toBe(0);
  await expect(payments.chooseCash(f.order.id,f.access.token)).rejects.toMatchObject({statusCode:409});
  await expect(payments.getOwnerPaymentProof(f.order.id,randomUUID())).rejects.toMatchObject({statusCode:404});
  const review=await payments.getOwnerPaymentProof(f.order.id,f.restaurant.id);
  expect(review.transactionId).toBe('TX12345678'); expect(review.proofUrl).toBe('https://private.example.test/signed-proof');
  expect(cloudinary.utils.private_download_url).toHaveBeenCalledWith(expect.any(String),'jpg',expect.objectContaining({type:'authenticated',expires_at:expect.any(Number)}));
  const listed=await orders.getOrders(f.restaurant.id,{});
  expect(listed.orders[0].paymentSummary).toEqual({choice:'upi_submitted',transactionId:'TX12345678'});
});
it('rejects malformed images, missing proof, invalid transaction IDs and oversized screenshots before provider upload', async () => {
  const f=await fixture();
  for (const [utr,image] of [['bad',file],['TX12345678',undefined],['TX12345678',{...file,buffer:Buffer.from('<svg>'),size:5}],['TX12345678',{...file,buffer:Buffer.alloc(2*1024*1024+1),size:2*1024*1024+1}]]) {
    await expect(payments.submitPaymentProof(f.order.id,f.access.token,utr,image as typeof file)).rejects.toMatchObject({statusCode:400});
  }
  expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
});
it('bounds failed upload attempts without losing the order', async () => {
  const f=await fixture();
  (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_options,callback) => ({end:()=>callback(new Error('provider failure'))}));
  for(let i=0;i<3;i++) await expect(payments.submitPaymentProof(f.order.id,f.access.token,'TX12345678',file)).rejects.toMatchObject({statusCode:503});
  await expect(payments.submitPaymentProof(f.order.id,f.access.token,'TX12345678',file)).rejects.toMatchObject({statusCode:409});
  expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(3);
});
it('prevents reusing a transaction ID for another order at the same restaurant', async () => {
  const f=await fixture();
  await payments.submitPaymentProof(f.order.id,f.access.token,'TX12345678',file);
  const second=await orders.createOrder(f.table.tableToken,[{itemId:f.item.id,quantity:1}],undefined,undefined,{customerEmail:'other@example.test',requestId:randomUUID()});
  const access=await payments.issueOrderPayment(second.id);
  await expect(payments.submitPaymentProof(second.id,access.token,'tx12345678',file)).rejects.toMatchObject({statusCode:409});
  expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(1);
  expect((await payments.getOrderPayment(second.id,access.token)).choice).toBe('unselected');
});
it('cleans up a new private asset if order closes during upload', async () => {
  const f=await fixture();
  (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_options,callback) => ({end:()=>{
    pool.query("UPDATE orders SET status='cancelled' WHERE id=$1",[f.order.id]).then(()=>callback(null,{public_id:'new-orphan'}));
  }}));
  await expect(payments.submitPaymentProof(f.order.id,f.access.token,'TX12345678',file)).rejects.toMatchObject({statusCode:409});
  expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('new-orphan',expect.objectContaining({type:'authenticated'}));
});
it('rejects anonymous access before parsing proof uploads and protects owner proof route', async () => {
  const f=await fixture(); const app=require('../index').default;
  await request(app).get(`/api/public/order-payments/${f.order.id}`).expect(404);
  const response=await request(app).get(`/api/public/order-payments/${f.order.id}`).set('X-Order-Token',f.access.token).expect(200);
  expect(response.headers['cache-control']).toBe('no-store');
  await request(app).post(`/api/public/order-payments/${f.order.id}/proof`).attach('image',png,'proof.png').expect(404);
  await request(app).get(`/api/owner/orders/${f.order.id}/payment`).expect(401);
});
it('accepts multipart proof through the customer route and exposes it only to the authenticated owner', async () => {
  const f=await fixture(); const app=require('../index').default;
  await request(app).post(`/api/public/order-payments/${f.order.id}/proof`).set('X-Order-Token',f.access.token)
    .field('transactionId','TX12345678').attach('image',png,{filename:'proof.png',contentType:'image/png'}).expect(200);
  const jwt=require('jsonwebtoken').sign({sub:f.owner.id,role:'owner'},process.env.JWT_SECRET,{expiresIn:'5m'});
  const response=await request(app).get(`/api/owner/orders/${f.order.id}/payment`).set('Authorization',`Bearer ${jwt}`).expect(200);
  expect(response.body.data.transactionId).toBe('TX12345678');
  expect(response.body.data.proofUrl).toBe('https://private.example.test/signed-proof');
  expect(response.headers['cache-control']).toBe('no-store');
});
it('keeps feature disabled unless explicitly enabled', async () => {
  const f=await fixture(); process.env.ORDER_PAYMENTS_ENABLED='false';
  await expect(payments.getOrderPayment(f.order.id,f.access.token)).rejects.toMatchObject({statusCode:503});
});
