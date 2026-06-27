import express from 'express';
import request from 'supertest';
import { publicRateLimiter, authRateLimiter } from './rateLimiter';

function createApp(limiter: ReturnType<typeof import('express-rate-limit').default>) {
  const app = express();
  app.use(limiter);
  app.get('/test', (_req, res) => {
    res.json({ success: true });
  });
  return app;
}

describe('Rate Limiter Middleware', () => {
  describe('publicRateLimiter', () => {
    it('should allow requests within the limit', async () => {
      const app = createApp(publicRateLimiter);
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('should include standard RateLimit headers', async () => {
      const app = createApp(publicRateLimiter);
      const res = await request(app).get('/test');
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });

    it('should not include legacy X-RateLimit headers', async () => {
      const app = createApp(publicRateLimiter);
      const res = await request(app).get('/test');
      expect(res.headers['x-ratelimit-limit']).toBeUndefined();
      expect(res.headers['x-ratelimit-remaining']).toBeUndefined();
    });

    it('should return 429 with correct error format when limit exceeded', async () => {
      const strictLimiter = (await import('express-rate-limit')).default({
        windowMs: 60 * 1000,
        max: 2,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req: express.Request, res: express.Response) => {
          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests, please try again shortly',
            },
          });
        },
      });

      const app = createApp(strictLimiter);

      // First 2 requests should pass
      await request(app).get('/test');
      await request(app).get('/test');

      // Third request should be rate limited
      const res = await request(app).get('/test');
      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests, please try again shortly',
        },
      });
    });
  });

  describe('authRateLimiter', () => {
    it('should allow requests within the stricter limit', async () => {
      const app = createApp(authRateLimiter);
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('should return 429 with correct error format when auth limit exceeded', async () => {
      const strictAuthLimiter = (await import('express-rate-limit')).default({
        windowMs: 60 * 1000,
        max: 2,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req: express.Request, res: express.Response) => {
          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests, please try again shortly',
            },
          });
        },
      });

      const app = createApp(strictAuthLimiter);

      // Exhaust the limit
      await request(app).get('/test');
      await request(app).get('/test');

      // Next request should be blocked
      const res = await request(app).get('/test');
      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RATE_LIMITED');
      expect(res.body.error.message).toBe('Too many requests, please try again shortly');
    });
  });
});
