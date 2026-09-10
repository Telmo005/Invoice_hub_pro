import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { withApiGuard } from '@/lib/api/guard';
import { logger } from '@/lib/logger';
import { PayGateProvider } from '@/lib/payments/providers/PayGateProvider';
import { PaymentProviderError } from '@/lib/payments/PaymentProvider';
import { PLANS } from '@/lib/payments/config';
import { PaymentMethod } from '@/lib/payments/PaymentProvider';
import { ALL_PAYMENT_METHODS, MOBILE_MONEY_METHODS, resolveChargeAmount, normalizeMozambiquePhone } from '@/lib/payments/phone';
import { generatePaymentReference } from '@/lib/payments/generateReference';

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

    if (!body?.method || !ALL_PAYMENT_METHODS.includes(body.method)) {
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: `method inválido (${ALL_PAYMENT_METHODS.join('|')})` }
      }, { status: 400 });
    }

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

    const { amount, currency } = resolveChargeAmount(PLANS.mensal, body.method);
    const reference = generatePaymentReference('SUB');

    let provider: PayGateProvider;
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
        amount,
        currency,
        reference,
        description: 'Assinatura mensal - Invoice Hub Pro',
        method: body.method,
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pages/subscription?pagamento=concluido`,
        payerPhone,
        payerName: user.user_metadata?.full_name || user.email,
        payerEmail: user.email
      });
    } catch (e) {
      // Aguardado (não a fila normal) -- ver a mesma nota em
      // src/app/api/payments/checkout/route.ts.
      await logger.logErrorAwaited(e as Error, 'paysuite_subscribe_charge_failed', {
        user: user.id,
        reference,
        providerDetails: (e as { details?: unknown })?.details
      });
      const message = e instanceof PaymentProviderError ? e.message : 'Falha ao iniciar pagamento. Tente novamente.';
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.PAYMENT_ERROR, message }
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
        valor: amount,
        moeda: currency,
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
