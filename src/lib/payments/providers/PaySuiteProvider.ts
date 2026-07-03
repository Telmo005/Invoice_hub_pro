import crypto from 'crypto';
import {
  PaymentProvider,
  ChargeParams,
  ChargeResult,
  ChargeStatus,
  WebhookEvent,
  PaymentProviderError
} from '../PaymentProvider';
import { PAYSUITE_BASE_URL } from '../config';

// Fase 4 (docs/auditoria-inicial.md): implementação PaySuite da abstração
// PaymentProvider. Documentação: https://paysuite.tech/docs/
//
// Notas confirmadas diretamente na documentação (2026-07-02):
// - method aceita apenas 'mpesa' | 'emola' | 'credit_card' (Mkesh não
//   documentado, fora de âmbito por agora).
// - Sem endpoint de assinaturas/recorrência -- a cobrança mensal é
//   implementada por cima de chamadas avulsas a este provider.
// - Sem ambiente de sandbox documentado.

function mapAmountToPaySuite(amount: number): string {
  return amount.toFixed(2);
}

function mapChargeStatus(status: string): ChargeStatus {
  if (status === 'success' || status === 'paid') return 'success';
  if (status === 'failed' || status === 'error') return 'failed';
  return 'pending';
}

export class PaySuiteProvider implements PaymentProvider {
  constructor(
    private readonly apiToken: string,
    private readonly webhookSecret: string,
    private readonly baseUrl: string = PAYSUITE_BASE_URL
  ) {}

  async charge(params: ChargeParams): Promise<ChargeResult> {
    const response = await fetch(`${this.baseUrl}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: mapAmountToPaySuite(params.amount),
        method: params.method,
        reference: params.reference,
        description: params.description,
        return_url: params.returnUrl,
        callback_url: params.callbackUrl
      })
    });

    const json = await response.json().catch(() => null);

    if (!response.ok || !json || json.status !== 'success' || !json.data) {
      throw new PaymentProviderError('Falha ao iniciar pagamento no PaySuite', {
        httpStatus: response.status,
        body: json
      });
    }

    return {
      providerPaymentId: json.data.id,
      status: mapChargeStatus(json.data.status),
      checkoutUrl: json.data.checkout_url,
      raw: json
    };
  }

  async getStatus(providerPaymentId: string): Promise<ChargeResult> {
    const response = await fetch(`${this.baseUrl}/payments/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${this.apiToken}` }
    });

    const json = await response.json().catch(() => null);

    if (!response.ok || !json || !json.data) {
      throw new PaymentProviderError('Falha ao consultar estado do pagamento no PaySuite', {
        httpStatus: response.status,
        body: json
      });
    }

    return {
      providerPaymentId: json.data.id,
      status: mapChargeStatus(json.data.status),
      checkoutUrl: json.data.checkout_url,
      raw: json
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;

    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(signatureHeader, 'utf8');

    // timingSafeEqual lança exceção se os buffers tiverem comprimentos
    // diferentes -- uma assinatura malformada não deve derrubar o handler.
    if (expectedBuffer.length !== receivedBuffer.length) return false;

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  parseWebhookEvent(rawBody: string): WebhookEvent {
    const json = JSON.parse(rawBody);

    if (json.event !== 'payment.success' && json.event !== 'payment.failed') {
      throw new PaymentProviderError(`Evento de webhook desconhecido: ${json.event}`, json);
    }

    return {
      type: json.event,
      providerPaymentId: json.data?.id,
      reference: json.data?.reference,
      amount: Number(json.data?.amount),
      transactionId: json.data?.transaction?.id,
      paidAt: json.data?.transaction?.paid_at,
      errorMessage: json.data?.error,
      requestId: json.request_id,
      raw: json
    };
  }
}
