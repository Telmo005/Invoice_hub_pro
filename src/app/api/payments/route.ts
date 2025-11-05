import { NextResponse } from 'next/server';
import { validatePaymentRequest } from './validators/paymentValidator';
import { processPayment } from './services/paymentService';
import { PaymentRequest } from './types/payment';
import { rateLimit } from '@/app/api/payments/utils/rateLimit';
import { sanitizeInput } from '@/app/api/payments/utils/security';
import { logger } from '@/lib/logger';

// Cache para rate limiting
const requestCache = new Map();

// Interface para resposta padronizada
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export async function POST(request: Request) {
  const startTime = Date.now();
  let clientIP: string = 'unknown';
  let paymentData: any = null;

  try {
    // 1. Rate Limiting
    clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    
    // Log de tentativa de pagamento
    await logger.log({
      action: 'payment_create',
      level: 'info',
      message: 'Tentativa de processar pagamento',
      details: {
        clientIP,
        endpoint: '/api/payments',
        method: 'POST'
      }
    });

    const isAllowed = await rateLimit(clientIP, requestCache);
    
    if (!isAllowed) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Rate limit excedido para pagamento',
        details: {
          clientIP,
          endpoint: '/api/payments',
          reason: 'rate_limit_exceeded'
        }
      });

      return NextResponse.json(
        { success: false, error: 'Muitas tentativas. Tente novamente em 1 minuto.' },
        { status: 429 }
      );
    }

    // 2. Validar Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Content-Type inválido para pagamento',
        details: {
          clientIP,
          contentType,
          required: 'application/json'
        }
      });

      return NextResponse.json(
        { success: false, error: 'Content-Type deve ser application/json' },
        { status: 400 }
      );
    }

    const body: PaymentRequest = await request.json();
    
    // 3. Sanitização de inputs
    const sanitizedBody = sanitizeInput(body);
    paymentData = sanitizedBody;
    
    // Log após sanitização
    await logger.log({
      action: 'payment_create',
      level: 'info',
      message: 'Dados do pagamento sanitizados',
      details: {
        clientIP,
        hasAmount: !!sanitizedBody.amount,
        hasCurrency: !!sanitizedBody.currency,
        // Não logar dados sensíveis como cartão, etc.
      }
    });

    // 4. Validação robusta
    const validation = validatePaymentRequest(sanitizedBody);
    if (!validation.isValid) {
      await logger.log({
        action: 'payment_create',
        level: 'warn',
        message: 'Validação de pagamento falhou',
        details: {
          clientIP,
          validationError: validation.error,
          validationDetails: validation.details
        }
      });

      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Log antes do processamento
    await logger.log({
      action: 'payment_create',
      level: 'info',
      message: 'Iniciando processamento do pagamento',
      details: {
        clientIP,
        amount: sanitizedBody.amount,
        currency: sanitizedBody.currency,
        // Outros dados não sensíveis
      }
    });

    // 5. Processamento com timeout
    const result = await Promise.race([
      processPayment(sanitizedBody),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      )
    ]);

    // Log de sucesso no pagamento
    await logger.log({
      action: 'payment_success',
      level: 'audit',
      message: 'Pagamento processado com sucesso',
      details: {
        clientIP,
        paymentId: result.paymentId,
        amount: sanitizedBody.amount,
        currency: sanitizedBody.currency,
        gatewayResponse: result.gatewayResponse // Se disponível
      }
    });
    
    const successResponse: ApiResponse<any> = {
      success: true,
      data: result
    };

    return NextResponse.json(successResponse);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // 6. Logging seguro de erros
    if (error instanceof Error && error.message === 'Timeout') {
      await logger.log({
        action: 'payment_failed',
        level: 'error',
        message: 'Timeout no processamento do pagamento',
        details: {
          clientIP,
          durationMs: duration,
          errorType: 'timeout',
          timeoutMs: 10000
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'TIMEOUT_ERROR',
          message: 'Timeout no processamento do pagamento',
          details: {
            suggestion: 'Tente novamente em alguns instantes'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 408 });
    }

    // Log de erro geral
    await logger.logError(error as Error, 'process_payment_unexpected', {
      clientIP,
      paymentData: paymentData ? {
        amount: paymentData.amount,
        currency: paymentData.currency
        // Não logar dados sensíveis
      } : null,
      durationMs: duration,
      endpoint: '/api/payments',
      method: 'POST'
    });

    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : 'Erro desconhecido') : 
          undefined
      }
    };

    return NextResponse.json(errorResponse, { status: 500 });
  } finally {
    const duration = Date.now() - startTime;
    
    // Log de performance da API
    await logger.logApiCall(
      '/api/payments',
      'POST',
      duration,
      true // Considera sucesso se não caiu no catch
    );
  }
}

// Método GET para verificar status (opcional)
export async function GET(request: Request) {
  const startTime = Date.now();
  let clientIP: string = 'unknown';
  let paymentId: string | null = null;

  try {
    const { searchParams } = new URL(request.url);
    paymentId = searchParams.get('paymentId');
    
    clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // Log de tentativa de verificação
    await logger.log({
      action: 'payment_create',
      level: 'info',
      message: 'Tentativa de verificar status do pagamento',
      details: {
        clientIP,
        paymentId,
        endpoint: '/api/payments',
        method: 'GET'
      }
    });

    if (!paymentId) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'paymentId não fornecido para verificação',
        details: {
          clientIP,
          endpoint: '/api/payments'
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'paymentId é obrigatório',
          details: {
            missingField: 'paymentId',
            expected: 'Parâmetro de query paymentId'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Log antes da verificação
    await logger.log({
      action: 'payment_create',
      level: 'info',
      message: `Verificando status do pagamento: ${paymentId}`,
      details: {
        clientIP,
        paymentId
      }
    });

    // Simular verificação
    await new Promise(resolve => setTimeout(resolve, 500));

    // Log de sucesso na verificação
    await logger.log({
      action: 'payment_create',
      level: 'info',
      message: `Status do pagamento verificado: ${paymentId}`,
      details: {
        clientIP,
        paymentId,
        status: 'completed'
      }
    });

    const successResponse: ApiResponse<any> = {
      success: true,
      data: {
        paymentId,
        status: 'completed',
        timestamp: new Date().toISOString()
      }
    };

    return NextResponse.json(successResponse);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'check_payment_status_unexpected', {
      clientIP,
      paymentId,
      durationMs: duration,
      endpoint: '/api/payments',
      method: 'GET'
    });

    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro ao verificar pagamento',
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : 'Erro desconhecido') : 
          undefined
      }
    };

    return NextResponse.json(errorResponse, { status: 500 });
  } finally {
    const duration = Date.now() - startTime;
    
    // Log de performance da API
    await logger.logApiCall(
      '/api/payments',
      'GET',
      duration,
      true
    );
  }
}