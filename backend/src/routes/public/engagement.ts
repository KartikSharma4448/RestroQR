import { Router, Request, Response, NextFunction } from 'express';
import { publicEngagement, getReward, reviewVisit } from '../../services/customerEngagementService';
const router = Router();
const handle =
  (fn: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    try {
      res.json({ success: true, data: await fn(req) });
    } catch (e) {
      next(e);
    }
  };
router.get(
  '/engagement/:token',
  handle((req) => publicEngagement(req.params.token as string)),
);
router.post(
  '/rewards/view',
  handle((req) => getReward(req.body?.token, req.body?.claim)),
);
router.post(
  '/reviews/view',
  handle((req) => reviewVisit(req.body?.token)),
);
router.post(
  '/reviews/submit',
  handle((req) => reviewVisit(req.body?.token, { rating: req.body?.rating, body: req.body?.body })),
);
export default router;
