// PaySuite exige que "reference" só tenha letras e números (confirmado via
// resposta 422 em produção 2026-07-03: "The Reference field must only
// contain letters and numbers.") -- centralizado aqui (em vez de duplicado
// em cada rota) e sanitizado de forma defensiva, para nenhuma alteração
// futura a um prefixo reintroduzir sem querer um traço/underscore.
export function generatePaymentReference(prefix: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).slice(2, 8).replace(/[^a-zA-Z0-9]/g, '');
  return `IHP${safePrefix}${timestamp}${random}`;
}
