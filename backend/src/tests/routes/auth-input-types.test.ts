jest.mock('../../config/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
import request from 'supertest';
import app from '../../index';
import pool from '../../config/database';
import { validateRegisterInput, RegisterInput } from '../../services/authService';
import { ValidationError } from '../../errors';

const valid = { name: 'Owner', email: 'owner@example.test', phone: '9999999999', password: 'password123' };

describe('A18 registration rejects non-string fields before database work', () => {
  for (const field of ['name', 'email', 'phone', 'password']) {
    for (const value of [123456789, true, {}, []]) {
      it(`validates ${field} type ${JSON.stringify(value)}`, () => {
        expect(() => validateRegisterInput({ ...valid, [field]: value } as RegisterInput))
          .toThrow(ValidationError);
      });
    }
    it(`returns HTTP 400 with a field-specific ${field} error`, async () => {
      const response = await request(app).post('/api/auth/register').send({ ...valid, [field]: 123456789 });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContainEqual(expect.objectContaining({ field }));
      expect(pool.query).not.toHaveBeenCalled();
    });
  }
});
