import { Router, Request, Response, NextFunction } from 'express';
import { getLoyaltyStatus } from '../../services/loyaltyService';
import { ValidationError, NotFoundError } from '../../errors';
import pool from '../../config/database';

const router = Router();

/**
 * GET /api/public/loyalty/:phone
 * Public endpoint to fetch customer loyalty progress.
 * Query params:
 *   - restaurantToken: Token of the restaurant (from URL)
 */
router.get(
  '/loyalty/:phone',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const phone = req.params.phone as string;
      const restaurantToken = req.query.restaurantToken as string | undefined;

      // Validate inputs
      if (!phone || !/^\d{10}$/.test(phone.trim())) {
        throw new ValidationError('Valid 10-digit phone number is required', [
          { field: 'phone', message: 'Valid 10-digit phone number is required' },
        ]);
      }

      if (!restaurantToken || typeof restaurantToken !== 'string') {
        throw new ValidationError('restaurantToken is required', [
          { field: 'restaurantToken', message: 'restaurantToken is required' },
        ]);
      }

      // Fetch restaurantId from token
      const restResult = await pool.query(
        'SELECT id FROM restaurants WHERE restaurant_token = $1',
        [restaurantToken.trim()]
      );

      if (restResult.rows.length === 0) {
        throw new NotFoundError('Restaurant not found');
      }

      const restaurantId = restResult.rows[0].id;

      // Get status
      const status = await getLoyaltyStatus(restaurantId, phone);

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
