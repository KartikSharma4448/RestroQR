import { Router, Request, Response, NextFunction } from 'express';
import { createOrder } from '../../services/orderService';
import { sendOrderNotification } from '../../services/notificationService';
import { ValidationError } from '../../errors';
import pool from '../../config/database';

const router = Router();

/**
 * POST /api/public/orders
 * Public endpoint — no authentication required.
 * Creates a new order for a table identified by its encrypted token.
 *
 * Body: { tableToken: string, items: [{ itemId: string, quantity: number }] }
 *
 * SECURITY: Rate limited via publicRateLimiter applied globally.
 * All token/table errors return generic responses to prevent enumeration.
 */
router.post('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tableToken, items } = req.body;

    // Validate required fields
    if (!tableToken || typeof tableToken !== 'string') {
      throw new ValidationError('tableToken is required', [
        { field: 'tableToken', message: 'tableToken is required' },
      ]);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required', [
        { field: 'items', message: 'At least one item is required' },
      ]);
    }

    // Create the order (handles token decryption, validation, and price calculation)
    const order = await createOrder(tableToken, items);

    // Fire-and-forget: send push notification to the restaurant owner
    // Fetch table display name for the notification
    pool
      .query('SELECT display_name FROM tables WHERE id = $1', [order.tableId])
      .then((tableResult) => {
        const tableName = tableResult.rows[0]?.display_name || 'Unknown Table';
        sendOrderNotification(order.restaurantId, tableName, order.total).catch(() => {
          // Notification failures are already logged inside the service
        });
      })
      .catch(() => {
        // If table lookup fails, skip notification silently
      });

    // Return 201 with order confirmation
    res.status(201).json({
      success: true,
      data: {
        orderRef: order.orderRef,
        total: order.total,
        status: order.status,
        items: order.items.map((item) => ({
          name: item.itemName,
          quantity: item.quantity,
          price: item.itemPrice,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
