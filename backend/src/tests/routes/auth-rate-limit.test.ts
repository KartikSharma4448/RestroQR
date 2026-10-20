jest.mock('../../config/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
import request from 'supertest';
import app from '../../index';
import pool from '../../config/database';

test('A17 auth requests count once and login/register share the ten-request limit', async () => {
  for (let i = 0; i < 10; i++) {
    const response = await request(app).post(i % 2 === 0 ? '/api/auth/login' : '/api/auth/register').send({});
    expect(response.status).toBe(400);
    expect(Number(response.headers['ratelimit-remaining'])).toBe(9 - i);
  }
  const limited = await request(app).post('/api/auth/login').send({});
  expect(limited.status).toBe(429);
  expect(limited.body.error.code).toBe('RATE_LIMITED');
  expect(pool.query).not.toHaveBeenCalled();
});
