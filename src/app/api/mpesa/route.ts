// src/app/api/mpesa/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { MpesaService } from './services/mpesa-service'
import { logger } from '@/lib/logger'
import { supabaseServer } from '@/lib/supabase-server'
import { validateMpesaBody } from './lib/validation'
import { persistMpesaPayment } from './lib/persist'

interface SuccessResponse {
  success: true
  data: {
    mpesa_transaction_id?: string
    conversation_id?: string
    third_party_reference?: string
    response_code?: string
    response_description?: string
    payment_id?: string
    status: 'completed' | 'pending' | 'failed'
  }
  message: string
  timestamp: string
}

interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: string
    mpesa_response?: string
    retry_suggestion?: boolean
  }
  timestamp: string
}

const ERROR_CODES = {
  INVALID_JSON: 'INVALID_JSON',
  MISSING_FIELDS: 'MISSING_FIELDS',
  INVALID_PHONE: 'INVALID_PHONE',
  MPESA_ERROR: 'MPESA_ERROR',
  MPESA_UNAVAILABLE: 'MPESA_UNAVAILABLE',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const

const createSuccessResponse = (data: SuccessResponse['data'], message: string): SuccessResponse => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString()
})

const createErrorResponse = (
  code: string, 
  message: string, 
  details?: string, 
  mpesaResponse?: string,
  retrySuggestion: boolean = false
): ErrorResponse => ({
  success: false,
  error: {
    code,
    message,
    details,
    mpesa_response: mpesaResponse,
    retry_suggestion: retrySuggestion
  },
  timestamp: new Date().toISOString()
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let transactionReference: string | null = null
  let customerMsisdn: string | null = null

  try {
    await logger.log({
      action: 'api_call',
      level: 'info',
      message: 'Iniciando processamento de pagamento MPesa',
      details: {
        endpoint: '/api/mpesa',
        method: 'POST'
      }
    })

    let body: any
    try {
      body = await request.json()
      await logger.log({
        action: 'api_call',
        level: 'info',
        message: 'Payload JSON recebido com sucesso',
        details: {
          endpoint: '/api/mpesa',
          payloadFields: Object.keys(body),
          transactionReference: body.transaction_reference
        }
      })
    } catch (error) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Erro ao processar JSON da requisição',
        details: {
          endpoint: '/api/mpesa',
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        }
      })

      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.INVALID_JSON,
          'Payload JSON inválido'
        ),
        { status: 400 }
      )
    }

    const validation = await validateMpesaBody(body)
    if (!validation.ok) {
      return NextResponse.json(createErrorResponse(validation.error.code, validation.error.message, undefined, undefined, true), { status: 400 })
    }
    const { amount, customer_msisdn, transaction_reference, third_party_reference, moeda } = validation.data
    transactionReference = transaction_reference
    customerMsisdn = customer_msisdn

    const supabase = await supabaseServer()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json(createErrorResponse(ERROR_CODES.INTERNAL_ERROR, 'Não autenticado'), { status: 401 })
    }

    const mpesaService = new MpesaService()
    const formattedMsisdn = mpesaService.formatPhoneNumber(customer_msisdn)
    const sanitizedMsisdn = customer_msisdn.replace(/\D/g, '')
    
    // Validamos sempre o número já formatado para garantir consistência
    if (!mpesaService.validatePhoneNumber(formattedMsisdn)) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Número de telefone inválido para MPesa',
        details: {
          endpoint: '/api/mpesa',
          transactionReference,
          originalMsisdn: customer_msisdn,
          sanitizedMsisdn,
          formattedMsisdn,
          validationTarget: formattedMsisdn,
          hintFormats: ['84XXXXXXX', '084XXXXXXX', '25884XXXXXXX']
        }
      })

      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.INVALID_PHONE,
          'Número de telefone inválido',
          `Use formatos: 84XXXXXXX, 084XXXXXXX ou +25884XXXXXXX (fornecido: ${customer_msisdn})`
        ),
        { status: 400 }
      )
    }

    await logger.log({
      action: 'mpesa_payment_processing',
      level: 'info',
      message: `Iniciando processamento MPesa: ${transaction_reference}`,
      details: {
        transactionReference,
        amount,
        formattedMsisdn,
        thirdPartyReference: third_party_reference
      }
    })

    const mpesaPayload = { transaction_reference, customer_msisdn: formattedMsisdn, amount, third_party_reference, service_provider_code: '171717' }

    // Pagamento agora é tentativa única; removidos retries automáticos
    const paymentResult = await mpesaService.processPayment(mpesaPayload)

    if (paymentResult.success) {
      const mpesaData = paymentResult.data?.data;
      // Log genérico sem acessar propriedades específicas
      await logger.log({
        action: 'mpesa_payment_success',
        level: 'info',
        message: `Pagamento MPesa processado com sucesso: ${transaction_reference}`,
        details: {
          transactionReference,
          amount,
          responseData: paymentResult.data
        }
      })

      // Determinar tipo_documento de forma segura
      const allowedTipos = ['fatura','cotacao','recibo'] as const;
      const rawTipo = (body.tipo_documento || '').toString().trim().toLowerCase();
      const tipo_documento = allowedTipos.includes(rawTipo as any) ? rawTipo : 'fatura';

      if (!rawTipo || rawTipo !== tipo_documento) {
        await logger.log({
          action: 'mpesa_payment_tipo_documento_normalized',
          level: 'warn',
          message: `Normalizado tipo_documento inválido ou ausente ('${rawTipo}') para 'fatura'`,
          details: { provided: rawTipo, used: tipo_documento, transactionReference }
        });
      }

      const persisted = await persistMpesaPayment({
        supabase,
        userId: user.id,
        transaction_reference,
        third_party_reference,
        formattedMsisdn,
        amount,
        moeda,
        tipo_documento,
        mpesaData,
        originalBody: body
      })
      if (!persisted.ok) {
        return NextResponse.json(createErrorResponse(ERROR_CODES.INTERNAL_ERROR, 'Falha ao registar pagamento', persisted.error.message, persisted.error.details), { status: 500 })
      }

      const successResponse = createSuccessResponse({
        third_party_reference: mpesaPayload.third_party_reference,
        status: 'completed',
        mpesa_transaction_id: mpesaData?.transaction_id,
        conversation_id: mpesaData?.conversation_id,
        payment_id: persisted.pagamento.id
      }, 'Pagamento processado. Documento pendente de criação.')

      return NextResponse.json(successResponse)
    } else {
      // Sem retries automáticos: apenas uma tentativa e retorno direto ao cliente
      const isServiceUnavailable = paymentResult.message?.toLowerCase().includes('indisponível')

      await logger.log({
        action: 'mpesa_payment_error',
        level: isServiceUnavailable ? 'warn' : 'error',
        message: `Erro no processamento MPesa: ${transaction_reference}`,
        details: {
          transactionReference,
          mpesaError: paymentResult.message,
          isRetryable: paymentResult.isRetryable
        }
      })

      if (isServiceUnavailable) {
        return NextResponse.json(
          createErrorResponse(
            ERROR_CODES.MPESA_UNAVAILABLE,
            'Serviço temporariamente indisponível',
            'Tente novamente em alguns minutos',
            paymentResult.message,
            false
          ),
          { status: 503 }
        )
      }

      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.MPESA_ERROR,
          paymentResult.message || 'Erro ao processar pagamento',
          paymentResult.message,
          paymentResult.message,
          false // nunca sugerir retry automático
        ),
        { status: 422 }
      )
    }

  } catch (error) {
    const duration = Date.now() - startTime
    
    await logger.logError(error as Error, 'mpesa_payment_unexpected', {
      transactionReference,
      customerMsisdn,
      durationMs: duration,
      endpoint: '/api/mpesa'
    })

    const errorResponse = createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Erro interno ao processar pagamento',
      process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Erro desconhecido') : undefined
    )

    return NextResponse.json(errorResponse, { status: 500 })
  } finally {
    const duration = Date.now() - startTime
    
    await logger.logApiCall(
      '/api/mpesa',
      'POST',
      duration,
      transactionReference !== null
    )
  }
}

export async function OPTIONS() {
  await logger.log({
    action: 'api_call',
    level: 'info',
    message: 'Requisição OPTIONS para MPesa',
    details: {
      endpoint: '/api/mpesa',
      method: 'OPTIONS'
    }
  })

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function GET() {
  const startTime = Date.now()
  
  try {
    const mpesaService = new MpesaService()
    const healthStatus = await mpesaService.healthCheck(true)
    
    await logger.log({
      action: 'health_check',
      level: 'info',
      message: 'Health check da API MPesa',
      details: {
        endpoint: '/api/mpesa',
        method: 'GET',
        mpesaServiceStatus: healthStatus.status,
        responseTime: healthStatus.responseTime,
        durationMs: Date.now() - startTime
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        status: healthStatus.status,
        response_time: healthStatus.responseTime,
        timestamp: healthStatus.timestamp
      },
      message: healthStatus.success ? 
        'API MPesa está operacional' : 
        'API MPesa com problemas de conectividade',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    await logger.logError(error as Error, 'health_check_failed', {
      endpoint: '/api/mpesa',
      method: 'GET'
    })

    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'Erro ao verificar saúde do serviço'
      ),
      { status: 500 }
    )
  }
}