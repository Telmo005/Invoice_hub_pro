import { PaymentMethod } from './PaymentProvider';

// Fonte única para a lista de métodos e a normalização/validação de telefone
// -- usado tanto no cliente (inputs em PaymentForm.tsx e subscription/page.tsx)
// quanto no servidor (checkout/subscribe routes), para nunca divergir.

export const ALL_PAYMENT_METHODS: PaymentMethod[] = ['mpesa', 'emola', 'mkesh', 'visa_mastercard', 'payfast'];

// mpesa/emola/mkesh/visa_mastercard cobram em MZN; payfast é sempre ZAR.
export const ZAR_METHODS: PaymentMethod[] = ['payfast'];

// Mínimos por método em MZN na Debito Pay -- deve bater com MIN_AMOUNT em
// payment-gateway/src/lib/debitopay.ts. payfast fica de fora: cobra em ZAR e
// já tem o piso aplicado em toZar() (config.ts), nunca cai abaixo do mínimo.
const MIN_AMOUNT_MZN: Partial<Record<PaymentMethod, number>> = {
  mpesa: 10,
  mkesh: 10,
  emola: 50,
  visa_mastercard: 50
};

/**
 * Filtra os métodos que conseguem mesmo cobrar `amountMzn` -- e-Mola e Visa/
 * Mastercard exigem mínimo 50 MZN na Debito Pay; a taxa de 15 MT/documento
 * nunca os atinge, e oferecê-los só levava a um "Corpo inválido" confuso
 * depois de o utilizador já ter escolhido o método. Usar para decidir que
 * métodos mostrar, não só para validar depois de escolhido.
 */
export function methodsAvailableFor(amountMzn: number): PaymentMethod[] {
  return ALL_PAYMENT_METHODS.filter((m) => {
    const min = MIN_AMOUNT_MZN[m];
    return min === undefined || amountMzn >= min;
  });
}

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
