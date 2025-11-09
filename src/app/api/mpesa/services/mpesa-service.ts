// src/app/api/mpesa/services/mpesa-service.ts
import { MpesaPaymentPayload, MpesaPaymentResponse } from '@/types/payment-types'

export class MpesaService {
  private apiKey: string
  private baseURL: string

  constructor() {
    this.apiKey = process.env.MPESA_API_KEY!
    this.baseURL = process.env.MPESA_BASE_URL!
    
    if (!this.apiKey || !this.baseURL) {
      throw new Error('MPESA_API_KEY or MPESA_BASE_URL environment variables are not set')
    }
  }

  /**
   * Valida se o número é um MPesa válido em Moçambique
   */
  validatePhoneNumber(msisdn: string): boolean {
    const cleanNumber = msisdn.replace(/\D/g, '')
    console.log('🔍 Validando número MPesa:', { original: msisdn, clean: cleanNumber })
    
    // ✅ FORMATOS ACEITES PARA MPESA MOÇAMBIQUE:
    const mpesaFormats = [
      /^2588[2-7][0-9]{7}$/,     // 25884XXXXXXX (formato internacional)
      /^8[2-7][0-9]{7}$/,        // 84XXXXXXX (formato nacional)
      /^0?8[2-7][0-9]{7}$/       // 084XXXXXXX (com zero)
    ]
    
    const isValid = mpesaFormats.some(regex => regex.test(cleanNumber))
    console.log('✅ Número MPesa válido:', isValid)
    
    return isValid
  }

  /**
   * Converte número do formato nacional para internacional
   * Exemplo: 842010505 → 258842010505
   */
  formatPhoneNumber(msisdn: string): string {
    const cleanNumber = msisdn.replace(/\D/g, '')
    console.log('🔧 Formatando número:', { original: msisdn, clean: cleanNumber })
    
    // Se já tem código do país (258), retorna como está
    if (cleanNumber.startsWith('258') && cleanNumber.length === 12) {
      console.log('✅ Já está no formato internacional:', cleanNumber)
      return cleanNumber
    }
    
    // Se tem 9 dígitos (84XXXXXXX), adiciona 258
    if (cleanNumber.length === 9 && /^8[2-7]/.test(cleanNumber)) {
      const formatted = `258${cleanNumber}`
      console.log('✅ Convertido para internacional:', formatted)
      return formatted
    }
    
    // Se tem 10 dígitos (084XXXXXXX), remove o 0 e adiciona 258
    if (cleanNumber.length === 10 && cleanNumber.startsWith('08')) {
      const formatted = `258${cleanNumber.slice(1)}`
      console.log('✅ Convertido (com zero):', formatted)
      return formatted
    }
    
    console.log('⚠️  Número retornado sem conversão:', cleanNumber)
    return cleanNumber
  }

  /**
   * Processa pagamento via MPesa
   */
  async processPayment(payload: MpesaPaymentPayload): Promise<MpesaPaymentResponse> {
    try {
      console.log('🔄 Iniciando pagamento MPesa...')
      console.log('📤 Endpoint:', `${this.baseURL}/c2b/payments`)
      console.log('📦 Dados enviados:', {
        transaction_reference: payload.transaction_reference,
        amount: payload.amount,
        customer_msisdn: payload.customer_msisdn,
        third_party_reference: payload.third_party_reference
      })

      const response = await fetch(`${this.baseURL}/c2b/payments`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      console.log('📨 Status da resposta MPesa:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Erro na API MPesa:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })
        throw new Error(`MPesa API error: ${response.status} - ${errorText}`)
      }

      const data: MpesaPaymentResponse = await response.json()
      console.log('✅ Resposta MPesa recebida:', data)
      
      return data

    } catch (error) {
      console.error('💥 Erro ao processar pagamento MPesa:', error)
      throw error
    }
  }
}