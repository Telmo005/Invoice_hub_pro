// src/app/api/mpesa/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { MpesaService } from './services/mpesa-service'

export async function POST(request: NextRequest) {
  try {
    console.log('📍 API MPesa chamada - Processando pagamento...')

    // 1. OBTER PAYLOAD (sem validações complexas)
    let body: any
    try {
      body = await request.json()
      console.log('📦 Payload recebido:', body)
    } catch (error) {
      console.error('❌ Erro no JSON:', error)
      return NextResponse.json(
        { 
          success: false, 
          message: 'Payload JSON inválido' 
        },
        { status: 400 }
      )
    }

    const { 
      amount, 
      customer_msisdn, 
      transaction_reference, 
      third_party_reference 
    } = body

    // ✅ APENAS VALIDAÇÕES BÁSICAS DE EXISTÊNCIA
    if (!amount || !customer_msisdn || !transaction_reference) {
      console.error('❌ Campos em falta')
      return NextResponse.json(
        {
          success: false,
          message: 'Campos obrigatórios em falta'
        },
        { status: 400 }
      )
    }

    // 2. PROCESSAR NÚMERO (sem validação, apenas formatação)
    const mpesaService = new MpesaService()
    
    // ✅ APENAS FORMATAR número (validação feita no hook)
    const formattedMsisdn = mpesaService.formatPhoneNumber(customer_msisdn)
    console.log('✅ Número formatado:', { 
      original: customer_msisdn, 
      formatado: formattedMsisdn 
    })

    // 3. PREPARAR REQUEST MPESA
    const mpesaPayload = {
      transaction_reference, // ✅ Já vem formatado do hook com ORDER prefix
      customer_msisdn: formattedMsisdn,
      amount,
      third_party_reference: third_party_reference,
      service_provider_code: '171717'
    }

    console.log('📤 Enviando para MPesa:', mpesaPayload)

    // 4. CHAMAR API MPESA
    const mpesaResult = await mpesaService.processPayment(mpesaPayload)

    // 5. RETORNAR RESPOSTA
    const response = {
      success: mpesaResult.success,
      mpesa_transaction_id: mpesaResult.data?.transaction_id,
      conversation_id: mpesaResult.data?.conversation_id,
      third_party_reference: mpesaPayload.third_party_reference,
      response_code: mpesaResult.data?.response_code,
      response_description: mpesaResult.data?.response_description,
      status: mpesaResult.success ? 'completed' : 'failed',
      message: mpesaResult.message || 'Pagamento processado via MPesa',
      timestamp: new Date().toISOString()
    }

    console.log('🎉 Resposta final:', response)
    return NextResponse.json(response)

  } catch (error) {
    console.error('💥 Erro na API MPesa:', error)
    
    return NextResponse.json(
      { 
        success: false,
        message: 'Erro ao processar pagamento MPesa',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }, 
      { status: 500 }
    )
  }
}

// ✅ MÉTODO OPTIONS PARA CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}c