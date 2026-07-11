import crypto from 'crypto';
import {
  PaymentProvider,
  ChargeParams,
  ChargeResult,
  ChargeStatus,
  WebhookEvent,
  PaymentProviderError
} from '../PaymentProvider';

// Implementação PayGate da abstração PaymentProvider — substitui a chamada
// direta ao PaySuite. O PayGate é o dono exclusivo da relação com o PaySuite
// (token, webhook secret) e reenvia os eventos já assinados com o
// `callback_secret` deste app. Ver payment-gateway/README para o contrato.
//
// Ao contrário do PaySuiteProvider, `callbackUrl` não é enviado por cobrança
// -- o PayGate já sabe para onde entregar (configurado no registo do app).

export class PayGateProvider implements PaymentProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly callbackSecret: string
  ) {}

  async charge(params: ChargeParams): Promise<ChargeResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/charges`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reference: params.reference,
        amount: params.amount,
        method: params.method,
        currency: params.currency,
        description: params.description,
        return_url: params.returnUrl
      })
    });

    const json = await response.json().catch(() => null);

    if (!response.ok || !json?.gateway_payment_id) {
      throw new PaymentProviderError('Falha ao iniciar pagamento no PayGate', {
        httpStatus: response.status,
        body: json
      });
    }

    return {
      providerPaymentId: json.gateway_payment_id,
      status: json.status as ChargeStatus,
      checkoutUrl: json.checkout_url ?? undefined,
      raw: json
    };
  }

  async getStatus(providerPaymentId: string): Promise<ChargeResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/charges/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` }
    });

    const json = await response.json().catch(() => null);

    if (!response.ok || !json) {
      throw new PaymentProviderError('Falha ao consultar estado do pagamento no PayGate', {
        httpStatus: response.status,
        body: json
      });
    }

    return {
      providerPaymentId: json.gateway_payment_id,
      status: json.status as ChargeStatus,
      checkoutUrl: undefined,
      raw: json
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;

    const expected = crypto.createHmac('sha256', this.callbackSecret).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(signatureHeader, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) return false;

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  parseWebhookEvent(rawBody: string): WebhookEvent {
    const json = JSON.parse(rawBody);

    if (json.type !== 'payment.success' && json.type !== 'payment.failed') {
      throw new PaymentProviderError(`Evento de webhook desconhecido: ${json.type}`, json);
    }

    return {
      type: json.type,
      providerPaymentId: json.data?.gateway_payment_id,
      reference: json.data?.reference,
      amount: Number(json.data?.amount),
      paidAt: json.data?.paid_at ?? undefined,
      requestId: json.data?.gateway_payment_id,
      raw: json
    };
  }
}
