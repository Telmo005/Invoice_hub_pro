import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseServer } from '@/lib/supabase-server';
import { withApiGuard } from '@/lib/api/guard';
import { logger } from '@/lib/logger';
import { PaySuiteProvider } from '@/lib/payments/providers/PaySuiteProvider';
import { PLANS } from '@/lib/payments/config';
import { PaymentMethod } from '@/lib/payments/PaymentProvider';
import {
  validateInvoicePayload,
  validateQuotationPayload,
  validateReceiptPayload
} from '@/lib/validation/documentSchemas';

// Fase 4 (docs/auditoria-inicial.md): inicia a cobrança pay-per-documento
// (10 MT) via PaySuite. Nunca gera o documento aqui -- só depois do webhook
// confirmar o pagamento (ver /api/payments/webhook/paysuite). Guarda o
// payload de criação em pagamentos.metadata.document_payload (dados em
// bruto, não IDs já resolvidos) para o webhook fazer ensureEmitenteId/
// ensureDestinatarioId no momento da confirmação -- assim uma cobrança
// falhada não deixa emissores/destinatários órfãos criados sem necessidade.

interface CheckoutBody {
  tipo: 'fatura' | 'cotacao' | 'recibo';
  documentData: unknown;
  method: PaymentMethod;
}

const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

function getProvider(): PaySuiteProvider {
  const apiToken = process.env.PAYSUITE_API_TOKEN;
  const webhookSecret = process.env.PAYSUITE_WEBHOOK_SECRET;
  if (!apiToken || !webhookSecret) {
    throw new Error('PAYSUITE_API_TOKEN/PAYSUITE_WEBHOOK_SECRET não configurados');
  }
  return new PaySuiteProvider(apiToken, webhookSecret);
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
    const amount = PLANS.pay_per_documento.valor;
    // PaySuite exige que "reference" só tenha letras e números (confirmado
    // via resposta 422 em produção 2026-07-03: "The Reference field must
    // only contain letters and numbers.") -- sem traços nem underscores.
    const reference = `IHP${body.tipo.slice(0, 3).toUpperCase()}${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

    // Gerado antes de chamar o PaySuite (não depois de inserir o registo)
    // para podermos incluir o payment_id no returnUrl -- a página de
    // destino usa-o para mostrar/descarregar o documento certo em vez de
    // redirecionar para uma página genérica da lista de documentos.
    const pagamentoId = randomUUID();

    let provider: PaySuiteProvider;
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
        currency: PLANS.pay_per_documento.moeda,
        reference,
        description: `Documento ${numero || body.tipo} - Invoice Hub Pro`,
        method: body.method,
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pages/payments/success?payment_id=${pagamentoId}`,
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook/paysuite`
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
        moeda: PLANS.pay_per_documento.moeda,
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
