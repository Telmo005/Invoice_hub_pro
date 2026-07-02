// Fase 4 (docs/auditoria-inicial.md): configuração central dos planos e
// regras de negócio de cobrança. Valores fixos aqui (não numa tabela de BD)
// porque são decisões de produto raramente alteradas, não dados de utilizador.

export const PLANS = {
  mensal: {
    valor: 250,
    moeda: 'MZN',
    label: 'Assinatura Mensal',
    descricao: 'Acesso ilimitado à geração de faturas, cotações e recibos.'
  },
  pay_per_documento: {
    valor: 10,
    moeda: 'MZN',
    label: 'Pagar por Documento',
    descricao: 'Sem mensalidade -- paga 10 MT sempre que gerar um documento.'
  }
} as const;

export type PlanoId = keyof typeof PLANS;

// Dias de tolerância após uma falha de pagamento de assinatura antes de
// bloquear a criação de novos documentos. Decisão do utilizador
// (2026-07-02): imediato por defeito, mas configurável -- mudar aqui.
export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 0;

export const PAYSUITE_BASE_URL = 'https://paysuite.tech/api/v1';
