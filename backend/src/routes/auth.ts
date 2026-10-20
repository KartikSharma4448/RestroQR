import { Router, Request, Response, NextFunction } from 'express';
import { registerOwner, login } from '../services/authService';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { linkOwnerGoogle, loginOwnerGoogle } from '../services/ownerGoogleAuthService';
import { emailSignupEnabled, startOwnerSignup, verifyOwnerSignup, resendOwnerSignup } from '../services/ownerSignupService';
import pool from '../config/database';

const router = Router();

router.get('/onboarding', authenticate, requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const owner = emailSignupEnabled() ? (await pool.query(
        'SELECT requires_google_link FROM owners WHERE id=$1', [req.user!.sub],
      )).rows[0] : null;
      res.json({ success: true, data: { googleConnectionRequired: owner?.requires_google_link === true } });
    } catch (error) { next(error); }
  });

router.post('/register/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json({ success: true, data: await verifyOwnerSignup(req.body?.challengeId, req.body?.code) });
  } catch (error) { next(error); }
});

router.post('/register/resend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await resendOwnerSignup(req.body?.challengeId) });
  } catch (error) { next(error); }
});

router.post('/google/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await loginOwnerGoogle(req.body?.idToken) });
  } catch (error) { next(error); }
});

router.post('/google/link', authenticate, requireRole('owner'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await linkOwnerGoogle(req.user!.sub, req.body?.idToken) });
    } catch (error) { next(error); }
  });

/**
 * POST /api/auth/register
 * Register a new restaurant owner account.
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, phone, password, name } = req.body ?? {};

    const result = emailSignupEnabled()
      ? await startOwnerSignup({ email, phone, password, name })
      : await registerOwner({ email, phone, password, name });

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
