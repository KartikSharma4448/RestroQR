import { Router, Request, Response, NextFunction } from 'express';
import { getPublicMenu } from '../../services/publicMenuService';
import { getPublicOrderBoard } from '../../services/publicOrderBoardService';

const router = Router();

router.get('/order-board/:token', async (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    res.json({ success: true, data: await getPublicOrderBoard(req.params.token as string) });
  } catch (error) { next(error); }
});

/**
 * GET /api/public/menu/:token
 * Public endpoint — no authentication required.
 * Returns the full menu for a restaurant identified by its QR token.
 *
 * SECURITY: All error cases (invalid format, non-existent, disabled)
 * return an identical 404 response with no internal info leakage.
 */
router.get('/menu/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token as string;

    const menuData = await getPublicMenu(token);

    res.status(200).json({
      success: true,
      data: menuData,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
