import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { listOwners, getOwnerById, updateOwnerStatus } from '../../services/adminOwnerService';

const router = Router();

/**
 * GET /api/admin/owners
 * List all owner accounts (name, email/phone, status).
 */
router.get('/', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const owners = await listOwners();

    res.status(200).json({
      success: true,
      data: { owners },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/owners/:id
 * Get full owner details with associated restaurant.
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const owner = await getOwnerById(req.params.id as string);

    res.status(200).json({
      success: true,
      data: { owner },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/owners/:id/status
 * Enable or disable an owner account.
 */
router.patch('/:id/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const owner = await updateOwnerStatus(req.params.id as string, status);

    res.status(200).json({
      success: true,
      data: { owner },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
