import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseServer } from '@/lib/supabase-server';
import { withApiGuard } from '@/lib/api/guard';
import { logger } from '@/lib/logger';
import { PayGateProvider } from '@/lib/payments/providers/PayGateProvider';
import { PLANS } from '@/lib/payments/config';
import { PaymentMethod } from '@/lib/payments/PaymentProvider';
import { ALL_PAYMENT_METHODS, MOBILE_MONEY_METHODS, resolveChargeAmount, normalizeMozambiquePhone } from '@/lib/payments/phone';
import { generatePaymentReference } from '@/lib/payments/generateReference';
import { hasActiveSubscription } from '@/lib/payments/hasActiveSubscription';
import { ensureEmitenteId, ensureDestinatarioId } from '@/lib/document/party';
import { buildDadosEspecificos, mapItensParaRpc } from '@/lib/document/buildDadosEspecificos';
import { fetchNumeroDocumento } from '@/lib/document/fetchNumeroDocumento';
import {
  validateInvoicePayload,
  validateQuotationPayload,
  validateReceiptPayload
} from '@/lib/validation/documentSchemas';

// Fase 4 (docs/auditoria-inicial.md): inicia a cobrança pay-per-documento
// (ver PLANS.pay_per_documento em lib/payments/config.ts) via Debito Pay.
// Nunca gera o documento aqui -- só depois do webhook
// confirmar o pagamento (ver /api/payments/webhook/paysuite). Guarda o
// payload de criação em pagamentos.metadata.document_payload (dados em
// bruto, não IDs já resolvidos) para o webhook fazer ensureEmitenteId/
// ensureDestinatarioId no momento da confirmação -- assim uma cobrança
// falhada não deixa emissores/destinatários órfãos criados sem necessidade.

interface CheckoutBody {
  tipo: 'fatura' | 'cotacao' | 'recibo';
  documentData: unknown;
  method: PaymentMethod;
  /** Obrigatório para mpesa/emola/mkesh -- quem vai pagar, formato E.164 (+258...) */
  payerPhone?: string;
}

const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

function getProvider(): PayGateProvider {
  const baseUrl = process.env.PAYGATE_BASE_URL;
  const apiKey = process.env.PAYGATE_API_KEY;
  const callbackSecret = process.env.PAYGATE_CALLBACK_SECRET;
  if (!baseUrl || !apiKey || !callbackSecret) {
    throw new Error('PAYGATE_BASE_URL/PAYGATE_API_KEY/PAYGATE_CALLBACK_SECRET não configurados');
  }
  return new PayGateProvider(baseUrl, apiKey, callbackSecret);
}

function validateByTipo(tipo: string, documentData: unknown) {
  if (tipo === 'fatura') return validateInvoicePayload(documentData);
  if (tipo === 'cotacao') return validateQuotationPayload(documentData);
  if (tipo === 'recibo') return validateReceiptPayload(documentData);
  return { ok: false as const, errors: [{ path: 'tipo', message: 'Tipo de documento inválido' }] };
}

function getDocumentNumero(tipo: string, formData: any): string | undefined {
  if (tipo === 'fatura') return formData.faturaNumero;
  if (tipo === 'cotacao') return formData.cotacaoNumero;
  return formData.reciboNumero;
}

export const POST = withApiGuard(async (request: NextRequest, { user }) => {
  const startTime = Date.now();

  try {
    const supabase = await supabaseServer();

    let body: CheckoutBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'JSON inválido' }
      }, { status: 400 });
    }

    if (!body?.tipo || !body?.documentData || !body?.method) {
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'tipo, documentData e method são obrigatórios' }
      }, { status: 400 });
    }

    if (!ALL_PAYMENT_METHODS.includes(body.method)) {
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: `method inválido (${ALL_PAYMENT_METHODS.join('|')})` }
      }, { status: 400 });
    }

    // payerPhone só é validado mais abaixo, DEPOIS de confirmar que o
    // utilizador não tem subscrição ativa -- um subscritor não é cobrado
    // (cria o documento direto, ver hasActiveSubscription abaixo) e não deve
    // ser bloqueado a indicar um número que nunca seria usado.

    const validation = validateByTipo(body.tipo, body.documentData);
    if (!validation.ok) {
      await logger.log({
        action: 'validation',
        level: 'warn',
        message: 'Payload de checkout reprovado na validação de schema',
        details: { user: user.id, tipo: body.tipo, issues: validation.errors }
      });
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Dados do documento inválidos', details: validation.errors }
      }, { status: 400 });
    }

    const { formData, items, totais, logo, assinatura } = validation.data as any;
    const htmlContent = (body.documentData as any).htmlContent;
    const numero = getDocumentNumero(body.tipo, formData);

    // Bug corrigido 2026-07-05: subscritores do plano mensal ("documentos
    // ilimitados") estavam a ser cobrados 10 MT por documento na mesma --
    // nada neste fluxo verificava a subscrição antes de cobrar via PaySuite.
    // Com subscrição ativa, cria o documento diretamente (mesma lógica que o
    // webhook usa após confirmar um pagamento avulso), sem tocar no gateway.
    if (await hasActiveSubscription(supabase, user.id)) {
      const [emitenteId, destinatarioId] = await Promise.all([
        ensureEmitenteId(user.id, formData.emitente, supabase),
        ensureDestinatarioId(user.id, formData.destinatario, supabase)
      ]);

      const dadosEspecificos = buildDadosEspecificos({ tipo: body.tipo, formData, logo, assinatura, totais });
      const itensMapeados = mapItensParaRpc(items);

      const { data: documentoId, error: rpcError } = await supabase.rpc('criar_documento_completo', {
        p_user_id: user.id,
        p_tipo_documento: body.tipo,
        p_emitente_id: emitenteId,
        p_destinatario_id: destinatarioId,
        p_dados_especificos: dadosEspecificos,
        p_itens: itensMapeados,
        p_html_content: htmlContent ?? null
      });

      if (rpcError || !documentoId) {
        await logger.logError(rpcError ?? new Error('criar_documento_completo devolveu vazio'), 'subscription_direct_create_failed', {
          user: user.id,
          tipo: body.tipo
        });
        return NextResponse.json({
          success: false,
          error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Falha ao criar documento' }
        }, { status: 500 });
      }

      const numeroReal = await fetchNumeroDocumento(supabase, documentoId);

      await logger.log({
        action: 'audit_action_generic',
        level: 'audit',
        message: 'Documento criado diretamente via subscrição ativa (sem cobrança PaySuite)',
        details: { user: user.id, tipo: body.tipo, documentoId }
      });

      return NextResponse.json({
        success: true,
        data: { direct: true, document_id: documentoId, numero: numeroReal }
      });
    }

    // Só a partir daqui é que vai mesmo haver cobrança (sem subscrição ativa).
    let payerPhone: string | undefined;
    if (MOBILE_MONEY_METHODS.includes(body.method)) {
      payerPhone = normalizeMozambiquePhone(body.payerPhone || '') ?? undefined;
      if (!payerPhone) {
        return NextResponse.json({
          success: false,
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'payerPhone inválido (use o formato 84XXXXXXX) -- obrigatório para mpesa/emola/mkesh' }
        }, { status: 400 });
      }
    }

    const { amount, currency } = resolveChargeAmount(PLANS.pay_per_documento, body.method);
    const reference = generatePaymentReference(body.tipo.slice(0, 3));

    // Gerado antes de chamar o PaySuite (não depois de inserir o registo)
    // para podermos incluir o payment_id no returnUrl -- a página de
    // destino usa-o para mostrar/descarregar o documento certo em vez de
    // redirecionar para uma página genérica da lista de documentos.
    const pagamentoId = randomUUID();

    let provider: PayGateProvider;
    try {
      provider = getProvider();
    } catch (e) {
      await logger.logError(e as Error, 'paysuite_checkout_config_missing', { user: user.id });
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Pagamentos indisponíveis no momento' }
      }, { status: 500 });
    }

    let charge;
    try {
      charge = await provider.charge({
        amount,
        currency,
        reference,
        description: `Documento ${numero || body.tipo} - Invoice Hub Pro`,
        method: body.method,
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pages/payments/success?payment_id=${pagamentoId}`,
        payerPhone,
        payerName: user.user_metadata?.full_name || formData?.emitente?.nomeEmpresa || user.email,
        payerEmail: user.email
      });
    } catch (e) {
      // Aguardado (não a fila normal) -- uma falha real ao chamar o
      // PaySuite não pode desaparecer por a função serverless suspender
      // antes da escrita em segundo plano ter corrido.
      await logger.logErrorAwaited(e as Error, 'paysuite_checkout_charge_failed', {
        user: user.id,
        reference,
        providerDetails: (e as { details?: unknown })?.details
      });
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.PAYMENT_ERROR, message: 'Falha ao iniciar pagamento. Tente novamente.' }
      }, { status: 502 });
    }

    const { data: pagamento, error: insertError } = await supabase
      .from('pagamentos')
      .insert({
        id: pagamentoId,
        user_id: user.id,
        documento_id: null,
        tipo_documento: body.tipo,
        external_id: charge.providerPaymentId,
        metodo: body.method,
        gateway: 'paysuite',
        status: 'aguardando_documento',
        valor: amount,
        moeda: currency,
        metadata: {
          document_payload: { tipo: body.tipo, formData, items, totais, logo, assinatura, html_content: htmlContent },
          reference
        }
      })
      .select('id')
      .single();

    if (insertError || !pagamento) {
      await logger.logError(insertError ?? new Error('Insert de pagamento devolveu vazio'), 'paysuite_checkout_persist_failed', {
        user: user.id,
        providerPaymentId: charge.providerPaymentId
      });
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Falha ao registar pagamento' }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        payment_id: pagamento.id,
        checkout_url: charge.checkoutUrl
      }
    });
  } catch (error) {
    await logger.logError(error as Error, 'paysuite_checkout_unexpected', { user: user?.id });
    return NextResponse.json({
      success: false,
      error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Erro interno do servidor' }
    }, { status: 500 });
  } finally {
    await logger.logApiCall('/api/payments/checkout', 'POST', Date.now() - startTime, true);
  }
}, { auth: true, rate: { limit: 10, intervalMs: 60_000 }, csrf: true, auditAction: 'paysuite_checkout' });
