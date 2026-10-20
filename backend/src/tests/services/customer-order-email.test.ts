jest.mock('../../config/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../services/emailService', () => ({ ...jest.requireActual('../../services/emailService'), sendTransactionalEmail: jest.fn() }));
import pool from '../../config/database';
import { EmailDeliveryError, sendTransactionalEmail } from '../../services/emailService';
import { checkCustomerEmailLimit, deliverNextOrderEmail, queueOrderConfirmation, validateCustomerEmail, validateOrderRequestId } from '../../services/customerOrderEmailService';

const names = ['CUSTOMER_EMAIL_ORDERING_ENABLED','ORDER_EMAIL_DELIVERY_ENABLED','RESEND_API_KEY','RESEND_FROM_EMAIL'];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const job = { id: 'job-id', order_id: 'order-id', recipient: 'buyer@example.test', subject: 'Cafe: ORD-1', body: 'Order confirmation', attempts: 1 };
beforeEach(() => {
  jest.resetAllMocks();
  process.env.CUSTOMER_EMAIL_ORDERING_ENABLED = 'true'; process.env.ORDER_EMAIL_DELIVERY_ENABLED = 'true';
  process.env.RESEND_API_KEY = 'test-only'; process.env.RESEND_FROM_EMAIL = 'test@example.test';
  (pool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 1 });
  (sendTransactionalEmail as jest.Mock).mockResolvedValue('provider-id');
});
afterAll(() => { for (const name of names) { if (prior[name] === undefined) delete process.env[name]; else process.env[name] = prior[name]; } });
it('normalizes email without pretending it is verified', () => { expect(validateCustomerEmail(' Buyer+Food@Example.COM ')).toBe('buyer+food@example.com'); });
it.each([undefined, null, 1, {}, '', 'a', 'a@b', 'a b@x.com', 'a\r\n@x.com', 'a..b@x.com', '.a@x.com', 'a.@x.com', 'a@-x.com', `${'a'.repeat(65)}@x.com`])('rejects invalid email %j', value => {
  expect(() => validateCustomerEmail(value)).toThrow();
});
it('validates a checkout UUID', () => {
  expect(validateOrderRequestId('11111111-1111-4111-8111-111111111111')).toBe('11111111-1111-4111-8111-111111111111');
  expect(() => validateOrderRequestId('guess')).toThrow();
});
it('limits unverified recipient traffic under an advisory transaction lock', async () => {
  const query = jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ recent: '5', daily: '5' }] });
  await expect(checkCustomerEmailLimit({ query } as never, 'buyer@example.test')).rejects.toMatchObject({ statusCode: 429 });
  expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('pg_advisory_xact_lock'), ['buyer@example.test']);
});
it('creates a unique immutable confirmation, never a paid invoice', async () => {
  const query = jest.fn().mockResolvedValueOnce({ rows: [{ name: 'Cafe\r\nTitle' }] }).mockResolvedValue({ rows: [] });
  await queueOrderConfirmation({ query } as never, 'buyer@example.test', 'restaurant', {
    id: 'order', orderRef: 'ORD-1', total: '401.00', items: [{ itemName: 'Pizza', quantity: 2, itemPrice: '200.50', optionSummary: 'Large, + Cheese' }],
  });
  const [, values] = query.mock.calls[1];
  expect(values[3]).toBe('Cafe  Title: ORD-1');
  expect(values[4]).toContain('INR 401.00');
  expect(values[4]).toContain('Large, + Cheese');
  expect(values[4]).toContain('not a payment receipt');
  expect(query.mock.calls[1][0]).toContain('ON CONFLICT (order_id,kind) DO NOTHING');
  expect(sendTransactionalEmail).not.toHaveBeenCalled();
});
function claim() {
  (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [job] });
}
it('does not send when delivery is disabled or provider configuration is missing', async () => {
  process.env.ORDER_EMAIL_DELIVERY_ENABLED = 'false'; expect(await deliverNextOrderEmail()).toBe(false);
  process.env.ORDER_EMAIL_DELIVERY_ENABLED = 'true'; delete process.env.RESEND_API_KEY;
  expect(await deliverNextOrderEmail()).toBe(false); expect(pool.query).not.toHaveBeenCalled();
});
it('claims a leased job and sends with its stable provider idempotency key', async () => {
  claim(); expect(await deliverNextOrderEmail()).toBe(true);
  expect(sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'order-confirmation/order-id', to: job.recipient }));
  expect((pool.query as jest.Mock).mock.calls[1][0]).toContain('SKIP LOCKED');
  expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining("status='sent'"), ['provider-id', job.id, expect.any(String)]);
});
it.each([true, false])('handles provider retryable=%s without touching the order', async retryable => {
  claim(); (sendTransactionalEmail as jest.Mock).mockRejectedValue(new EmailDeliveryError(retryable));
  expect(await deliverNextOrderEmail()).toBe(true);
  expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining("status=$1"), [retryable ? 'pending' : 'failed', expect.any(Number), job.id, expect.any(String)]);
});
it('keeps a recoverable lease if storing the provider acknowledgement fails', async () => {
  claim(); (pool.query as jest.Mock).mockRejectedValueOnce(new Error('db-down'));
  await expect(deliverNextOrderEmail()).rejects.toThrow('db-down');
  expect(pool.query).toHaveBeenCalledTimes(3);
});
