jest.mock('../../config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));
jest.mock('bcrypt', () => ({ hash: jest.fn() }));

import pool from '../../config/database';
import bcrypt from 'bcrypt';
import { registerOwner } from '../../services/authService';
import { ConflictError } from '../../errors';

describe('owner signup email reservation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an existing administrator email before hashing or inserting', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'admin-id' }] });
    await expect(registerOwner({
      email: ' Admin@Example.test ', name: 'Owner', password: 'password123',
    })).rejects.toBeInstanceOf(ConflictError);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM admins WHERE LOWER(email) = LOWER($1)'),
      ['Admin@Example.test'],
    );
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });
});
