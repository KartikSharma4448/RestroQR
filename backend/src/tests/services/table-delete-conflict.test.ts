jest.mock('../../config/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
import pool from '../../config/database';
import { deleteTable } from '../../services/tableService';
import { ConflictError, NotFoundError } from '../../errors';

describe('table deletion preserves order history', () => {
  beforeEach(() => jest.resetAllMocks());
  it('translates a foreign key constraint into a useful 409 conflict', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'table' }] })
      .mockRejectedValueOnce({ code: '23503' });
    await expect(deleteTable('table', 'restaurant')).rejects.toMatchObject({
      statusCode: 409, message: expect.stringContaining('order history'),
    });
    expect(pool.query).toHaveBeenLastCalledWith(
      'DELETE FROM tables WHERE id = $1 AND restaurant_id = $2', ['table', 'restaurant']);
  });
  it('deletes an unreferenced owned table normally', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'table' }] })
      .mockResolvedValueOnce({ rowCount: 1 });
    await expect(deleteTable('table', 'restaurant')).resolves.toBeUndefined();
  });
  it('never deletes a missing or other-owner table', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await expect(deleteTable('table', 'other')).rejects.toBeInstanceOf(NotFoundError);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
  it('does not disguise unrelated database failures as conflicts', async () => {
    const failure = new Error('connection lost');
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'table' }] })
      .mockRejectedValueOnce(failure);
    await expect(deleteTable('table', 'restaurant')).rejects.toBe(failure);
    expect(failure).not.toBeInstanceOf(ConflictError);
  });
});
