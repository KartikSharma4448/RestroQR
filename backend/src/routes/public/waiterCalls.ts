import { Router } from 'express';
import { callWaiter, getTableWaiterCall } from '../../services/waiterCallService';
import { sendWaiterNotification } from '../../services/notificationService';
const router=Router();
router.post('/waiter-calls/status',async(req,res,next)=>{
  res.set('Cache-Control','no-store');
  try { res.json({success:true,data:{call:await getTableWaiterCall(req.body?.tableToken)}}); }
  catch(error){next(error)}
});
router.post('/waiter-calls',async(req,res,next)=>{
  res.set('Cache-Control','no-store');
  try {
    const result=await callWaiter(req.body?.tableToken);
    if (!result.replayed) void sendWaiterNotification(result.restaurantId,result.tableName,result.call.id).catch(()=>{});
    res.status(result.replayed?200:201).json({success:true,data:{call:result.call}});
  } catch(error){next(error)}
});
export default router;
