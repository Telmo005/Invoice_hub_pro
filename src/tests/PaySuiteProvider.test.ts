import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { PaySuiteProvider } from '@/lib/payments/providers/PaySuiteProvider';

const WEBHOOK_SECRET = 'test-secret';

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('PaySuiteProvider.verifyWebhookSignature', () => {
  const provider = new PaySuiteProvider('fake-token', WEBHOOK_SECRET);

  it('aceita uma assinatura HMAC-SHA256 válida', () => {
    const body = JSON.stringify({ event: 'payment.success' });
    const signature = sign(body, WEBHOOK_SECRET);
    expect(provider.verifyWebhookSignature(body, signature)).toBe(true);
  });

  it('rejeita uma assinatura calculada com o segredo errado', () => {
    const body = JSON.stringify({ event: 'payment.success' });
    const signature = sign(body, 'segredo-errado');
    expect(provider.verifyWebhookSignature(body, signature)).toBe(false);
  });

  it('rejeita quando não há cabeçalho de assinatura', () => {
    const body = JSON.stringify({ event: 'payment.success' });
    expect(provider.verifyWebhookSignature(body, null)).toBe(false);
  });

  it('rejeita uma assinatura de comprimento diferente sem lançar exceção', () => {
    const body = JSON.stringify({ event: 'payment.success' });
    expect(() => provider.verifyWebhookSignature(body, 'abc')).not.toThrow();
    expect(provider.verifyWebhookSignature(body, 'abc')).toBe(false);
  });

  it('rejeita se o corpo do pedido for alterado depois de assinado', () => {
    const originalBody = JSON.stringify({ event: 'payment.success', data: { amount: 10 } });
    const signature = sign(originalBody, WEBHOOK_SECRET);
    const tamperedBody = JSON.stringify({ event: 'payment.success', data: { amount: 10000 } });
    expect(provider.verifyWebhookSignature(tamperedBody, signature)).toBe(false);
  });
});

describe('PaySuiteProvider.parseWebhookEvent', () => {
  const provider = new PaySuiteProvider('fake-token', WEBHOOK_SECRET);

  it('interpreta um evento payment.success', () => {
    const body = JSON.stringify({
      event: 'payment.success',
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        amount: 100.5,
        reference: 'INV2024001',
        transaction: { id: 'tr_123456', method: 'mpesa', paid_at: '2024-02-10T10:15:00.000000Z' }
      },
      created_at: 1708235285,
      request_id: 'req-1'
    });

    const event = provider.parseWebhookEvent(body);
    expect(event.type).toBe('payment.success');
    expect(event.providerPaymentId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(event.reference).toBe('INV2024001');
    expect(event.amount).toBe(100.5);
    expect(event.transactionId).toBe('tr_123456');
    expect(event.paidAt).toBe('2024-02-10T10:15:00.000000Z');
    expect(event.requestId).toBe('req-1');
  });

  it('interpreta um evento payment.failed', () => {
    const body = JSON.stringify({
      event: 'payment.failed',
      data: { id: 'id-1', amount: 10, reference: 'REF-1', error: 'Insufficient funds' },
      request_id: 'req-2'
    });

    const event = provider.parseWebhookEvent(body);
    expect(event.type).toBe('payment.failed');
    expect(event.errorMessage).toBe('Insufficient funds');
  });

  it('rejeita um tipo de evento desconhecido', () => {
    const body = JSON.stringify({ event: 'something.else', data: {} });
    expect(() => provider.parseWebhookEvent(body)).toThrow();
  });
});
