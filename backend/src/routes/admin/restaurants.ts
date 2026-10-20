import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import {
  listRestaurants,
  getRestaurantById,
  updateRestaurant,
  updateRestaurantStatus,
  deleteRestaurant,
  parsePaginationParams,
} from '../../services/adminRestaurantService';

const router = Router();

/**
 * GET /api/admin/restaurants
 * Paginated list of all restaurants with owner names.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const params = parsePaginationParams(req.query as { page?: string; pageSize?: string });
    const result = await listRestaurants(params);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/restaurants/:id
 * Full restaurant profile with owner details.
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const restaurant = await getRestaurantById(req.params.id as string);

    res.status(200).json({
      success: true,
      data: { restaurant },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/restaurants/:id
 * Edit restaurant details (name, address, phone).
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, address, phone } = req.body;
    const restaurant = await updateRestaurant(req.params.id as string, { name, address, phone });

    res.status(200).json({
      success: true,
      data: { restaurant },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/restaurants/:id/status
 * Enable or disable a restaurant.
 */
router.patch('/:id/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const restaurant = await updateRestaurantStatus(req.params.id as string, status);

    res.status(200).json({
      success: true,
      data: { restaurant },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/restaurants/:id
 * Delete restaurant and cascade all associated data.
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await deleteRestaurant(req.params.id as string);

    res.status(200).json({
      success: true,
      data: { message: 'Restaurant deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
