import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { withApiGuard } from '@/lib/api/guard';

// Fase 4: o frontend faz polling deste endpoint enquanto aguarda a
// confirmação do webhook do PaySuite (ver docs/auditoria-inicial.md --
// "não deixes a UI travada sem feedback"). Filtra sempre por user_id para
// que um utilizador não consiga consultar o estado do pagamento de outro.
export const GET = withApiGuard(async (request: NextRequest, { user }) => {
  const paymentId = request.nextUrl.pathname.split('/').pop();

  if (!paymentId) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'ID do pagamento é obrigatório' } }, { status: 400 });
  }

  const supabase = await supabaseServer();

  const { data: pagamento, error } = await supabase
    .from('pagamentos')
    .select('id, status, documento_id, tipo_documento')
    .eq('id', paymentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !pagamento) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Pagamento não encontrado' } }, { status: 404 });
  }

  let documento: { id: string; numero: string } | null = null;
  if (pagamento.documento_id) {
    const { data: doc } = await supabase
      .from('documentos_base')
      .select('id, numero')
      .eq('id', pagamento.documento_id)
      .maybeSingle();
    documento = doc as any;
  }

  return NextResponse.json({
    success: true,
    data: {
      status: pagamento.status,
      documento
    }
  });
}, { auth: true, rate: { limit: 120, intervalMs: 60_000 }, auditAction: 'paysuite_payment_status' });
