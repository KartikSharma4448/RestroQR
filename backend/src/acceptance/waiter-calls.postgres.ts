jest.mock('../services/notificationService',()=>({sendWaiterNotification:jest.fn(async()=>undefined)}));
import { randomUUID } from 'crypto';
import request from 'supertest';
import { sendWaiterNotification } from '../services/notificationService';
const url=new URL(process.env.RESTROQR_ACCEPTANCE_DATABASE_URL || 'http://invalid');
if(url.hostname!=='127.0.0.1'||!/^\/restroqr_auth_acceptance_[a-z0-9_]+$/.test(url.pathname)||process.env.DATABASE_URL!==process.env.RESTROQR_ACCEPTANCE_DATABASE_URL)throw Error('Unsafe database');
const pool: import('pg').Pool=require('../config/database').default;
const waiter:typeof import('../services/waiterCallService')=require('../services/waiterCallService');
beforeEach(async()=>{process.env.WAITER_CALLING_ENABLED='true';await pool.query('TRUNCATE owners RESTART IDENTITY CASCADE');jest.clearAllMocks()});
afterAll(async()=>{await pool.end()});
async function fixture(){
 const owner=(await pool.query("INSERT INTO owners(name,email,password_hash) VALUES ('Test Owner','owner@example.test','not-a-login') RETURNING id")).rows[0];
 const restaurant=await require('../services/ownerRestaurantService').createRestaurant({ownerId:owner.id,name:'Waiter Cafe',address:'Jaipur',phone:'9999999999'});
 await pool.query("UPDATE restaurants SET qr_mode='multi',onboarding_required=false WHERE id=$1",[restaurant.id]);
 const table=await require('../services/tableService').createTable(restaurant.id,'Table A');
 return {owner,restaurant,table};
}
it('serializes duplicate requests into one durable active call',async()=>{
 const f=await fixture();
 const calls=await Promise.all(Array.from({length:5},()=>waiter.callWaiter(f.table.tableToken)));
 expect(new Set(calls.map(row=>row.call.id)).size).toBe(1);
 expect(calls.filter(row=>!row.replayed)).toHaveLength(1);
 expect((await pool.query('SELECT id FROM waiter_calls')).rowCount).toBe(1);
 expect(await waiter.getTableWaiterCall(f.table.tableToken)).toMatchObject({status:'pending'});
 expect(await waiter.getOwnerWaiterCalls(f.restaurant.id)).toEqual([expect.objectContaining({tableName:'Table A',status:'pending'})]);
});
it('acknowledges and resolves only in the right restaurant; repeated actions are safe',async()=>{
 const f=await fixture();const {call}=await waiter.callWaiter(f.table.tableToken);
 await expect(waiter.updateWaiterCall(call.id,randomUUID(),'acknowledged')).rejects.toMatchObject({statusCode:404});
 await waiter.updateWaiterCall(call.id,f.restaurant.id,'acknowledged');
 await waiter.updateWaiterCall(call.id,f.restaurant.id,'acknowledged');
 await waiter.updateWaiterCall(call.id,f.restaurant.id,'resolved');
 await waiter.updateWaiterCall(call.id,f.restaurant.id,'resolved');
 expect(await waiter.getOwnerWaiterCalls(f.restaurant.id)).toEqual([]);
 await expect(waiter.updateWaiterCall(call.id,f.restaurant.id,'acknowledged')).rejects.toMatchObject({statusCode:409});
});
it('closes a pending waiter call with a single OK action and remains idempotent',async()=>{
 const f=await fixture();const {call}=await waiter.callWaiter(f.table.tableToken);
 await waiter.updateWaiterCall(call.id,f.restaurant.id,'resolved');
 await waiter.updateWaiterCall(call.id,f.restaurant.id,'resolved');
 expect(await waiter.getOwnerWaiterCalls(f.restaurant.id)).toEqual([]);
 expect((await waiter.getTableWaiterCall(f.table.tableToken))?.status).toBe('resolved');
});
it('applies cooldown after resolution, then allows a fresh request',async()=>{
 const f=await fixture();const {call}=await waiter.callWaiter(f.table.tableToken);
 await waiter.updateWaiterCall(call.id,f.restaurant.id,'acknowledged');await waiter.updateWaiterCall(call.id,f.restaurant.id,'resolved');
 await expect(waiter.callWaiter(f.table.tableToken)).rejects.toMatchObject({statusCode:429});
 await pool.query("UPDATE waiter_calls SET updated_at=NOW()-INTERVAL '61 seconds' WHERE id=$1",[call.id]);
 expect((await waiter.callWaiter(f.table.tableToken)).call.id).not.toBe(call.id);
});
it('rejects invalid and rotated QR tokens, disabled owners/restaurants and single-mode tables',async()=>{
 const f=await fixture();
 await expect(waiter.callWaiter('invalid-token')).rejects.toMatchObject({statusCode:404});
 await pool.query("UPDATE tables SET table_token='rotated' WHERE id=$1",[f.table.id]);
 await expect(waiter.callWaiter(f.table.tableToken)).rejects.toMatchObject({statusCode:404});
 await pool.query('UPDATE tables SET table_token=$1 WHERE id=$2',[f.table.tableToken,f.table.id]);
 await pool.query("UPDATE restaurants SET status='disabled' WHERE id=$1",[f.restaurant.id]);
 await expect(waiter.callWaiter(f.table.tableToken)).rejects.toMatchObject({statusCode:404});
 await pool.query("UPDATE restaurants SET status='active',qr_mode='single' WHERE id=$1",[f.restaurant.id]);
 await expect(waiter.callWaiter(f.table.tableToken)).rejects.toMatchObject({statusCode:404});
 await pool.query("UPDATE restaurants SET qr_mode='multi' WHERE id=$1",[f.restaurant.id]);
 await pool.query("UPDATE owners SET status='disabled' WHERE id=$1",[f.owner.id]);
 await expect(waiter.callWaiter(f.table.tableToken)).rejects.toMatchObject({statusCode:404});
});
it('creates calls without customer login/OTP and notifies the owner only once',async()=>{
 const f=await fixture();const app=require('../index').default;
 const first=await request(app).post('/api/public/waiter-calls').send({tableToken:f.table.tableToken}).expect(201);
 expect(first.headers['cache-control']).toBe('no-store');
 expect(first.body.data.call).not.toHaveProperty('restaurantId');
 await request(app).post('/api/public/waiter-calls').send({tableToken:f.table.tableToken}).expect(200);
 expect(sendWaiterNotification).toHaveBeenCalledTimes(1);
 expect(sendWaiterNotification).toHaveBeenCalledWith(f.restaurant.id,'Table A',first.body.data.call.id);
 await request(app).get('/api/owner/waiter-calls').expect(401);
 const token=require('jsonwebtoken').sign({sub:f.owner.id,role:'owner'},process.env.JWT_SECRET,{expiresIn:'5m'});
 const listed=await request(app).get('/api/owner/waiter-calls').set('Authorization',`Bearer ${token}`).expect(200);
 expect(listed.body.data.calls[0].tableName).toBe('Table A');
 await request(app).patch(`/api/owner/waiter-calls/${first.body.data.call.id}`).set('Authorization',`Bearer ${token}`).send({status:'acknowledged'}).expect(200);
 const status=await request(app).post('/api/public/waiter-calls/status').send({tableToken:f.table.tableToken}).expect(200);
 expect(status.body.data.call.status).toBe('acknowledged');
});
it('retains the request even when push delivery fails and honors disabled rollout',async()=>{
 const f=await fixture();const app=require('../index').default;
 (sendWaiterNotification as jest.Mock).mockRejectedValueOnce(new Error('offline'));
 await request(app).post('/api/public/waiter-calls').send({tableToken:f.table.tableToken}).expect(201);
 expect(await waiter.getOwnerWaiterCalls(f.restaurant.id)).toHaveLength(1);
 process.env.WAITER_CALLING_ENABLED='false';
 await expect(waiter.callWaiter(f.table.tableToken)).rejects.toMatchObject({statusCode:503});
});
