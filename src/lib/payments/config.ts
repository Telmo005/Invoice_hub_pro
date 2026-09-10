// Fase 4 (docs/auditoria-inicial.md): configuração central dos planos e
// regras de negócio de cobrança. Valores fixos aqui (não numa tabela de BD)
// porque são decisões de produto raramente alteradas, não dados de utilizador.

// Taxa de conversão MZN -> ZAR para o método payfast (a Debito Pay só aceita
// payfast em ZAR; os preços deste app são definidos em MZN). Fixada
// manualmente, não é uma taxa em tempo real -- fonte: xe.com, 13/09/2026
// (1 MZN ~= 0.253 ZAR). Revê de vez em quando; um desvio de cêntimos não é
// crítico, mas não deixes isto parado durante anos.
export const MZN_TO_ZAR_RATE = 0.253;

// A Debito Pay exige um mínimo de 10 ZAR por transação em payfast (corrigido
// em 2026-09-10 -- a doc oficial dizia 5, mas produção rejeitava com "Valor
// mínimo PayFast: ZAR 10.00") -- a taxa de liberação de documento
// (15 MZN ~= 3.80 ZAR) fica bem abaixo disso, por isso aplicamos este piso
// só para não a cobrança ser recusada.
const PAYFAST_MIN_ZAR = 10;

function toZar(mznValue: number): number {
  const converted = Math.round(mznValue * MZN_TO_ZAR_RATE * 100) / 100;
  return Math.max(converted, PAYFAST_MIN_ZAR);
}

export const PLANS = {
  mensal: {
    valor: 250,
    moeda: 'MZN',
    valorZar: toZar(250),
    label: 'Assinatura Mensal',
    descricao: 'Acesso ilimitado à geração de faturas, cotações e recibos.'
  },
  pay_per_documento: {
    valor: 15,
    moeda: 'MZN',
    valorZar: toZar(15),
    label: 'Pagar por Documento',
    descricao: 'Sem mensalidade -- paga 15 MT sempre que gerar um documento.'
  }
} as const;

export type PlanoId = keyof typeof PLANS;

// Dias de tolerância após uma falha de pagamento de assinatura antes de
// bloquear a criação de novos documentos. Decisão do utilizador
// (2026-07-02): imediato por defeito, mas configurável -- mudar aqui.
export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 0;

// O PaySuite não suporta cobrança recorrente/tokenizada (só pagamentos
// avulsos) -- por isso a renovação mensal é sempre iniciada manualmente
// pelo utilizador. Este valor controla quantos dias antes de
// `data_proxima_cobranca` o lembrete por email é enviado.
export const SUBSCRIPTION_REMINDER_DAYS_BEFORE = 3;

export const PAYSUITE_BASE_URL = 'https://paysuite.tech/api/v1';
