import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { getRestaurantIdForOwner } from '../../services/categoryService';
import {
  getMonthlySummary,
  getEarningsBreakdown,
  getOrderHistory,
  getItemAnalytics,
} from '../../services/earningsService';

import { ValidationError } from '../../errors';

const router = Router();

const VALID_PERIODS = ['daily', 'weekly', 'monthly'] as const;
type Period = typeof VALID_PERIODS[number];

/**
 * Validates the 'period' query parameter.
 */
function validatePeriod(value: string | undefined, defaultValue: Period): Period {
  if (!value) return defaultValue;
  if (!VALID_PERIODS.includes(value as Period)) {
    throw new ValidationError('Invalid period value', [
      { field: 'period', message: `Period must be one of: ${VALID_PERIODS.join(', ')}` },
    ]);
  }
  return value as Period;
}

/**
 * Validates the 'month' query parameter format (YYYY-MM).
 */
function validateMonth(value: string | undefined): string {
  if (!value) return getCurrentMonth();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new ValidationError('Invalid month format', [
      { field: 'month', message: 'Month must be in YYYY-MM format (e.g., 2025-01)' },
    ]);
  }
  return value;
}

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
      const month = validateMonth(req.query.month as string | undefined);

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
      const period = validatePeriod(req.query.period as string | undefined, 'daily');
      const month = validateMonth(req.query.month as string | undefined);

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
      const period = validatePeriod(req.query.period as string | undefined, 'monthly');
      const month = validateMonth(req.query.month as string | undefined);

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
