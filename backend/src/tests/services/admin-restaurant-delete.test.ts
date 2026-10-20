jest.mock('../../config/database', () => ({
  __esModule: true, default: { query: jest.fn() },
}));
import pool from '../../config/database';
import { deleteRestaurant } from '../../services/adminRestaurantService';

const query = pool.query as jest.Mock;
beforeEach(() => {
  query.mockReset();
  query.mockResolvedValueOnce({ rows: [{ id: 'sample', logo_url: null, cover_image_url: null }] });
  query.mockResolvedValueOnce({ rows: [] });
});

it('deletes a restaurant without linked records using a parameterized query', async () => {
  query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
  await expect(deleteRestaurant('sample')).resolves.toBeUndefined();
  expect(query).toHaveBeenLastCalledWith('DELETE FROM restaurants WHERE id = $1', ['sample']);
});

it('returns a conflict for a foreign-key restriction without clearing order history', async () => {
  query.mockRejectedValueOnce(Object.assign(new Error('restricted'), { code: '23503' }));
  await expect(deleteRestaurant('sample')).rejects.toMatchObject({
    statusCode: 409,
    message: expect.stringContaining('Disable it instead'),
  });
  expect(query.mock.calls.some(([sql]) => /DELETE FROM (orders|order_items)/.test(sql))).toBe(false);
});

it('preserves unexpected database errors', async () => {
  const error = new Error('database unavailable');
  query.mockRejectedValueOnce(error);
  await expect(deleteRestaurant('sample')).rejects.toBe(error);
});

it('does not attempt deletion when the restaurant does not exist', async () => {
  query.mockReset();
  query.mockResolvedValueOnce({ rows: [] });
  await expect(deleteRestaurant('missing')).rejects.toMatchObject({ statusCode: 404 });
  expect(query).toHaveBeenCalledTimes(1);
});

