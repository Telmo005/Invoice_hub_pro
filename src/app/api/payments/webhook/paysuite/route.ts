import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PaySuiteProvider } from '@/lib/payments/providers/PaySuiteProvider';
import { withApiGuard } from '@/lib/api/guard';
import { logger } from '@/lib/logger';
import { ensureEmitenteId, ensureDestinatarioId } from '@/lib/document/party';
import { buildDadosEspecificos, mapItensParaRpc } from '@/lib/document/buildDadosEspecificos';

// Fase 4 (docs/auditoria-inicial.md): recebe confirmações assíncronas do
// PaySuite (M-Pesa/e-Mola/Visa são tipicamente assíncronos -- o utilizador
// aprova no telemóvel/3-D Secure). Nunca gera o documento final nem renova
// a assinatura antes desta confirmação chegar e a assinatura ser validada.
//
// Sem autenticação de utilizador (o pedido vem do PaySuite, não de uma
// sessão logada) -- a segurança vem inteiramente da verificação HMAC da
// assinatura. Rate limit como defesa em profundidade contra flood de
// pedidos com assinatura inválida.

function getProvider(): PaySuiteProvider {
  const apiToken = process.env.PAYSUITE_API_TOKEN;
  const webhookSecret = process.env.PAYSUITE_WEBHOOK_SECRET;
  if (!apiToken || !webhookSecret) {
    throw new Error('PAYSUITE_API_TOKEN/PAYSUITE_WEBHOOK_SECRET não configurados');
  }
  return new PaySuiteProvider(apiToken, webhookSecret);
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

  // Resolve/cria emitente e destinatário agora (não antes de confirmar o
  // pagamento) -- mesma lógica partilhada que os create routes usam, mas
  // com supabaseAdmin porque o webhook não tem sessão de utilizador (ver
  // src/lib/document/party.ts).
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
      // Novo ciclo começa -- o lembrete deste ciclo (se algum foi enviado
      // antes desta renovação) já não é relevante para o próximo.
      lembrete_enviado_em: null
    })
    .eq('id', subscriptionId);
}

export const POST = withApiGuard(async (request: NextRequest) => {
  const rawBody = await request.text();
  // A documentação do PaySuite refere "X-Webhook-Signature", mas o cabeçalho
  // real enviado em produção é "X-Signature" (confirmado via log de
  // diagnóstico 2026-07-03 -- todos os webhooks reais estavam a ser
  // rejeitados por procurarmos o nome errado).
  const signature = request.headers.get('x-signature') || request.headers.get('x-webhook-signature');

  let provider: PaySuiteProvider;
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
    .eq('gateway', 'paysuite')
    .maybeSingle();

  if (findError || !pagamento) {
    await logger.logError(findError ?? new Error('Pagamento não encontrado'), 'paysuite_webhook_payment_not_found', {
      providerPaymentId: event.providerPaymentId,
      reference: event.reference
    });
    // 200 para o PaySuite não continuar a tentar reentregar um evento que
    // nunca vai encontrar correspondência do nosso lado.
    return NextResponse.json({ received: true });
  }

  if (event.type === 'payment.success') {
    // UPDATE condicional -- garante que um webhook duplicado/reentregue não
    // reprocessa a confirmação nem cria o documento duas vezes, sem
    // precisar de uma tabela extra de eventos processados. Aceita a
    // transição a partir de 'falhado' também (não só 'aguardando_documento')
    // -- confirmado em produção (2026-07-03) que o PaySuite pode entregar um
    // payment.failed prematuro antes do payment.success real para o mesmo
    // pagamento (o dinheiro foi mesmo debitado, mas o nosso próprio guard
    // estava a bloquear a atualização para 'pago' porque já tínhamos
    // marcado 'falhado' com o evento anterior). 'pago' continua a ser o
    // único estado terminal -- nunca é sobreposto.
    const { data: updated } = await supabaseAdmin
      .from('pagamentos')
      .update({ status: 'pago', paid_at: new Date().toISOString() })
      .eq('id', pagamento.id)
      .in('status', ['aguardando_documento', 'falhado'])
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
      .eq('status', 'aguardando_documento');
  }

  return NextResponse.json({ received: true });
}, { rate: { limit: 60, intervalMs: 60_000 }, auditAction: 'paysuite_webhook' });
