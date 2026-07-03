import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { withApiGuard } from '@/lib/api/guard';
import { PLANS } from '@/lib/payments/config';

// Fase 4 bloco 4e: estado da assinatura do utilizador autenticado, para a
// página /pages/subscription. Ausência de linha em `subscriptions` (default)
// devolve o plano pay_per_documento explicitamente -- não é um erro.
export const GET = withApiGuard(async (_request: NextRequest, { user }) => {
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from('subscriptions')
    .select('plano, status, data_proxima_cobranca, bloqueado_em')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({
      success: true,
      data: {
        plano: 'pay_per_documento',
        status: null,
        data_proxima_cobranca: null,
        bloqueado_em: null,
        precos: PLANS
      }
    });
  }

  return NextResponse.json({
    success: true,
    data: { ...data, precos: PLANS }
  });
}, { auth: true, rate: { limit: 60, intervalMs: 60_000 }, auditAction: 'subscription_status' });
