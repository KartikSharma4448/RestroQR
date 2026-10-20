jest.mock('../../config/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
import pool from '../../config/database';
import { moneyCents, validateMenuOptions, validateOptionSelections, priceSelection, saveMenuOptions, priceLockedSelections, optionSummary } from '../../services/menuOptionsService';

const dish = '11111111-1111-4111-8111-111111111111';
const small = '22222222-2222-4222-8222-222222222222';
const large = '33333333-3333-4333-8333-333333333333';
const cheese = '44444444-4444-4444-8444-444444444444';
const prior = process.env.MENU_OPTIONS_ENABLED;
beforeEach(() => { jest.resetAllMocks(); process.env.MENU_OPTIONS_ENABLED = 'true'; });
afterAll(() => { if (prior === undefined) delete process.env.MENU_OPTIONS_ENABLED; else process.env.MENU_OPTIONS_ENABLED = prior; });
const catalog = () => validateMenuOptions({ variants: [{ id: small, name: 'Small', price: '100.10' },
  { id: large, name: 'Large', price: '180.20' }], addOns: [{ id: cheese, name: 'Cheese', price: '20.30' }] });

it('normalizes server-generated IDs, prices and optional availability', () => {
  const result = validateMenuOptions({ variants: [{ name: ' Small ', price: 100 }], addOns: [{ name: 'No spice', price: 0, isAvailable: false }] });
  expect(result.variants[0]).toMatchObject({ name: 'Small', price: '100.00', isAvailable: true });
  expect(result.variants[0].id).toMatch(/^[0-9a-f-]{36}$/);
  expect(result.addOns[0]).toMatchObject({ price: '0.00', isAvailable: false });
});
it.each([NaN, Infinity, -1, '1x', true, null, '', '1.001', '1000000', {}, '1e2'])('rejects unsafe money %j', value => {
  expect(() => moneyCents(value)).toThrow();
});
it('requires a positive size price but allows free add-ons', () => {
  expect(() => moneyCents(0)).toThrow(); expect(moneyCents(0, true)).toBe(0);
});
it('rejects duplicate names, IDs and incorrectly typed availability', () => {
  expect(() => validateMenuOptions({ variants: [{ name: 'Small', price: 1 }, { name: ' small ', price: 2 }], addOns: [] })).toThrow();
  expect(() => validateMenuOptions({ variants: [{ id: small, name: 'Small', price: 1 }], addOns: [{ id: small, name: 'Cheese', price: 1 }] })).toThrow();
  expect(() => validateMenuOptions({ variants: [{ name: 'Small', price: 1, isAvailable: 'true' }], addOns: [] })).toThrow();
});
it('rejects excessive option counts and invalid names', () => {
  expect(() => validateMenuOptions({ variants: Array.from({ length: 13 }, (_, i) => ({ name: String(i), price: 1 })), addOns: [] })).toThrow();
  expect(() => validateMenuOptions({ variants: [], addOns: [{ name: 'x'.repeat(61), price: 0 }] })).toThrow();
});
it('prices sizes as absolute prices and add-ons as increments in cents', () => {
  const result = priceSelection('500.00', catalog(), { itemId: dish, quantity: 2, variantId: large, addOnIds: [cheese] });
  expect(result.price).toBe('200.50'); expect(result.cents).toBe(20050);
  expect(optionSummary(result.snapshot)).toBe('Large, + Cheese');
});
it('requires a valid available size and rejects foreign or disabled add-ons', () => {
  expect(() => priceSelection('1.00', catalog(), { itemId: dish, quantity: 1 })).toThrow();
  const options = catalog(); options.variants[0].isAvailable = false;
  expect(() => priceSelection('1.00', options, { itemId: dish, quantity: 1, variantId: small })).toThrow();
  expect(() => priceSelection('1.00', catalog(), { itemId: dish, quantity: 1, variantId: large, addOnIds: [small] })).toThrow();
  options.addOns[0].isAvailable = false;
  expect(() => priceSelection('1.00', options, { itemId: dish, quantity: 1, variantId: large, addOnIds: [cheese] })).toThrow();
});
it('rejects configured unit-price overflow', () => {
  const options = catalog(); options.variants[0].price = '999999.99';
  expect(() => priceSelection('1.00', options, { itemId: dish, quantity: 1, variantId: small, addOnIds: [cheese] })).toThrow();
});
it('allows different combinations but refuses duplicate lines and duplicate add-ons', () => {
  expect(() => validateOptionSelections([{ itemId: dish, quantity: 1, variantId: small }, { itemId: dish, quantity: 1, variantId: large }])).not.toThrow();
  expect(() => validateOptionSelections([{ itemId: dish, quantity: 1, addOnIds: [cheese, cheese] }])).toThrow();
  expect(() => validateOptionSelections([{ itemId: dish, quantity: 1, variantId: small }, { itemId: dish, quantity: 2, variantId: small }])).toThrow();
  expect(() => validateOptionSelections([{ itemId: dish, quantity: 1, addOnIds: 'bad' as unknown as string[] }])).toThrow();
});
it('fails closed when options are disabled', async () => {
  process.env.MENU_OPTIONS_ENABLED = 'false';
  await expect(saveMenuOptions(dish, 'restaurant', { variants: [], addOns: [] })).rejects.toMatchObject({ statusCode: 503 });
  expect(() => validateOptionSelections([{ itemId: dish, quantity: 1, variantId: small }])).toThrow();
  expect(() => validateOptionSelections([{ itemId: dish, quantity: 1 }])).not.toThrow();
  expect(pool.query).not.toHaveBeenCalled();
});
it('writes options only within the authenticated restaurant', async () => {
  (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
  await expect(saveMenuOptions(dish, 'other', { variants: [], addOns: [] })).rejects.toMatchObject({ statusCode: 404 });
  expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('restaurant_id=$3'), [expect.any(String), dish, 'other']);
});
it('locks current catalog rows before authoritative pricing', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [{ id: dish, name: 'Pizza', price: '500.00', is_available: true, menu_options: catalog() }] });
  const result = await priceLockedSelections({ query } as never, 'restaurant', [{ itemId: dish, quantity: 1, variantId: large, addOnIds: [cheese] }]);
  expect(query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY id FOR SHARE'), [[dish], 'restaurant']);
  expect(result[0].price).toBe('200.50');
});
