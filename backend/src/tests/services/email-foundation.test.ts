import { EmailDeliveryError, sendTransactionalEmail } from '../../services/emailService';
import { generateEmailOtp, hashEmailOtp, matchesEmailOtp } from '../../utils/emailOtp';

const message = {
  to: 'owner@example.test', subject: 'Verify your RestroQR email',
  text: 'Your verification code is 123456', idempotencyKey: 'owner-otp/challenge-1',
};

describe('Resend email transport', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.RESEND_FROM_EMAIL;
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    process.env.RESEND_API_KEY = 'test-key-not-real';
    process.env.RESEND_FROM_EMAIL = 'RestroQR <mail@example.test>';
  });
  afterAll(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = originalFrom;
  });
  it('sends text email with a stable idempotency key and timeout', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'email-1' }) });
    await expect(sendTransactionalEmail(message)).resolves.toBe('email-1');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.headers['Idempotency-Key']).toBe(message.idempotencyKey);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body).text).toBe(message.text);
  });
  it('fails closed when unconfigured', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(sendTransactionalEmail(message)).rejects.toMatchObject({ retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([429, 500, 503])('marks HTTP %s retryable', async (status) => {
    fetchMock.mockResolvedValue({ ok: false, status });
    await expect(sendTransactionalEmail(message)).rejects.toMatchObject({ retryable: true });
  });
  it('does not retry permanent provider rejection', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422 });
    await expect(sendTransactionalEmail(message)).rejects.toMatchObject({ retryable: false });
  });
  it('redacts network errors', async () => {
    fetchMock.mockRejectedValue(new Error('secret-key owner@example.test'));
    await expect(sendTransactionalEmail(message)).rejects.toThrow('Email delivery could not be confirmed');
  });
  it('rejects missing delivery ID', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(sendTransactionalEmail(message)).rejects.toBeInstanceOf(EmailDeliveryError);
  });
  it('rejects malformed headers before sending', async () => {
    await expect(sendTransactionalEmail({ ...message, subject: 'Hi\r\nInjected' }))
      .rejects.toMatchObject({ retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects sender header injection for queued email snapshots', async () => {
    await expect(sendTransactionalEmail({ ...message, from: 'Sender\r\nBcc: victim@example.test' }))
      .rejects.toMatchObject({ retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('email OTP cryptography', () => {
  const secret = 'a-test-only-secret-with-at-least-32-bytes';
  it('generates six digits including leading zero support', () => {
    for (let i = 0; i < 100; i++) expect(generateEmailOtp()).toMatch(/^\d{6}$/);
  });
  it('matches the correct code, not a different code or challenge', () => {
    const hash = hashEmailOtp('challenge-1', '012345', secret);
    expect(matchesEmailOtp('challenge-1', '012345', hash, secret)).toBe(true);
    expect(matchesEmailOtp('challenge-1', '012346', hash, secret)).toBe(false);
    expect(matchesEmailOtp('challenge-2', '012345', hash, secret)).toBe(false);
  });
  it('rejects malformed submitted codes and hashes', () => {
    expect(matchesEmailOtp('id', '123', 'broken', secret)).toBe(false);
    expect(matchesEmailOtp('id', '123456', 'broken', secret)).toBe(false);
  });
  it('rejects weak secrets', () => {
    expect(() => hashEmailOtp('id', '123456', 'weak')).toThrow();
  });
});
