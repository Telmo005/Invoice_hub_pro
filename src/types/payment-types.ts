// src/types/payment-types.ts
export interface MpesaPaymentPayload {
  transaction_reference: string
  customer_msisdn: string
  amount: number
  third_party_reference?: string
  service_provider_code?: string
}

export interface MpesaPaymentResponse {
  success: boolean
  data?: {
    transaction_id: string
    conversation_id: string
    third_party_reference: string
    response_code: string
    response_description: string
  }
  message?: string
  timestamp?: string
  detail?: {
    success: boolean
    error: {
      code: string
      message: string
    }
  }
}