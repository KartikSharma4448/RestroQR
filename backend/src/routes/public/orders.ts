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
    const { tableToken, items, customerName, customerPhone } = req.body ?? {};

    // Validate required fields
    if (!tableToken || typeof tableToken !== 'string') {
      throw new ValidationError('tableToken is required', [
        { field: 'tableToken', message: 'tableToken is required' },
      ]);
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      throw new ValidationError('At least one item is required', [
        { field: 'items', message: 'Provide between 1 and 50 items' },
      ]);
    }

    // Optional customerPhone validation
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (items.some((item: unknown) => !item || typeof item !== 'object' ||
      !('itemId' in item) || typeof item.itemId !== 'string' || !uuid.test(item.itemId) ||
      !('quantity' in item) || !Number.isSafeInteger(item.quantity) ||
      (item.quantity as number) < 1 || (item.quantity as number) > 100)) {
      throw new ValidationError('Each item needs a valid UUID and integer quantity between 1 and 100');
    }
    if (customerName !== undefined && (typeof customerName !== 'string' || customerName.trim().length > 100)) {
      throw new ValidationError('Customer name must be a string of at most 100 characters');
    }
    if (customerPhone !== undefined) {
      if (typeof customerPhone !== 'string') throw new ValidationError('Phone must be exactly 10 digits');
      const phoneDigits = customerPhone.trim();
      if (!/^\d{10}$/.test(phoneDigits)) {
        throw new ValidationError('Phone must be exactly 10 digits', [
          { field: 'customerPhone', message: 'Phone must be exactly 10 digits' },
        ]);
      }
    }

    // Create the order (handles token decryption, validation, price calculation, and customer details)
    const order = await createOrder(
      tableToken,
      items,
      customerName?.trim(),
      customerPhone?.trim()
    );

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
