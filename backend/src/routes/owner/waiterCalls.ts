import { Router,Response,NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { getRestaurantIdForOwner } from '../../services/categoryService';
import { getOwnerWaiterCalls,updateWaiterCall } from '../../services/waiterCallService';
const router=Router();
router.get('/waiter-calls',async(req:AuthenticatedRequest,res:Response,next:NextFunction)=>{
  res.set('Cache-Control','no-store');
  try { res.json({success:true,data:{calls:await getOwnerWaiterCalls(await getRestaurantIdForOwner(req.user!.sub))}}); }
  catch(error){next(error)}
});
router.patch('/waiter-calls/:id',async(req:AuthenticatedRequest,res:Response,next:NextFunction)=>{
  res.set('Cache-Control','no-store');
  try { res.json({success:true,data:{call:await updateWaiterCall(req.params.id as string,await getRestaurantIdForOwner(req.user!.sub),req.body?.status)}}); }
  catch(error){next(error)}
});
export default router;
