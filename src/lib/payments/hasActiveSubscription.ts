// Pagamentos temporariamente removidos (branch temp/remove-payments): todos
// os utilizadores autenticados têm acesso direto, sem cobrança. Reverter
// esta função para restaurar o gate original é o suficiente para religar o
// bloqueio em /api/document/*/create e /api/payments/checkout.
export async function hasActiveSubscription(_supabase: any, _userId: string): Promise<boolean> {
  return true;
}
