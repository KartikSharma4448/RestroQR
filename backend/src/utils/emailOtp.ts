import { createHmac, randomInt, timingSafeEqual } from 'crypto';

export const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;
export const EMAIL_OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function generateEmailOtp(): string {
  return randomInt(0, 1000000).toString().padStart(6, '0');
}

export function hashEmailOtp(challengeId: string, code: string, secret: string): string {
  if (!challengeId || !/^\d{6}$/.test(code) || Buffer.byteLength(secret) < 32) {
    throw new Error('Invalid OTP hashing configuration');
  }
  return createHmac('sha256', secret).update(`${challengeId}:${code}`).digest('hex');
}

export function matchesEmailOtp(
  challengeId: string, code: string, storedHash: string, secret: string,
): boolean {
  if (!/^\d{6}$/.test(code) || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  return timingSafeEqual(
    Buffer.from(hashEmailOtp(challengeId, code, secret), 'hex'),
    Buffer.from(storedHash, 'hex'),
  );
}
