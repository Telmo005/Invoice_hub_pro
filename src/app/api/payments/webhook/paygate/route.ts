import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PayGateProvider } from '@/lib/payments/providers/PayGateProvider';
import { withApiGuard } from '@/lib/api/guard';
import { logger } from '@/lib/logger';
import { ensureEmitenteId, ensureDestinatarioId } from '@/lib/document/party';
import { buildDadosEspecificos, mapItensParaRpc } from '@/lib/document/buildDadosEspecificos';
import { STATUSES_ELIGIBLE_FOR_PAGO, STATUSES_ELIGIBLE_FOR_FALHADO } from '@/lib/payments/pagamentoStateMachine';

// Recebe as confirmações de pagamento reenviadas pelo PayGate (que por trás
// fala com o PaySuite). Mesma lógica da rota /api/payments/webhook/paysuite
// -- só troca o provedor e o cabeçalho de assinatura (X-Paygate-Signature).
//
// Sem autenticação de utilizador (o pedido vem do PayGate, não de uma sessão
// logada) -- a segurança vem inteiramente da verificação HMAC da assinatura.

function getProvider(): PayGateProvider {
  const baseUrl = process.env.PAYGATE_BASE_URL;
  const apiKey = process.env.PAYGATE_API_KEY;
  const callbackSecret = process.env.PAYGATE_CALLBACK_SECRET;
  if (!baseUrl || !apiKey || !callbackSecret) {
    throw new Error('PAYGATE_BASE_URL/PAYGATE_API_KEY/PAYGATE_CALLBACK_SECRET não configurados');
  }
  return new PayGateProvider(baseUrl, apiKey, callbackSecret);
}

async function finalizeDocumentPayment(pagamento: any): Promise<void> {
  const documentPayload = pagamento.metadata?.document_payload;
  if (!documentPayload?.formData) {
    await logger.logError(new Error('document_payload ausente em pagamento confirmado'), 'paysuite_webhook_missing_payload', {
      pagamentoId: pagamento.id
    });
    return;
  }

  const { formData, items, totais, logo, assinatura, html_content } = documentPayload;

  const [emitenteId, destinatarioId] = await Promise.all([
    ensureEmitenteId(pagamento.user_id, formData.emitente, supabaseAdmin),
    ensureDestinatarioId(pagamento.user_id, formData.destinatario, supabaseAdmin)
  ]);

  const dadosEspecificos = buildDadosEspecificos({ tipo: pagamento.tipo_documento, formData, logo, assinatura, totais });
  const itensMapeados = mapItensParaRpc(items);

  const { data: documentoId, error: rpcError } = await supabaseAdmin.rpc('criar_documento_completo', {
    p_user_id: pagamento.user_id,
    p_tipo_documento: pagamento.tipo_documento,
    p_emitente_id: emitenteId,
    p_destinatario_id: destinatarioId,
    p_dados_especificos: dadosEspecificos,
    p_itens: itensMapeados,
    p_html_content: html_content ?? null
  });

  if (rpcError || !documentoId) {
    await logger.logError(rpcError ?? new Error('criar_documento_completo devolveu vazio'), 'paysuite_webhook_document_create_failed', {
      pagamentoId: pagamento.id
    });
    return;
  }

  await supabaseAdmin
    .from('pagamentos')
    .update({ documento_id: documentoId })
    .eq('id', pagamento.id);
}

async function renewSubscription(pagamento: any): Promise<void> {
  const subscriptionId = pagamento.metadata?.subscription_id;
  if (!subscriptionId) {
    await logger.logError(new Error('subscription_id ausente em pagamento de assinatura confirmado'), 'paysuite_webhook_missing_subscription', {
      pagamentoId: pagamento.id
    });
    return;
  }

  const proximaCobranca = new Date();
  proximaCobranca.setMonth(proximaCobranca.getMonth() + 1);

  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'ativa',
      data_inicio: new Date().toISOString().slice(0, 10),
      data_proxima_cobranca: proximaCobranca.toISOString().slice(0, 10),
      bloqueado_em: null,
      lembrete_enviado_em: null
    })
    .eq('id', subscriptionId);
}

export const POST = withApiGuard(async (request: NextRequest) => {
  const rawBody = await request.text();
  const signature = request.headers.get('x-paygate-signature');

  let provider: PayGateProvider;
  try {
    provider = getProvider();
  } catch (e) {
    await logger.logError(e as Error, 'paysuite_webhook_config_missing');
    return NextResponse.json({ error: 'Configuração em falta' }, { status: 500 });
  }

  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    await logger.logSecurityEvent('paysuite_webhook_invalid_signature', 'high', {
      hasSignature: !!signature
    });
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
  }

  let event;
  try {
    event = provider.parseWebhookEvent(rawBody);
  } catch (e) {
    await logger.logError(e as Error, 'paysuite_webhook_parse_failed');
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const { data: pagamento, error: findError } = await supabaseAdmin
    .from('pagamentos')
    .select('*')
    .eq('external_id', event.providerPaymentId)
    .eq('gateway', 'paygate')
    .maybeSingle();

  if (findError || !pagamento) {
    await logger.logError(findError ?? new Error('Pagamento não encontrado'), 'paysuite_webhook_payment_not_found', {
      providerPaymentId: event.providerPaymentId,
      reference: event.reference
    });
    // 200 para o PayGate não continuar a tentar reentregar um evento que
    // nunca vai encontrar correspondência do nosso lado.
    return NextResponse.json({ received: true });
  }

  if (event.type === 'payment.success') {
    const { data: updated } = await supabaseAdmin
      .from('pagamentos')
      .update({ status: 'pago', paid_at: new Date().toISOString() })
      .eq('id', pagamento.id)
      .in('status', STATUSES_ELIGIBLE_FOR_PAGO as unknown as string[])
      .select()
      .maybeSingle();

    if (!updated) {
      // já processado antes (reentrega) -- nada a fazer
      return NextResponse.json({ received: true });
    }

    if (pagamento.tipo_documento === 'assinatura') {
      await renewSubscription(updated);
    } else {
      await finalizeDocumentPayment(updated);
    }
  } else if (event.type === 'payment.failed') {
    await supabaseAdmin
      .from('pagamentos')
      .update({ status: 'falhado' })
      .eq('id', pagamento.id)
      .in('status', STATUSES_ELIGIBLE_FOR_FALHADO as unknown as string[]);
  }

  return NextResponse.json({ received: true });
}, { rate: { limit: 60, intervalMs: 60_000 }, auditAction: 'paysuite_webhook' });
