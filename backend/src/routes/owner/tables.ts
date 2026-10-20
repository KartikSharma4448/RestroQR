import { Router, Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import { AuthenticatedRequest } from '../../middleware/auth';
import { getRestaurantIdForOwner } from '../../services/categoryService';
import {
  createTable,
  listTables,
  updateTable,
  deleteTable,
  getTableQrUrl,
} from '../../services/tableService';

const router = Router();

/**
 * POST /api/owner/tables
 * Create a new table for the authenticated owner's restaurant.
 * Validates that the restaurant's qr_mode is 'multi'.
 */
router.post(
  '/tables',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const { displayName } = req.body;

      const table = await createTable(restaurantId, displayName);

      res.status(201).json({
        success: true,
        data: { table },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/owner/tables
 * List all tables for the authenticated owner's restaurant.
 */
router.get(
  '/tables',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);

      const tables = await listTables(restaurantId);

      res.status(200).json({
        success: true,
        data: { tables },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/owner/tables/:id
 * Update a table's display name.
 */
router.patch(
  '/tables/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const tableId = req.params.id as string;
      const { displayName } = req.body;

      const table = await updateTable(tableId, restaurantId, displayName);

      res.status(200).json({
        success: true,
        data: { table },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/owner/tables/:id
 * Delete a table.
 */
router.delete(
  '/tables/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const tableId = req.params.id as string;

      await deleteTable(tableId, restaurantId);

      res.status(200).json({
        success: true,
        data: { message: 'Table deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/owner/tables/:id/qr
 * Generate and return a QR code PNG for the table's public URL.
 */
router.get(
  '/tables/:id/qr',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurantId = await getRestaurantIdForOwner(ownerId);
      const tableId = req.params.id as string;

      const qrUrl = await getTableQrUrl(tableId, restaurantId);

      // Build the full URL using the CUSTOMER_BASE_URL env variable or a default
      const baseUrl = process.env.CUSTOMER_BASE_URL || 'https://restro-qr-peach.vercel.app';
      const fullUrl = `${baseUrl}${qrUrl}`;

      // Generate QR code as PNG buffer
      const pngBuffer = await QRCode.toBuffer(fullUrl, {
        type: 'png',
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'M',
      });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `inline; filename="table-${tableId}-qr.png"`);
      res.status(200).send(pngBuffer);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
