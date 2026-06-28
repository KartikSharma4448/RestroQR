import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { getRestaurantIdForOwner } from '../../services/categoryService';
import {
  getMonthlySummary,
  getEarningsBreakdown,
  getOrderHistory,
  getItemAnalytics,
} from '../../services/earningsService';

const router = Router();

/**
 * GET /api/owner/earnings/summary?month=2025-01
 * Returns the monthly earnings summary (total orders and revenue).
 */
router.get(
  '/earnings/summary',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const month = (req.query.month as string) || getCurrentMonth();

      const summary = await getMonthlySummary(restaurantId, month);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/owner/earnings/breakdown?period=daily&month=2025-01
 * Returns earnings breakdown by period (daily, weekly, or monthly).
 */
router.get(
  '/earnings/breakdown',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'daily';
      const month = (req.query.month as string) || getCurrentMonth();

      const breakdown = await getEarningsBreakdown(restaurantId, period, month);

      res.status(200).json({
        success: true,
        data: { breakdown },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/owner/earnings/history?page=1&pageSize=20&status=payment_received
 * Returns paginated order history with optional status filter.
 */
router.get(
  '/earnings/history',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const pageSize = req.query.pageSize
        ? parseInt(req.query.pageSize as string, 10)
        : undefined;
      const status = req.query.status as string | undefined;

      const result = await getOrderHistory(restaurantId, { page, pageSize, status });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/owner/analytics/items?period=monthly&month=2025-01
 * Returns per-item analytics (quantity sold and revenue).
 */
router.get(
  '/analytics/items',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'monthly';
      const month = (req.query.month as string) || getCurrentMonth();

      const result = await getItemAnalytics(restaurantId, period, month);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Helper: Returns the current month in "YYYY-MM" format.
 */
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export default router;
