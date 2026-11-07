import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { getRestaurantIdForOwner } from '../../services/categoryService';
import {
  getMonthlyReport,
  createInvestment,
  updateInvestment,
  deleteInvestment,
} from '../../services/investmentService';
import { ValidationError } from '../../errors';

const router = Router();

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function validateMonth(value: unknown): string {
  if (value === undefined) return currentMonth();
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new ValidationError('Invalid month format', [
      { field: 'month', message: 'Month must be in YYYY-MM format (e.g., 2025-01)' },
    ]);
  }
  return value;
}

/**
 * GET /api/owner/investments?month=YYYY-MM
 * Investment list for the month with total investment, revenue and net profit.
 */
router.get('/investments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-store');
  try {
    const restaurantId = await getRestaurantIdForOwner(req.user!.sub);
    const data = await getMonthlyReport(restaurantId, validateMonth(req.query.month));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /api/owner/investments  Body: { topic, amount, spentOn: "YYYY-MM-DD" } */
router.post('/investments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const restaurantId = await getRestaurantIdForOwner(req.user!.sub);
    const investment = await createInvestment(restaurantId, req.body ?? {});
    res.status(201).json({ success: true, data: { investment } });
  } catch (error) {
    next(error);
  }
});

/** PUT /api/owner/investments/:id  Body: { topic, amount, spentOn } */
router.put('/investments/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const restaurantId = await getRestaurantIdForOwner(req.user!.sub);
    const investment = await updateInvestment(restaurantId, req.params.id as string, req.body ?? {});
    res.status(200).json({ success: true, data: { investment } });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/owner/investments/:id */
router.delete('/investments/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const restaurantId = await getRestaurantIdForOwner(req.user!.sub);
    await deleteInvestment(restaurantId, req.params.id as string);
    res.status(200).json({ success: true, data: { message: 'Investment deleted' } });
  } catch (error) {
    next(error);
  }
});

export default router;
