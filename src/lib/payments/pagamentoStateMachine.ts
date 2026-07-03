// Estados possíveis de `pagamentos.status` a partir dos quais o webhook do
// PaySuite pode transicionar, extraído para ser testável sem precisar de
// mockar o Supabase. 'pago' é sempre o único estado terminal.
//
// Regressão 2026-07-03: o PaySuite entrega um payment.failed prematuro
// antes do payment.success real para o mesmo pagamento (confirmado em
// produção -- 3 payment.failed seguidos de 2 payment.success, ~13s de
// diferença, mesmo external_id). Um guard que só aceitasse a transição
// para 'pago' a partir de 'aguardando_documento' ficava preso em 'falhado'
// para sempre nesse cenário, mesmo com o pagamento realmente confirmado.
export const STATUSES_ELIGIBLE_FOR_PAGO = ['aguardando_documento', 'falhado'] as const;
export const STATUSES_ELIGIBLE_FOR_FALHADO = ['aguardando_documento'] as const;

export function canTransitionToPago(currentStatus: string): boolean {
  return (STATUSES_ELIGIBLE_FOR_PAGO as readonly string[]).includes(currentStatus);
}

export function canTransitionToFalhado(currentStatus: string): boolean {
  return (STATUSES_ELIGIBLE_FOR_FALHADO as readonly string[]).includes(currentStatus);
}
