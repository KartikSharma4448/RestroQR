import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import {
  getRestaurantIdForOwner,
  createCategory,
  listCategories,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from '../../services/categoryService';

const router = Router();

/**
 * POST /api/owner/categories
 * Create a new category.
 */
router.post(
  '/categories',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const { name } = req.body;

      const category = await createCategory(restaurantId, name);

      res.status(201).json({
        success: true,
        data: {
          category: {
            id: category.id,
            name: category.name,
            displayOrder: category.displayOrder,
            createdAt: category.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/owner/categories
 * List all categories ordered by display_order.
 */
router.get(
  '/categories',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);

      const categories = await listCategories(restaurantId);

      res.status(200).json({
        success: true,
        data: { categories },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/owner/categories/reorder
 * Reorder categories by providing array of category IDs.
 * NOTE: This must be defined BEFORE :id routes to avoid matching "reorder" as an ID.
 */
router.put(
  '/categories/reorder',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const { categoryIds } = req.body;

      const categories = await reorderCategories(restaurantId, categoryIds);

      res.status(200).json({
        success: true,
        data: { categories },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/owner/categories/:id
 * Update a category name.
 */
router.put(
  '/categories/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const id = req.params.id as string;
      const { name } = req.body;

      const category = await updateCategory(id, restaurantId, name);

      res.status(200).json({
        success: true,
        data: { category },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/owner/categories/:id
 * Delete a category (cascade to food items via FK).
 */
router.delete(
  '/categories/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const id = req.params.id as string;

      await deleteCategory(id, restaurantId);

      res.status(200).json({
        success: true,
        data: { message: 'Category deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
