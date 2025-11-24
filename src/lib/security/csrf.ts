import { randomBytes, timingSafeEqual } from 'crypto';

export function generateCsrfToken(): string {
  return randomBytes(16).toString('hex');
}

export function verifyCsrfToken(sent: string | null | undefined, stored: string | null | undefined): boolean {
  if (!sent || !stored) return false;
  try {
    const a = Buffer.from(sent, 'utf8');
    const b = Buffer.from(stored, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
