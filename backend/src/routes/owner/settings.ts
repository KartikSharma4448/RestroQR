import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { updateQrMode } from '../../services/settingsService';
import { getRestaurantByOwner } from '../../services/ownerRestaurantService';

const router = Router();

/**
 * PATCH /api/owner/settings/qr-mode
 * Update the QR mode for the owner's restaurant.
 * Body: { "qrMode": "single" | "multi" }
 */
router.patch(
  '/settings/qr-mode',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurant = await getRestaurantByOwner(ownerId);
      const { qrMode } = req.body;

      const result = await updateQrMode(restaurant.id, qrMode);

      res.status(200).json({
        success: true,
        data: { qrMode: result.qrMode },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
