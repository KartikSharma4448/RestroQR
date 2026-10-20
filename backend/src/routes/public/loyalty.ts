import { Router } from 'express';

const router = Router();

// Customer identity verification is required before exposing private rewards data.
router.get('/loyalty/:phone', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(403).json({
    success: false,
    error: {
      code: 'CUSTOMER_VERIFICATION_REQUIRED',
      message: 'Rewards lookup is unavailable until customer verification is enabled.',
    },
  });
});

export default router;
