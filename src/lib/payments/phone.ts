import { PaymentMethod } from './PaymentProvider';

// Fonte única para a lista de métodos e a normalização/validação de telefone
// -- usado tanto no cliente (inputs em PaymentForm.tsx e subscription/page.tsx)
// quanto no servidor (checkout/subscribe routes), para nunca divergir.

export const ALL_PAYMENT_METHODS: PaymentMethod[] = ['mpesa', 'emola', 'mkesh', 'visa_mastercard', 'payfast'];

// mpesa/emola/mkesh/visa_mastercard cobram em MZN; payfast é sempre ZAR.
export const ZAR_METHODS: PaymentMethod[] = ['payfast'];

// Métodos que exigem o número de quem vai pagar já na criação da cobrança
// (sem página de checkout para o recolher depois).
export const MOBILE_MONEY_METHODS: PaymentMethod[] = ['mpesa', 'emola', 'mkesh'];

const MOZ_MOBILE_REGEX = /^\+2588\d{8}$/;

/**
 * Resolve o valor/moeda a cobrar consoante o método -- payfast cobra sempre
 * em ZAR (valorZar), os restantes na moeda nativa do plano (MZN). Usado nas
 * duas rotas de cobrança (checkout/subscribe) para não duplicar a lógica.
 */
export function resolveChargeAmount(
  plan: { valor: number; valorZar: number; moeda: string },
  method: PaymentMethod
): { amount: number; currency: string } {
  if (ZAR_METHODS.includes(method)) {
    return { amount: plan.valorZar, currency: 'ZAR' };
  }
  return { amount: plan.valor, currency: plan.moeda };
}

/**
 * Aceita '84...', '258 84...' ou '+258 84...' e devolve o formato E.164
 * (+258XXXXXXXXX) exigido pelo gateway, ou `null` se inválido.
 */
export function normalizeMozambiquePhone(rawInput: string): string | null {
  const digits = rawInput.replace(/[^\d]/g, '');
  if (!digits) return null;

  const normalized = digits.startsWith('258') ? `+${digits}` : `+258${digits}`;
  return MOZ_MOBILE_REGEX.test(normalized) ? normalized : null;
}
