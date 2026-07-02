// Fase 4 (docs/auditoria-inicial.md): utilizadores sem assinatura mensal
// ativa (o default -- ausência de linha em `subscriptions` já significa
// pay_per_documento) não podem criar documentos diretamente; têm de passar
// por /api/payments/checkout, que só cria o documento depois do PaySuite
// confirmar o pagamento avulso via webhook.
export async function hasActiveSubscription(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plano, status, data_proxima_cobranca')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data || data.plano !== 'mensal' || data.status !== 'ativa') return false;

  // Assinatura "ativa" mas já passou da data de renovação sem o webhook a
  // ter renovado (ex: falha de pagamento ainda não processada) -- não
  // conceder acesso só porque o status ainda não foi atualizado.
  if (data.data_proxima_cobranca && new Date(data.data_proxima_cobranca) < new Date()) {
    return false;
  }

  return true;
}
