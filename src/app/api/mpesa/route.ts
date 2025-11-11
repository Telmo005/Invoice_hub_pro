// src/app/api/mpesa/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { MpesaService } from './services/mpesa-service'
import { logger } from '@/lib/logger'

interface SuccessResponse {
  success: true
  data: {
    mpesa_transaction_id?: string
    conversation_id?: string
    third_party_reference?: string
    response_code?: string
    response_description?: string
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
      third_party_reference 
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

    const mpesaService = new MpesaService()
    const formattedMsisdn = mpesaService.formatPhoneNumber(customer_msisdn)
    
    if (!mpesaService.validatePhoneNumber(customer_msisdn)) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Número de telefone inválido para MPesa',
        details: {
          endpoint: '/api/mpesa/payment',
          transactionReference,
          originalMsisdn: customer_msisdn,
          formattedMsisdn
        }
      })

      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.INVALID_PHONE,
          'Número de telefone inválido',
          `Formato inválido para MPesa: ${customer_msisdn}`
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

      // Resposta genérica sem depender de propriedades específicas
      const successResponse = createSuccessResponse(
        {
          third_party_reference: mpesaPayload.third_party_reference,
          status: 'completed'
        },
        'Pagamento processado com sucesso via MPesa'
      )

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
            'Serviço MPesa temporariamente indisponível',
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