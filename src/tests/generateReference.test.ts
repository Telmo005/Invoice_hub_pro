import { describe, it, expect } from 'vitest';
import { generatePaymentReference } from '@/lib/payments/generateReference';

// Regressão: o PaySuite rejeita (422) qualquer "reference" que não seja
// só letras e números -- confirmado em produção 2026-07-03 depois de um
// traço no formato antigo (IHP-COT-<timestamp>-<random>) ter bloqueado
// pagamentos reais já cobrados.
describe('generatePaymentReference', () => {
  it('produz apenas letras e números', () => {
    const reference = generatePaymentReference('COT');
    expect(reference).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it('remove caracteres não alfanuméricos do prefixo', () => {
    const reference = generatePaymentReference('a-b_c 123');
    expect(reference).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it('gera referências diferentes em chamadas sucessivas', () => {
    const first = generatePaymentReference('SUB');
    const second = generatePaymentReference('SUB');
    expect(first).not.toBe(second);
  });

  it('começa sempre com IHP', () => {
    expect(generatePaymentReference('FAT').startsWith('IHP')).toBe(true);
  });
});
