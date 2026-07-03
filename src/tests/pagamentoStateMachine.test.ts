import { describe, it, expect } from 'vitest';
import { canTransitionToPago, canTransitionToFalhado } from '@/lib/payments/pagamentoStateMachine';

// Regressão 2026-07-03: o PaySuite entrega um payment.failed prematuro
// antes do payment.success real para o mesmo pagamento (dinheiro realmente
// debitado). Um guard que só aceitasse 'pago' a partir de
// 'aguardando_documento' ficava preso em 'falhado' para sempre.
describe('canTransitionToPago', () => {
  it('aceita a partir de aguardando_documento (caminho normal)', () => {
    expect(canTransitionToPago('aguardando_documento')).toBe(true);
  });

  it('aceita a partir de falhado (recupera de um payment.failed prematuro)', () => {
    expect(canTransitionToPago('falhado')).toBe(true);
  });

  it('rejeita a partir de pago (nunca reprocessa/sobrepõe um pagamento já confirmado)', () => {
    expect(canTransitionToPago('pago')).toBe(false);
  });
});

describe('canTransitionToFalhado', () => {
  it('aceita a partir de aguardando_documento', () => {
    expect(canTransitionToFalhado('aguardando_documento')).toBe(true);
  });

  it('rejeita a partir de pago (nunca desfaz um pagamento já confirmado)', () => {
    expect(canTransitionToFalhado('pago')).toBe(false);
  });

  it('rejeita a partir de falhado (evita reprocessar uma reentrega duplicada)', () => {
    expect(canTransitionToFalhado('falhado')).toBe(false);
  });
});
