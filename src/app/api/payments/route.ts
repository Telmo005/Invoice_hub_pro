import { NextResponse } from 'next/server';
import { validatePaymentRequest } from './validators/paymentValidator';
import { processPayment } from './services/paymentService';
import { PaymentRequest } from './types/payment';
import { rateLimit } from '@/app/api/payments/utils/rateLimit';
import { sanitizeInput } from '@/app/api/payments/utils/security';

// Cache para rate limiting
const requestCache = new Map();

export async function POST(request: Request) {
  try {
    // 1. Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    const isAllowed = await rateLimit(clientIP, requestCache);
    
    if (!isAllowed) {
      return NextResponse.json(
        { success: false, error: 'Muitas tentativas. Tente novamente em 1 minuto.' },
        { status: 429 }
      );
    }

    // 2. Validar Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { success: false, error: 'Content-Type deve ser application/json' },
        { status: 400 }
      );
    }

    const body: PaymentRequest = await request.json();
    
    // 3. Sanitização de inputs
    const sanitizedBody = sanitizeInput(body);
    
    // 4. Validação robusta
    const validation = validatePaymentRequest(sanitizedBody);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // 5. Processamento com timeout
    const result = await Promise.race([
      processPayment(sanitizedBody),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      )
    ]);
    
    return NextResponse.json(result);
    
  } catch (error) {
    // 6. Logging seguro
    console.error('Erro no pagamento:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    // Mensagem específica para timeout
    if (error instanceof Error && error.message === 'Timeout') {
      return NextResponse.json(
        { success: false, error: 'Timeout no processamento do pagamento' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Método GET para verificar status (opcional)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get('paymentId');
  
  if (!paymentId) {
    return NextResponse.json(
      { success: false, error: 'paymentId é obrigatório' },
      { status: 400 }
    );
  }

  try {
    // Simular verificação
    await new Promise(resolve => setTimeout(resolve, 500));

    return NextResponse.json({
      success: true,
      paymentId,
      status: 'completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Erro ao verificar pagamento' },
      { status: 500 }
    );
  }
}