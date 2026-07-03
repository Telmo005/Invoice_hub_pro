// Fase 4 (docs/auditoria-inicial.md): abstração de gateway de pagamento.
// Trocar de fornecedor no futuro não deve implicar reescrever todo o
// sistema de cobrança -- só uma nova implementação desta interface.

export type PaymentMethod = 'mpesa' | 'emola' | 'credit_card';
export type ChargeStatus = 'pending' | 'success' | 'failed';
export type WebhookEventType = 'payment.success' | 'payment.failed';

export interface ChargeParams {
  amount: number;
  currency: string;
  /** Referência única desta cobrança, usada para reconciliação com o gateway */
  reference: string;
  description: string;
  method?: PaymentMethod;
  returnUrl?: string;
  callbackUrl?: string;
}

export interface ChargeResult {
  /** ID atribuído pelo gateway a este pagamento */
  providerPaymentId: string;
  status: ChargeStatus;
  /** URL de checkout para redirecionar o utilizador, quando aplicável */
  checkoutUrl?: string;
  raw: unknown;
}

export interface WebhookEvent {
  type: WebhookEventType;
  providerPaymentId: string;
  reference: string;
  amount: number;
  transactionId?: string;
  paidAt?: string;
  errorMessage?: string;
  /** Identificador único do evento, para processar cada webhook uma só vez */
  requestId: string;
  raw: unknown;
}

export interface PaymentProvider {
  charge(params: ChargeParams): Promise<ChargeResult>;
  getStatus(providerPaymentId: string): Promise<ChargeResult>;
  /** Valida a assinatura do webhook usando o corpo bruto do pedido (antes de fazer parse do JSON) */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
  parseWebhookEvent(rawBody: string): WebhookEvent;
}

export class PaymentProviderError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
