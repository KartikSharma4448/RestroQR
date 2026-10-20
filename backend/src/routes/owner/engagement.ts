import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { getRestaurantIdForOwner } from '../../services/categoryService';
import {
  getLoyaltySettings,
  saveLoyaltySettings,
  ownerEngagement,
  redeemReward,
  inspectReward,
  moderateReview,
  recordLoyaltyRefund,
  loyaltyEnabled,
  reviewsEnabled,
} from '../../services/customerEngagementService';
const router = Router();
const handle =
  (fn: (id: string, req: AuthenticatedRequest) => Promise<unknown>) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    res.set('Cache-Control', 'no-store');
    try {
      res.json({
        success: true,
        data: await fn(await getRestaurantIdForOwner(req.user!.sub), req),
      });
    } catch (e) {
      next(e);
    }
  };
router.get(
  '/engagement',
  handle(async (id) => ({
    ...(await ownerEngagement(id)),
    loyaltyEnabled: loyaltyEnabled(),
    reviewsEnabled: reviewsEnabled(),
    settings: loyaltyEnabled() ? await getLoyaltySettings(id) : null,
  })),
);
router.put(
  '/loyalty/settings',
  handle((id, req) => saveLoyaltySettings(id, req.body || {})),
);
router.post(
  '/loyalty/redeem',
  handle((id, req) => redeemReward(id, req.body?.code)),
);
router.post(
  '/loyalty/claim',
  handle((id, req) => inspectReward(id, req.body?.code)),
);
router.post(
  '/loyalty/refunds',
  handle((id, req) =>
    recordLoyaltyRefund(id, req.body?.orderId, req.body?.amountCents, req.body?.requestId),
  ),
);
router.patch(
  '/reviews/:id',
  handle((id, req) => moderateReview(id, req.params.id as string, req.body?.status)),
);
export default router;
