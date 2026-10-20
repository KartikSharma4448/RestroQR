import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { AuthenticatedRequest } from '../../middleware/auth';
import {
  createRestaurant,
  getRestaurantByOwner,
  updateRestaurant,
  uploadImages,
  UploadedFile,
} from '../../services/ownerRestaurantService';

const router = Router();

// Multer configuration — memory storage for buffer access
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/**
 * POST /api/owner/restaurant
 * Create a new restaurant profile.
 */
router.post(
  '/restaurant',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const { name, address, phone } = req.body;

      const restaurant = await createRestaurant({
        name,
        address,
        phone,
        ownerId,
      });

      res.status(201).json({
        success: true,
        data: {
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            address: restaurant.address,
            phone: restaurant.phone,
            restaurantToken: restaurant.restaurantToken,
            status: restaurant.status,
            createdAt: restaurant.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/owner/restaurant
 * Get own restaurant profile.
 */
router.get(
  '/restaurant',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const restaurant = await getRestaurantByOwner(ownerId);

      res.status(200).json({
        success: true,
        data: { restaurant },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/owner/restaurant
 * Update restaurant profile. Token cannot be modified.
 */
router.put(
  '/restaurant',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const { name, address, phone } = req.body;

      const restaurant = await updateRestaurant(ownerId, { name, address, phone });

      res.status(200).json({
        success: true,
        data: { restaurant },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/owner/restaurant/images
 * Upload logo and/or cover image.
 */
router.post(
  '/restaurant/images',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.sub;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      const logoFile = files?.logo?.[0];
      const coverFile = files?.cover?.[0];

      const uploadedFiles: { logo?: UploadedFile; cover?: UploadedFile } = {};

      if (logoFile) {
        uploadedFiles.logo = {
          fieldname: logoFile.fieldname,
          originalname: logoFile.originalname,
          mimetype: logoFile.mimetype,
          size: logoFile.size,
          buffer: logoFile.buffer,
        };
      }

      if (coverFile) {
        uploadedFiles.cover = {
          fieldname: coverFile.fieldname,
          originalname: coverFile.originalname,
          mimetype: coverFile.mimetype,
          size: coverFile.size,
          buffer: coverFile.buffer,
        };
      }

      const result = await uploadImages(ownerId, uploadedFiles);

      res.status(200).json({
        success: true,
        data: {
          logoUrl: result.logoUrl,
          coverImageUrl: result.coverImageUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
