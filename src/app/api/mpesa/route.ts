// src/app/api/mpesa/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { MpesaService } from './services/mpesa-service'
import { logger } from '@/lib/logger'
import { supabaseServer } from '@/lib/supabase-server'

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
        endpoint: '/api/mpesa/payment',
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
          endpoint: '/api/mpesa/payment',
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
          endpoint: '/api/mpesa/payment',
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

    const { 
      amount, 
      customer_msisdn, 
      transaction_reference, 
      third_party_reference,
      tipo_documento,
      document_snapshot
    } = body

    transactionReference = transaction_reference
    customerMsisdn = customer_msisdn

    if (!amount || !customer_msisdn || !transaction_reference) {
      const missingFields = []
      if (!amount) missingFields.push('amount')
      if (!customer_msisdn) missingFields.push('customer_msisdn')
      if (!transaction_reference) missingFields.push('transaction_reference')

      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Campos obrigatórios em falta para processamento MPesa',
        details: {
          endpoint: '/api/mpesa/payment',
          missingFields,
          transactionReference,
          customerMsisdn
        }
      })

      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.MISSING_FIELDS,
          'Campos obrigatórios em falta',
          'São obrigatórios: amount, customer_msisdn, transaction_reference'
        ),
        { status: 400 }
      )
    }

    // ===== Validação adicional do documento antes do pagamento =====
    const allowedTipos = ['fatura','cotacao','recibo'] as const
    const normalizedTipo = (tipo_documento || '').toString().trim().toLowerCase()
    const tipoValido = allowedTipos.includes(normalizedTipo as any) ? normalizedTipo : null

    if (!tipoValido) {
      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.MISSING_FIELDS,
          'tipo_documento inválido ou ausente',
          'Forneça tipo_documento = fatura|cotacao|recibo'
        ),
        { status: 400 }
      )
    }

    // Estrutura mínima esperada para cada tipo
    const snapshot: any = document_snapshot || {}
    const missingDocFields: string[] = []
    const numeroCampo = tipoValido === 'fatura' ? 'faturaNumero' : (tipoValido === 'cotacao' ? 'cotacaoNumero' : 'reciboNumero')
    if (!snapshot[numeroCampo]) missingDocFields.push(numeroCampo)
    if (!snapshot.emitente?.nomeEmpresa) missingDocFields.push('emitente.nomeEmpresa')
    if (tipoValido !== 'recibo' && !snapshot.destinatario?.nomeCompleto) missingDocFields.push('destinatario.nomeCompleto')
    if (tipoValido === 'recibo' && (typeof snapshot.valorRecebido !== 'number' || snapshot.valorRecebido <= 0)) missingDocFields.push('valorRecebido')
    if ((tipoValido === 'fatura' || tipoValido === 'cotacao') && (!Array.isArray(snapshot.items) || snapshot.items.length === 0)) missingDocFields.push('items[]')

    if (missingDocFields.length > 0) {
      await logger.log({
        action: 'validation',
        level: 'warn',
        message: 'Documento inválido antes de pagamento MPesa',
        details: { tipo_documento: tipoValido, missingDocFields, transactionReference }
      })
      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.MISSING_FIELDS,
          'Campos obrigatórios do documento em falta',
          missingDocFields.join(', ')
        ),
        { status: 400 }
      )
    }

    if (typeof amount !== 'number' || amount <= 0) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Valor do pagamento inválido',
        details: {
          endpoint: '/api/mpesa/payment',
          transactionReference,
          amountProvided: amount,
          amountType: typeof amount
        }
      })

      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.MISSING_FIELDS,
          'Amount inválido',
          'Amount deve ser um número positivo'
        ),
        { status: 400 }
      )
    }

    if (typeof customer_msisdn !== 'string') {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Tipo do número de telefone inválido',
        details: {
          endpoint: '/api/mpesa/payment',
          transactionReference,
          customerMsisdn,
          msisdnType: typeof customer_msisdn
        }
      })

      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.MISSING_FIELDS,
          'Número de telefone inválido',
          'customer_msisdn deve ser uma string'
        ),
        { status: 400 }
      )
    }

    if (third_party_reference && third_party_reference.length < 8) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Third party reference muito curto',
        details: {
          endpoint: '/api/mpesa/payment',
          transactionReference,
          thirdPartyReference: third_party_reference,
          length: third_party_reference.length,
          minimumRequired: 8
        }
      })

      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.MISSING_FIELDS,
          'Third party reference inválido',
          'Third party reference deve ter pelo menos 8 caracteres'
        ),
        { status: 400 }
      )
    }

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
          endpoint: '/api/mpesa/payment',
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

    const mpesaPayload = {
      transaction_reference,
      customer_msisdn: formattedMsisdn,
      amount,
      third_party_reference: third_party_reference,
      service_provider_code: '171717'
    }

    const paymentResult = await mpesaService.processPaymentWithRetry(mpesaPayload)

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
          retryAttempts: paymentResult.retryAttempts || 0,
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

      // Registrar pagamento com documento pendente
      const { data: pagamento, error: pagamentoError } = await supabase
        .from('pagamentos')
        .insert({
          user_id: user.id,
          documento_id: null, // aguardando criação
          tipo_documento,
          external_id: transaction_reference,
          metodo: 'mpesa',
          status: 'aguardando_documento',
          valor: amount,
          moeda: body.moeda || 'MZN',
          phone_number: formattedMsisdn,
          mpesa_transaction_id: mpesaData?.transaction_id || null,
          mpesa_conversation_id: mpesaData?.conversation_id || null,
          mpesa_third_party_reference: third_party_reference || null,
          metadata: { originalPayload: body }
        })
        .select()
        .single()

      if (pagamentoError) {
        await logger.logError(pagamentoError, 'mpesa_payment_db_insert', { transactionReference })
        return NextResponse.json(
          createErrorResponse(ERROR_CODES.INTERNAL_ERROR, 'Falha ao registar pagamento', pagamentoError.message, pagamentoError.details),
          { status: 500 }
        )
      }

      // Registrar transação MPesa detalhada
      await supabase.from('mpesa_transactions').insert({
        pagamento_id: pagamento.id,
        transaction_reference,
        third_party_reference: third_party_reference || null,
        mpesa_transaction_id: mpesaData?.transaction_id || null,
        mpesa_conversation_id: mpesaData?.conversation_id || null,
        customer_msisdn: formattedMsisdn,
        amount,
        response_code: mpesaData?.response_code || '0',
        response_description: mpesaData?.response_description || 'SUCCESS',
        status: 'completed',
        request_payload: mpesaPayload,
        response_payload: paymentResult.data || null
      })

      const successResponse = createSuccessResponse({
        third_party_reference: mpesaPayload.third_party_reference,
        status: 'completed',
        mpesa_transaction_id: mpesaData?.transaction_id,
        conversation_id: mpesaData?.conversation_id,
        payment_id: pagamento.id
      }, 'Pagamento processado. Documento pendente de criação.')

      return NextResponse.json(successResponse)
    } else {
      let healthStatus = null
      if (paymentResult.retryAttempts && paymentResult.retryAttempts > 0) {
        healthStatus = await mpesaService.healthCheck()
        
        await logger.log({
          action: 'health_check_diagnostic',
          level: 'warn',
          message: 'Health check após falhas de retry',
          details: {
            transactionReference,
            retryAttempts: paymentResult.retryAttempts,
            serviceHealth: healthStatus.status
          }
        })
      }

      const isServiceUnavailable = 
        healthStatus?.status === 'unhealthy' || 
        paymentResult.message?.toLowerCase().includes('indisponível')

      await logger.log({
        action: 'mpesa_payment_error',
        level: isServiceUnavailable ? 'warn' : 'error',
        message: `Erro no processamento MPesa: ${transaction_reference}`,
        details: {
          transactionReference,
          mpesaError: paymentResult.message,
          isRetryable: paymentResult.isRetryable,
          retryAttempts: paymentResult.retryAttempts,
          serviceHealth: healthStatus?.status
        }
      })

      if (isServiceUnavailable) {
        return NextResponse.json(
          createErrorResponse(
            ERROR_CODES.MPESA_UNAVAILABLE,
            'Serviço temporariamente indisponível',
            'Tente novamente em alguns minutos',
            paymentResult.message,
            true
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
          paymentResult.isRetryable
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
      endpoint: '/api/mpesa/payment'
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
      '/api/mpesa/payment',
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
      endpoint: '/api/mpesa/payment',
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
        endpoint: '/api/mpesa/payment',
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
      endpoint: '/api/mpesa/payment',
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