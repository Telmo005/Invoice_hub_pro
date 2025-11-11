// src/app/api/mpesa/services/mpesa-service.ts
import { MpesaPaymentPayload, MpesaPaymentResponse } from '@/types/payment-types'

interface HealthCheckResult {
  success: boolean;
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  timestamp: string;
}

interface PaymentResult {
  success: boolean;
  data?: MpesaPaymentResponse;
  message?: string;
  isRetryable?: boolean;
  retryAttempts?: number;
  lastError?: string;
}

export class MpesaService {
  private apiKey: string
  private baseURL: string
  private timeout: number
  private healthCheckCache: HealthCheckResult | null = null
  private readonly HEALTH_CHECK_TTL = 30000; // 30 segundos de cache

  constructor() {
    this.apiKey = process.env.MPESA_API_KEY!
    this.baseURL = process.env.MPESA_BASE_URL!
    this.timeout = parseInt(process.env.MPESA_TIMEOUT || '30000') // 30s default

    this.validateEnvironment()
  }

  /**
   * Validação rigorosa das variáveis de ambiente
   */
  private validateEnvironment(): void {
    const missingVars = []

    if (!this.apiKey) missingVars.push('MPESA_API_KEY')
    if (!this.baseURL) missingVars.push('MPESA_BASE_URL')

    if (missingVars.length > 0) {
      throw new Error(`Variáveis de ambiente necessárias: ${missingVars.join(', ')}`)
    }

    // Valida formato da URL
    try {
      new URL(this.baseURL)
    } catch {
      throw new Error('MPESA_BASE_URL deve ser uma URL válida')
    }
  }

  /**
   * Health check com cache para performance
   */
  async healthCheck(force: boolean = false): Promise<HealthCheckResult> {
    const now = Date.now()

    // Usar cache se disponível e válido (não forçar e cache recente)
    if (!force && this.healthCheckCache) {
      const cacheAge = now - new Date(this.healthCheckCache.timestamp).getTime()
      if (cacheAge < this.HEALTH_CHECK_TTL) {
        return this.healthCheckCache
      }
    }

    const startTime = Date.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout para health check

      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      const result: HealthCheckResult = {
        success: data.success === true,
        status: data.success ? 'healthy' : 'unhealthy',
        responseTime,
        timestamp: new Date().toISOString()
      }

      // Atualizar cache apenas se healthy
      if (result.success) {
        this.healthCheckCache = result
      }

      return result

    } catch (error) {
      const responseTime = Date.now() - startTime
      const result: HealthCheckResult = {
        success: false,
        status: 'unhealthy',
        responseTime,
        timestamp: new Date().toISOString()
      }

      // Invalidar cache em caso de erro
      this.healthCheckCache = null

      return result
    }
  }

  /**
   * Valida se o número é um MPesa válido em Moçambique
   */
  validatePhoneNumber(msisdn: string): boolean {
    const cleanNumber = msisdn.replace(/\D/g, '')

    // ✅ FORMATOS ACEITES PARA MPESA MOÇAMBIQUE:
    const mpesaFormats = [
      /^2588[2-7][0-9]{7}$/,     // 25884XXXXXXX (formato internacional)
      /^8[2-7][0-9]{7}$/,        // 84XXXXXXX (formato nacional)
      /^0?8[2-7][0-9]{7}$/       // 084XXXXXXX (com zero)
    ]

    const isValid = mpesaFormats.some(regex => regex.test(cleanNumber))

    return isValid
  }

  /**
   * Converte número do formato nacional para internacional
   * Exemplo: 842010505 → 258842010505
   */
  formatPhoneNumber(msisdn: string): string {
    const cleanNumber = msisdn.replace(/\D/g, '')

    // Se já tem código do país (258), retorna como está
    if (cleanNumber.startsWith('258') && cleanNumber.length === 12) {
      return cleanNumber
    }

    // Se tem 9 dígitos (84XXXXXXX), adiciona 258
    if (cleanNumber.length === 9 && /^8[2-7]/.test(cleanNumber)) {
      return `258${cleanNumber}`
    }

    // Se tem 10 dígitos (084XXXXXXX), remove o 0 e adiciona 258
    if (cleanNumber.length === 10 && cleanNumber.startsWith('08')) {
      return `258${cleanNumber.slice(1)}`
    }

    return cleanNumber
  }

  /**
   * Processa pagamento via MPesa com timeout e tratamento robusto
   */
  async processPayment(payload: MpesaPaymentPayload): Promise<PaymentResult> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseURL}/c2b/payments`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorText = await response.text()

        // Tentar extrair mensagem do MPesa
        let mpesaErrorMessage = 'Erro ao processar pagamento'
        try {
          const errorData = JSON.parse(errorText)
          mpesaErrorMessage = errorData.detail?.error?.message ||
            errorData.error?.message ||
            errorData.message ||
            mpesaErrorMessage
        } catch {
          mpesaErrorMessage = errorText
        }

        throw new Error(`MPESA_ERROR: ${mpesaErrorMessage}`)
      }

      const data: MpesaPaymentResponse = await response.json()

      return {
        success: true,
        data,
        message: 'Pagamento processado com sucesso'
      }

    } catch (error: any) {
      clearTimeout(timeoutId)
      return this.handlePaymentError(error)
    }
  }

  /**
   * Classificação inteligente de erros para determinar se são recuperáveis
   */
  private handlePaymentError(error: any): PaymentResult {
    const errorMessage = error.message?.toLowerCase() || ''

    // Erros de timeout (recuperáveis)
    if (error.name === 'AbortError' || errorMessage.includes('timeout')) {
      return {
        success: false,
        message: 'Timeout na comunicação com MPesa',
        isRetryable: true,
        lastError: error.message
      }
    }

    // Erros de conexão (recuperáveis)
    if (errorMessage.includes('econnrefused') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('network error')) {
      return {
        success: false,
        message: 'Ops! Tivemos um problema ao processar seu pagamento. Tente novamente em breve.',
        isRetryable: true,
        lastError: error.message
      }
    }

    // Erros do MPesa (não recuperáveis)
    if (errorMessage.startsWith('mpesa_error:')) {
      const userMessage = error.message.replace('MPESA_ERROR:', '').trim()
      return {
        success: false,
        message: userMessage,
        isRetryable: false,
        lastError: error.message
      }
    }

    // Erros genéricos (não recuperáveis)
    return {
      success: false,
      message: 'Erro interno no processamento do pagamento',
      isRetryable: false,
      lastError: error.message
    }
  }

  /**
   * Processamento com retry automático para erros recuperáveis
   */
  async processPaymentWithRetry(payload: MpesaPaymentPayload, maxRetries: number = 2): Promise<PaymentResult> {
    let lastResult: PaymentResult

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      lastResult = await this.processPayment(payload)

      // Sucesso na primeira tentativa
      if (lastResult.success && attempt === 0) {
        return lastResult
      }

      // Sucesso após retry
      if (lastResult.success) {
        return {
          ...lastResult,
          retryAttempts: attempt
        }
      }

      // Se não é recuperável ou última tentativa, para
      if (!lastResult.isRetryable || attempt === maxRetries) {
        break
      }

      // Exponential backoff: 1s, 2s, 4s...
      const delayMs = 1000 * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }

    return {
      ...lastResult!,
      retryAttempts: maxRetries
    }
  }

  /**
   * Método original mantido para compatibilidade
   */
  async processPaymentLegacy(payload: MpesaPaymentPayload): Promise<MpesaPaymentResponse> {
    const result = await this.processPayment(payload)

    if (!result.success) {
      throw new Error(result.message || 'Erro ao processar pagamento')
    }

    if (!result.data) {
      throw new Error('Dados de resposta não encontrados')
    }

    return result.data
  }
}