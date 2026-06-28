import { Router, Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import { AuthenticatedRequest } from '../../middleware/auth';
import { NotFoundError } from '../../errors';
import pool from '../../config/database';

const router = Router();

/**
 * GET /api/owner/qr
 * Generate and download QR code PNG for the owner's restaurant.
 * The QR code encodes: https://restroqr.com/r/{restaurant_token}
 */
router.get(
  '/qr',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;

      // Lookup restaurant by owner
      const result = await pool.query(
        'SELECT restaurant_token FROM restaurants WHERE owner_id = $1',
        [ownerId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError(
          'Restaurant profile not found. Please complete your profile first.'
        );
      }

      const restaurantToken = result.rows[0].restaurant_token;
      const url = `https://restro-qr-peach.vercel.app/r/${restaurantToken}`;

      // Generate QR code PNG buffer (minimum 300x300px)
      let pngBuffer: Buffer;
      try {
        pngBuffer = await QRCode.toBuffer(url, {
          type: 'png',
          width: 300,
          margin: 2,
          errorCorrectionLevel: 'M',
        });
      } catch {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'QR code generation failed. Please try again.',
          },
        });
        return;
      }

      // Send PNG as downloadable image
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', 'attachment; filename="qrcode.png"');
      res.send(pngBuffer);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
