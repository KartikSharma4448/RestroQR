jest.mock('../../config/database', () => ({ __esModule: true, default: { query: jest.fn() } }));

import pool from '../../config/database';
import { getOrderHistory } from '../../services/earningsService';
import { ValidationError } from '../../errors';

const query = pool.query as jest.Mock;
const startDate = '2026-10-01T18:30:00.000Z';
const endDate = '2026-10-03T18:30:00.000Z';

beforeEach(() => query.mockReset());

test('applies tenant, status and date bounds to both count and paginated rows', async () => {
  query.mockResolvedValueOnce({ rows: [{ total: 25 }] }).mockResolvedValueOnce({ rows: [] });
  const result = await getOrderHistory('restaurant', { page: 2, pageSize: 20, status: 'completed', startDate, endDate });
  const [countSql, countParams] = query.mock.calls[0];
  const [rowsSql, rowsParams] = query.mock.calls[1];
  for (const sql of [countSql, rowsSql]) {
    expect(sql).toContain('o.restaurant_id = $1');
    expect(sql).toContain('o.status = $2');
    expect(sql).toContain('o.created_at >= $3');
    expect(sql).toContain('o.created_at < $4');
  }
  expect(countParams).toEqual(['restaurant', 'completed', startDate, endDate]);
  expect(rowsParams).toEqual([...countParams, 20, 20]);
  expect(rowsSql).toContain('ORDER BY o.created_at DESC, o.id DESC');
  expect(rowsSql).toContain('LIMIT $5 OFFSET $6');
  expect(result).toEqual({ orders: [], total: 25, page: 2, pageSize: 20 });
});

test('keeps the unfiltered history response backward compatible', async () => {
  query.mockResolvedValueOnce({ rows: [{ total: 0 }] }).mockResolvedValueOnce({ rows: [] });
  expect(await getOrderHistory('restaurant', {})).toEqual({ orders: [], total: 0, page: 1, pageSize: 20 });
  expect(query.mock.calls[0][1]).toEqual(['restaurant']);
  expect(query.mock.calls[1][1]).toEqual(['restaurant', 20, 0]);
});

test.each([
  { startDate: 'not-a-date' },
  { startDate: '2026-02-30T00:00:00Z' },
  { endDate: '2026-10-01' },
  { startDate: endDate, endDate: startDate },
  { startDate, endDate: startDate },
])('rejects invalid or reversed date bounds before database access: %j', async options => {
  await expect(getOrderHistory('restaurant', options)).rejects.toBeInstanceOf(ValidationError);
  expect(query).not.toHaveBeenCalled();
});

test('caps page size to 100 and defaults invalid page numbers', async () => {
  query.mockResolvedValueOnce({ rows: [{ total: 0 }] }).mockResolvedValueOnce({ rows: [] });
  const result = await getOrderHistory('restaurant', { page: NaN, pageSize: 10000, startDate });
  expect(result.page).toBe(1);
  expect(result.pageSize).toBe(100);
  expect(query.mock.calls[1][1]).toEqual(['restaurant', startDate, 100, 0]);
});
