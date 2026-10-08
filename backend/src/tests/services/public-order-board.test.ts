jest.mock('../../config/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
import pool from '../../config/database';
import { getPublicOrderBoard } from '../../services/publicOrderBoardService';
const query = pool.query as jest.Mock;
beforeEach(() => jest.resetAllMocks());

it('rejects invalid tokens without querying data', async () => {
  await expect(getPublicOrderBoard('../bad')).rejects.toThrow('Order board not found');
  expect(query).not.toHaveBeenCalled();
});
it('does not retrieve orders for absent or disabled restaurants/owners', async () => {
  query.mockResolvedValueOnce({ rows: [] });
  await expect(getPublicOrderBoard('validToken123')).rejects.toThrow('Order board not found');
  expect(query).toHaveBeenCalledTimes(1);
  expect(query.mock.calls[0][0]).toContain("o.status = 'active'");
  expect(query.mock.calls[0][0]).toContain("r.status = 'active'");
});
it('scopes the query and exposes only public fields with masked names', async () => {
  query.mockResolvedValueOnce({ rows: [{ id: 'restaurant-a' }] });
  query.mockResolvedValueOnce({ rows: [
    { order_ref: 'ORD-ABC123', table_name: 'Table 4', status: 'accepted', customer_name: 'Kartik Sharma', customer_phone: 'private', total: '900' },
    { order_ref: 'ORD-DEF456', table_name: 'Table 5', status: 'pending', customer_name: null },
  ] });
  expect(await getPublicOrderBoard('validToken123')).toEqual([
    { orderRef: 'ORD-ABC123', tableName: 'Table 4', status: 'accepted', customerName: 'K. S.' },
    { orderRef: 'ORD-DEF456', tableName: 'Table 5', status: 'pending', customerName: 'Guest' },
  ]);
  expect(query.mock.calls[1][1]).toEqual(['restaurant-a']);
  expect(query.mock.calls[1][0]).toContain('LIMIT 100');
  expect(query.mock.calls[1][0]).toContain("INTERVAL '24 hours'");
  expect(query.mock.calls[1][0]).not.toContain('customer_phone');
});
