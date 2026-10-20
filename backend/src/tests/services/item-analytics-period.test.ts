jest.mock('../../config/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
import pool from '../../config/database';
import { getItemAnalytics } from '../../services/earningsService';
import { ValidationError } from '../../errors';

const query = pool.query as jest.Mock;
beforeEach(() => { query.mockReset(); query.mockResolvedValue({ rows: [] }); });

test.each([
  ['daily', '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z'],
  ['weekly', '2026-09-28T00:00:00.000Z', '2026-10-05T00:00:00.000Z'],
  ['monthly', '2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z'],
] as const)('legacy %s selects its own range instead of the entire month', async (period, start, end) => {
  await getItemAnalytics('restaurant', period, '2026-10');
  expect(query.mock.calls[0][1]).toEqual(['restaurant', start, end]);
});

test.each([
  ['daily', '2026-10-10T18:30:00.000Z', '2026-10-11T18:30:00.000Z'],
  ['weekly', '2026-09-27T18:30:00.000Z', '2026-10-04T18:30:00.000Z'],
  ['monthly', '2026-09-30T18:30:00.000Z', '2026-10-31T18:30:00.000Z'],
] as const)('%s honors local-calendar UTC bounds, including cross-month weeks', async (period, startDate, endDate) => {
  query.mockResolvedValue({ rows: [{ item_name: 'Dish', total_quantity: 3, total_revenue: '300.00' }] });
  const result = await getItemAnalytics('restaurant', period, '2026-10', { startDate, endDate });
  const [sql, params] = query.mock.calls[0];
  expect(params).toEqual(['restaurant', startDate, endDate]);
  expect(sql).toContain('o.restaurant_id = $1');
  expect(sql).toContain("o.status = 'payment_received'");
  expect(sql).toContain('o.created_at >= $2');
  expect(sql).toContain('o.created_at < $3');
  expect(result.items).toEqual([{ itemName: 'Dish', totalQuantity: 3, totalRevenue: '300.00' }]);
});

test.each([
  { startDate: '2026-10-01T00:00:00Z' },
  { startDate: 'bad', endDate: '2026-10-02T00:00:00Z' },
  { startDate: '2026-10-02T00:00:00Z', endDate: '2026-10-01T00:00:00Z' },
  { startDate: '2026-10-01T00:00:00Z', endDate: '2026-11-01T00:00:00Z' },
])('rejects invalid daily bounds before SQL: %j', async bounds => {
  await expect(getItemAnalytics('restaurant', 'daily', '2026-10', bounds)).rejects.toBeInstanceOf(ValidationError);
  expect(query).not.toHaveBeenCalled();
});
