import { NextRequest } from 'next/server';

// Extraído de subscription-check/route.ts para ser partilhado por todos os
// crons (Vercel injeta `Authorization: Bearer $CRON_SECRET` nos pedidos que
// ele próprio dispara -- mesmo princípio do webhook do PaySuite, segredo
// partilhado, mas aqui é o Vercel a chamar-nos).
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}
