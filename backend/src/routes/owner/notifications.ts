import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import {
  registerFcmToken,
  unregisterFcmToken,
} from '../../services/notificationService';
import { ValidationError } from '../../errors';

const router = Router();

/**
 * POST /api/owner/notifications/register
 * Register an FCM device token for push notifications.
 * Body: { "fcmToken": "string" }
 */
router.post(
  '/notifications/register',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const { fcmToken } = req.body;

      if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim().length === 0) {
        throw new ValidationError('fcmToken is required and must be a non-empty string');
      }

      await registerFcmToken(ownerId, fcmToken.trim());

      res.status(200).json({
        success: true,
        data: { message: 'FCM token registered successfully' },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/owner/notifications/unregister
 * Unregister the FCM device token for the authenticated owner.
 */
router.delete(
  '/notifications/unregister',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;

      await unregisterFcmToken(ownerId);

      res.status(200).json({
        success: true,
        data: { message: 'FCM token unregistered successfully' },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
