import { PaymentMethod } from './PaymentProvider';

// Fonte única para a lista de métodos e a normalização/validação de telefone
// -- usado tanto no cliente (inputs em PaymentForm.tsx e subscription/page.tsx)
// quanto no servidor (checkout/subscribe routes), para nunca divergir.

export const ALL_PAYMENT_METHODS: PaymentMethod[] = ['mpesa', 'emola', 'mkesh', 'visa_mastercard'];

// Métodos que exigem o número de quem vai pagar já na criação da cobrança
// (sem página de checkout para o recolher depois).
export const MOBILE_MONEY_METHODS: PaymentMethod[] = ['mpesa', 'emola', 'mkesh'];

const MOZ_MOBILE_REGEX = /^\+2588\d{8}$/;

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
