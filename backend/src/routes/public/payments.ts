import { Router } from 'express';
import multer from 'multer';
import { ValidationError } from '../../errors';
import { authorizeOrderPayment, chooseCash, getOrderPayment, submitPaymentProof } from '../../services/orderPaymentService';

const router = Router();
router.use('/order-payments/:id', async (req,res,next) => {
  res.set('Cache-Control','no-store');
  try { await authorizeOrderPayment(req.params.id as string, req.get('X-Order-Token')); next(); }
  catch (error) { next(error); }
});
router.get('/order-payments/:id', async (req,res,next) => {
  try { res.json({ success: true, data: await getOrderPayment(req.params.id as string,req.get('X-Order-Token')) }); }
  catch (error) { next(error); }
});
router.post('/order-payments/:id/cash', async (req,res,next) => {
  try { res.json({ success: true, data: await chooseCash(req.params.id as string,req.get('X-Order-Token')) }); }
  catch (error) { next(error); }
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2*1024*1024, files: 1, fields: 1, parts: 2, fieldSize: 64 } }).single('image');
router.post('/order-payments/:id/proof', (req,res,next) => {
  upload(req,res,error => next(error ? new ValidationError('Choose one JPEG, PNG or WebP screenshot up to 2MB') : undefined));
}, async (req,res,next) => {
  try { res.json({ success: true, data: await submitPaymentProof(req.params.id as string,req.get('X-Order-Token'),req.body?.transactionId,req.file) }); }
  catch (error) { next(error); }
});
export default router;
