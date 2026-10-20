jest.mock('../services/emailService', () => ({ ...jest.requireActual('../services/emailService'), sendTransactionalEmail: jest.fn(async () => 'test-provider-id') }));
import { randomUUID } from 'crypto';
import { sendTransactionalEmail, EmailDeliveryError } from '../services/emailService';
const url=new URL(process.env.RESTROQR_ACCEPTANCE_DATABASE_URL || 'http://invalid');
if(url.hostname!=='127.0.0.1'||!/^\/restroqr_auth_acceptance_[a-z0-9_]+$/.test(url.pathname)||process.env.DATABASE_URL!==process.env.RESTROQR_ACCEPTANCE_DATABASE_URL)throw Error('Unsafe database');
const pool: import('pg').Pool=require('../config/database').default;
const orders=require('../services/orderService');
const mail: typeof import('../services/customerOrderEmailService')=require('../services/customerOrderEmailService');
beforeEach(async()=>{
  process.env.CUSTOMER_EMAIL_ORDERING_ENABLED='true'; process.env.ORDER_LIFECYCLE_EMAIL_ENABLED='true';
  process.env.PAYMENT_RECEIPT_EMAIL_ENABLED='true'; process.env.ORDER_EMAIL_DELIVERY_ENABLED='true';
  process.env.ORDER_EMAIL_DELIVERY_NOT_BEFORE='';
  await pool.query('TRUNCATE owners RESTART IDENTITY CASCADE');
  jest.clearAllMocks(); (sendTransactionalEmail as jest.Mock).mockResolvedValue('test-provider-id');
});
afterAll(async()=>{await pool.end()});
async function fixture(){
  const owner=(await pool.query("INSERT INTO owners(name,email,password_hash) VALUES ('Test Owner','owner@example.test','not-a-login') RETURNING id")).rows[0];
  const restaurant=await require('../services/ownerRestaurantService').createRestaurant({ownerId:owner.id,name:'Lifecycle Cafe',address:'Jaipur',phone:'9999999999'});
  await pool.query("UPDATE restaurants SET qr_mode='multi',onboarding_required=false WHERE id=$1",[restaurant.id]);
  const table=await require('../services/tableService').createTable(restaurant.id,'Table A');
  const category=(await pool.query("INSERT INTO categories(restaurant_id,name) VALUES ($1,'Drinks') RETURNING id",[restaurant.id])).rows[0];
  const item=await require('../services/foodItemService').createFoodItem(restaurant.id,category.id,{name:'Tea',price:10,badge:'veg'});
  const order=await orders.createOrder(table.tableToken,[{itemId:item.id,quantity:2}],'Guest',undefined,{customerEmail:'buyer@example.test',requestId:randomUUID()});
  return {owner,restaurant,table,order};
}
it('does not email pending orders; Accept, Ready and Paid each queue one ordered email',async()=>{
  const f=await fixture();
  expect((await pool.query('SELECT id FROM order_email_outbox')).rowCount).toBe(0);
  for(const status of ['accepted','completed','payment_received']){
    await Promise.all([orders.updateOrderStatus(f.order.id,f.restaurant.id,status),orders.updateOrderStatus(f.order.id,f.restaurant.id,status)]);
  }
  const jobs=(await pool.query('SELECT * FROM order_email_outbox ORDER BY created_at,id')).rows;
  expect(jobs.map(row=>row.kind)).toEqual(['order-accepted','order-ready','payment-receipt']);
  expect(jobs.every(row=>row.recipient==='buyer@example.test')).toBe(true);
  expect(jobs[0].body).toContain('preparation in progress');
  expect(jobs[0].body).toContain('2 x Tea: INR 20.00');
  expect(jobs[0].body).toContain('Table: Table A');
  expect(jobs[1].body).toContain('Your order is ready');
  expect(jobs[2].body).toContain('Total paid: INR 20.00');
  for(let i=0;i<3;i++)await mail.deliverNextOrderEmail();
  expect((sendTransactionalEmail as jest.Mock).mock.calls.map(call=>call[0].idempotencyKey)).toEqual([
    `order-accepted/${f.order.id}`,`order-ready/${f.order.id}`,`payment-receipt/${f.order.id}`]);
});
it('rolls back acceptance and email together if durable queue insertion fails',async()=>{
  const f=await fixture();
  const spy=jest.spyOn(mail,'queueOrderStatusEmail').mockRejectedValueOnce(new Error('outbox-failed'));
  try{
    await expect(orders.updateOrderStatus(f.order.id,f.restaurant.id,'accepted')).rejects.toThrow('outbox-failed');
    expect((await pool.query('SELECT status FROM orders WHERE id=$1',[f.order.id])).rows[0].status).toBe('pending');
    expect((await pool.query('SELECT id FROM order_email_outbox')).rowCount).toBe(0);
  }finally{spy.mockRestore()}
});
it('rejects wrong-owner scope and skipped readiness without queuing mail',async()=>{
  const f=await fixture();
  await expect(orders.updateOrderStatus(f.order.id,randomUUID(),'accepted')).rejects.toMatchObject({statusCode:404});
  await expect(orders.updateOrderStatus(f.order.id,f.restaurant.id,'completed')).rejects.toMatchObject({code:'INVALID_TRANSITION'});
  expect((await pool.query('SELECT id FROM order_email_outbox')).rowCount).toBe(0);
});
it('keeps later events behind a retrying earlier email while preserving order status',async()=>{
  const f=await fixture();
  await orders.updateOrderStatus(f.order.id,f.restaurant.id,'accepted');
  await orders.updateOrderStatus(f.order.id,f.restaurant.id,'completed');
  (sendTransactionalEmail as jest.Mock).mockRejectedValueOnce(new EmailDeliveryError(true));
  await mail.deliverNextOrderEmail();
  expect(await mail.deliverNextOrderEmail()).toBe(false);
  await pool.query('UPDATE order_email_outbox SET next_attempt_at=NOW()');
  await mail.deliverNextOrderEmail(); await mail.deliverNextOrderEmail();
  const calls=(sendTransactionalEmail as jest.Mock).mock.calls;
  expect(calls[0][0]).toEqual(calls[1][0]);
  expect(calls[2][0].idempotencyKey).toBe(`order-ready/${f.order.id}`);
  expect((await pool.query('SELECT status FROM orders WHERE id=$1',[f.order.id])).rows[0].status).toBe('completed');
});
it('never flushes old pending jobs or legacy creation emails after a controlled activation',async()=>{
  const f=await fixture();
  await orders.updateOrderStatus(f.order.id,f.restaurant.id,'accepted');
  await orders.updateOrderStatus(f.order.id,f.restaurant.id,'completed');
  await orders.updateOrderStatus(f.order.id,f.restaurant.id,'payment_received');
  await mail.queueOrderConfirmation(pool,'buyer@example.test',f.restaurant.id,f.order);
  await pool.query("UPDATE order_email_outbox SET created_at=NOW()-INTERVAL '1 day'");
  process.env.ORDER_EMAIL_DELIVERY_NOT_BEFORE=new Date().toISOString();
  expect(await mail.deliverNextOrderEmail()).toBe(false);
  await pool.query("UPDATE order_email_outbox SET created_at=NOW()+INTERVAL '1 second' WHERE kind IN ('payment-receipt','order-confirmation')");
  await mail.deliverNextOrderEmail();
  expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
  expect((sendTransactionalEmail as jest.Mock).mock.calls[0][0].idempotencyKey).toBe(`payment-receipt/${f.order.id}`);
  expect(await mail.deliverNextOrderEmail()).toBe(false);
});
it('fails closed on an invalid activation cutoff',async()=>{
  const f=await fixture(); await orders.updateOrderStatus(f.order.id,f.restaurant.id,'accepted');
  process.env.ORDER_EMAIL_DELIVERY_NOT_BEFORE='invalid-date';
  expect(await mail.deliverNextOrderEmail()).toBe(false);
  expect(sendTransactionalEmail).not.toHaveBeenCalled();
});
