import supertest from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { errorHandler } from '../../middleware/errorHandler';

/**
 * Rate Limiting Integration Tests.
 *
 * These tests create fresh rate limiter instances per test suite to avoid
 * shared state. We use the same configuration as the production limiters.
 */

describe('Rate Limiting Integration Tests', () => {
  describe('Public Rate Limiter (60 req/min)', () => {
    let rateLimitApp: express.Express;

    beforeEach(() => {
      // Create fresh rate limiter for each test
      const freshPublicLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 60,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => {
          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests, please try again shortly',
            },
          });
        },
      });

      rateLimitApp = express();
      rateLimitApp.use(freshPublicLimiter);
      rateLimitApp.get('/test', (_req, res) => {
        res.json({ success: true, data: { message: 'ok' } });
      });
      rateLimitApp.use(errorHandler);
    });

    it('should allow requests under the rate limit', async () => {
      const res = await supertest(rateLimitApp).get('/test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 429 with correct error format after exceeding limit', async () => {
      // Send 60 requests to exhaust the limit
      for (let i = 0; i < 60; i++) {
        await supertest(rateLimitApp).get('/test');
      }

      // The 61st request should be rate limited
      const res = await supertest(rateLimitApp).get('/test');

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests, please try again shortly',
        },
      });
    });

    it('should include standard rate limit headers', async () => {
      const res = await supertest(rateLimitApp).get('/test');

      expect(res.status).toBe(200);
      // express-rate-limit v7+ uses standard headers
      expect(res.headers).toHaveProperty('ratelimit-limit');
      expect(res.headers).toHaveProperty('ratelimit-remaining');
    });

    it('should show decreasing remaining count with each request', async () => {
      const res1 = await supertest(rateLimitApp).get('/test');
      const remaining1 = parseInt(res1.headers['ratelimit-remaining'], 10);

      const res2 = await supertest(rateLimitApp).get('/test');
      const remaining2 = parseInt(res2.headers['ratelimit-remaining'], 10);

      expect(remaining2).toBe(remaining1 - 1);
    });
  });

  describe('Auth Rate Limiter (10 req/min)', () => {
    let authApp: express.Express;

    beforeEach(() => {
      // Create fresh auth rate limiter for each test
      const freshAuthLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => {
          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests, please try again shortly',
            },
          });
        },
      });

      authApp = express();
      authApp.use(express.json());
      authApp.post('/auth/login', freshAuthLimiter, (_req, res) => {
        res.json({ success: true, data: { message: 'login ok' } });
      });
      authApp.use(errorHandler);
    });

    it('should allow requests under the auth rate limit', async () => {
      const res = await supertest(authApp)
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'pass' });

      expect(res.status).toBe(200);
    });

    it('should return 429 after exceeding auth rate limit (10 req/min)', async () => {
      // Send 10 requests to exhaust the auth limit
      for (let i = 0; i < 10; i++) {
        await supertest(authApp)
          .post('/auth/login')
          .send({ email: 'test@test.com', password: 'pass' });
      }

      // The 11th request should be rate limited
      const res = await supertest(authApp)
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'pass' });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RATE_LIMITED');
      expect(res.body.error.message).toBe('Too many requests, please try again shortly');
    });

    it('should have a stricter limit than public routes', async () => {
      // Verify the auth limiter has limit of 10
      const res = await supertest(authApp)
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'pass' });

      const limit = parseInt(res.headers['ratelimit-limit'], 10);
      expect(limit).toBe(10);
    });
  });
});
