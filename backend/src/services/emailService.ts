export interface TransactionalEmail {
  from?: string;
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}

export class EmailDeliveryError extends Error {
  constructor(public readonly retryable: boolean) {
    super('Email delivery could not be confirmed');
    this.name = 'EmailDeliveryError';
  }
}

// Never include provider responses, recipient addresses or credentials in errors.
export async function sendTransactionalEmail(email: TransactionalEmail): Promise<string> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = email.from?.trim() || process.env.RESEND_FROM_EMAIL?.trim();
  if (!key || !from || /[\r\n]/.test(from)) throw new EmailDeliveryError(false);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.to) ||
      !email.subject.trim() || /[\r\n]/.test(email.subject) ||
      !/^[A-Za-z0-9_:/.-]{1,256}$/.test(email.idempotencyKey)) {
    throw new EmailDeliveryError(false);
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': email.idempotencyKey,
      },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text }),
    });
    if (!response.ok) {
      throw new EmailDeliveryError(response.status === 429 || response.status >= 500);
    }
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('id' in body) ||
        typeof body.id !== 'string' || !body.id) {
      throw new EmailDeliveryError(true);
    }
    return body.id;
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    throw new EmailDeliveryError(true);
  }
}
