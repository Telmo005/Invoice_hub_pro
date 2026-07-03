import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { withApiGuard } from '@/lib/api/guard';
import { logger } from '@/lib/logger';
import { PaySuiteProvider } from '@/lib/payments/providers/PaySuiteProvider';
import { PLANS } from '@/lib/payments/config';
import { PaymentMethod } from '@/lib/payments/PaymentProvider';

// Fase 4 bloco 4e: inicia (ou renova) a assinatura mensal (250 MT) via
// PaySuite. Mesma lógica de "só confirma pelo webhook" do checkout de
// documentos -- aqui não há document_payload, só o subscription_id em
// metadata para o webhook saber que deve chamar renewSubscription() em vez
// de finalizeDocumentPayment() (ver tipo_documento: 'assinatura').
//
// O PaySuite não suporta cobrança recorrente/tokenizada -- por isso esta
// rota é chamada tanto no signup inicial como manualmente todos os meses
// pelo utilizador (a partir de /pages/subscription ou de um lembrete por
// email que leva à mesma página).

interface SubscribeBody {
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

const VALID_METHODS: PaymentMethod[] = ['mpesa', 'emola', 'credit_card'];

export const POST = withApiGuard(async (request: NextRequest, { user }) => {
  const startTime = Date.now();

  try {
    const supabase = await supabaseServer();

    let body: SubscribeBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'JSON inválido' }
      }, { status: 400 });
    }

    if (!body?.method || !VALID_METHODS.includes(body.method)) {
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'method é obrigatório (mpesa|emola|credit_card)' }
      }, { status: 400 });
    }

    // Upsert manual da linha de subscriptions (não pode usar UPSERT nativo
    // porque queremos preservar o status quando já existe uma assinatura
    // ativa -- só a confirmação do webhook deve transicionar para 'ativa').
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    let subscriptionId: string;
    if (existing) {
      subscriptionId = existing.id;
      await supabase
        .from('subscriptions')
        .update({ plano: 'mensal', status: existing.status === 'ativa' ? 'ativa' : 'pendente' })
        .eq('id', subscriptionId);
    } else {
      const { data: created, error: createError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plano: 'mensal',
          status: 'pendente',
          valor_mensal: PLANS.mensal.valor,
          moeda: PLANS.mensal.moeda
        })
        .select('id')
        .single();

      if (createError || !created) {
        await logger.logError(createError ?? new Error('Insert de subscriptions devolveu vazio'), 'paysuite_subscribe_create_failed', { user: user.id });
        return NextResponse.json({
          success: false,
          error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Falha ao criar assinatura' }
        }, { status: 500 });
      }
      subscriptionId = created.id;
    }

    const reference = `IHP-SUB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let provider: PaySuiteProvider;
    try {
      provider = getProvider();
    } catch (e) {
      await logger.logError(e as Error, 'paysuite_subscribe_config_missing', { user: user.id });
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Pagamentos indisponíveis no momento' }
      }, { status: 500 });
    }

    let charge;
    try {
      charge = await provider.charge({
        amount: PLANS.mensal.valor,
        currency: PLANS.mensal.moeda,
        reference,
        description: 'Assinatura mensal - Invoice Hub Pro',
        method: body.method,
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pages/subscription?pagamento=concluido`,
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook/paysuite`
      });
    } catch (e) {
      await logger.logError(e as Error, 'paysuite_subscribe_charge_failed', {
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
        user_id: user.id,
        documento_id: null,
        tipo_documento: 'assinatura',
        external_id: charge.providerPaymentId,
        metodo: body.method,
        gateway: 'paysuite',
        status: 'aguardando_documento',
        valor: PLANS.mensal.valor,
        moeda: PLANS.mensal.moeda,
        metadata: { subscription_id: subscriptionId, reference }
      })
      .select('id')
      .single();

    if (insertError || !pagamento) {
      await logger.logError(insertError ?? new Error('Insert de pagamento devolveu vazio'), 'paysuite_subscribe_persist_failed', {
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
    await logger.logError(error as Error, 'paysuite_subscribe_unexpected', { user: user?.id });
    return NextResponse.json({
      success: false,
      error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Erro interno do servidor' }
    }, { status: 500 });
  } finally {
    await logger.logApiCall('/api/payments/subscribe', 'POST', Date.now() - startTime, true);
  }
}, { auth: true, rate: { limit: 10, intervalMs: 60_000 }, csrf: true, auditAction: 'paysuite_subscribe' });
