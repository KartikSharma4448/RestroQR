import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { getRestaurantIdForOwner } from '../../services/categoryService';
import {
  validateFoodItem,
  createFoodItem,
  listFoodItems,
  updateFoodItem,
  deleteFoodItem,
  toggleAvailability,
} from '../../services/foodItemService';

const router = Router();

/**
 * POST /api/owner/items
 * Create a new food item.
 */
router.post(
  '/items',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const { categoryId, name, description, price, badge, imageUrl } = req.body;

      // Validate required fields
      const validated = validateFoodItem({ name, price, badge, description }, true);

      const item = await createFoodItem(restaurantId, categoryId, {
        name: validated.name!,
        description: validated.description !== undefined ? validated.description : (description || null),
        price: validated.price!,
        badge: validated.badge!,
        imageUrl: imageUrl || null,
      });

      res.status(201).json({
        success: true,
        data: { item },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/owner/categories/:id/items
 * List food items in a category.
 */
router.get(
  '/categories/:id/items',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const categoryId = req.params.id as string;

      const items = await listFoodItems(categoryId, restaurantId);

      res.status(200).json({
        success: true,
        data: { items },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/owner/items/:id
 * Update a food item.
 */
router.put(
  '/items/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const itemId = req.params.id as string;
      const { name, description, price, badge, imageUrl } = req.body;

      // Validate only provided fields
      const validated = validateFoodItem({ name, price, badge, description }, false);

      const updateData: {
        name?: string;
        description?: string | null;
        price?: number;
        badge?: 'veg' | 'non_veg';
        imageUrl?: string | null;
      } = { ...validated };

      if (imageUrl !== undefined) {
        updateData.imageUrl = imageUrl;
      }

      const item = await updateFoodItem(itemId, restaurantId, updateData);

      res.status(200).json({
        success: true,
        data: { item },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/owner/items/:id
 * Delete a food item (also delete Cloudinary asset if image exists).
 */
router.delete(
  '/items/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const itemId = req.params.id as string;

      await deleteFoodItem(itemId, restaurantId);

      res.status(200).json({
        success: true,
        data: { message: 'Food item deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/owner/items/:id/availability
 * Toggle food item availability.
 */
router.patch(
  '/items/:id/availability',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const itemId = req.params.id as string;
      const { isAvailable } = req.body;

      const result = await toggleAvailability(itemId, restaurantId, isAvailable);

      res.status(200).json({
        success: true,
        data: { item: result },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
