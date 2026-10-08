jest.mock('../../config/database', () => ({
  __esModule: true, default: { query: jest.fn() },
}));
import pool from '../../config/database';
import { createTable, decryptTableToken } from '../../services/tableService';

const query = pool.query as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.TABLE_TOKEN_SECRET = 'table-create-local-test-secret-2026';
  query.mockImplementation(async (sql: string, values: string[]) => {
    if (sql.includes('SELECT qr_mode')) return { rows: [{ qr_mode: 'multi' }] };
    if (sql.includes('SELECT id FROM tables')) return { rows: [] };
    if (sql.includes('INSERT INTO tables')) return { rows: [{
      id: values[0], restaurant_id: values[1], display_name: values[2], table_token: values[3],
      created_at: new Date(), updated_at: new Date(),
    }] };
    throw new Error('Unexpected table write');
  });
});

it('creates distinct, fully valid QR tokens with one insert each under concurrency', async () => {
  const restaurantId = '550e8400-e29b-41d4-a716-446655440000';
  const [first, second] = await Promise.all([
    createTable(restaurantId, 'Table 1'), createTable(restaurantId, 'Table 2'),
  ]);
  expect(first.id).not.toBe(second.id);
  expect(first.tableToken).not.toBe(second.tableToken);
  for (const table of [first, second]) {
    expect(decryptTableToken(table.tableToken)).toEqual({ restaurantId, tableId: table.id });
  }
  expect(query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO tables'))).toHaveLength(2);
  expect(query.mock.calls.some(([sql]) => sql.includes('UPDATE tables'))).toBe(false);
});

it('does not insert a broken placeholder when encryption is misconfigured', async () => {
  delete process.env.TABLE_TOKEN_SECRET;
  await expect(createTable('restaurant', 'Table 1')).rejects.toThrow('TABLE_TOKEN_SECRET');
  expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO tables'))).toBe(false);
});
