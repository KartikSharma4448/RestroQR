import { Router, Request, Response, NextFunction } from 'express';
import { authRateLimiter } from '../middleware/rateLimiter';
import { registerOwner, login } from '../services/authService';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new restaurant owner account.
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, phone, password, name } = req.body;

    const result = await registerOwner({ email, phone, password, name });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Authenticate an owner or admin with email/phone + password.
 */
router.post(
  '/login',
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, phone, password } = req.body;

      const result = await login({ email, phone, password });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
