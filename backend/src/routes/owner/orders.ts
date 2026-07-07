import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { getRestaurantIdForOwner } from '../../services/categoryService';
import {
  getOrders,
  updateOrderStatus,
  cancelOrder,
  OrderStatus,
} from '../../services/orderService';

import { ValidationError } from '../../errors';

const router = Router();

const VALID_ORDER_STATUSES: OrderStatus[] = ['pending', 'accepted', 'completed', 'payment_received', 'cancelled'];

/**
 * GET /api/owner/orders
 * List orders for the authenticated owner's restaurant.
 * Query params:
 *   - status (optional): filter by order status
 *   - page (optional): page number (default 1)
 *   - pageSize (optional): items per page (default 20, max 100)
 */
router.get(
  '/orders',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);

      const statusParam = req.query.status as string | undefined;
      let status: OrderStatus | undefined;
      if (statusParam) {
        if (!VALID_ORDER_STATUSES.includes(statusParam as OrderStatus)) {
          throw new ValidationError('Invalid status value', [
            { field: 'status', message: `Status must be one of: ${VALID_ORDER_STATUSES.join(', ')}` },
          ]);
        }
        status = statusParam as OrderStatus;
      }
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined;

      const result = await getOrders(restaurantId, { status, page, pageSize });

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
 * PATCH /api/owner/orders/:id/status
 * Update the status of an order.
 * Body: { "status": "accepted" | "completed" | "payment_received" }
 */
router.patch(
  '/orders/:id/status',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const orderId = req.params.id as string;
      const { status } = req.body;

      const order = await updateOrderStatus(orderId, restaurantId, status);

      res.status(200).json({
        success: true,
        data: { order },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/owner/orders/:id/cancel
 * Cancel an order.
 */
router.post(
  '/orders/:id/cancel',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const orderId = req.params.id as string;

      const order = await cancelOrder(orderId, restaurantId);

      res.status(200).json({
        success: true,
        data: { order },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
