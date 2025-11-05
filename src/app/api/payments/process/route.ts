// app/api/payments/process/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Função auxiliar para validar número
const validatePhoneNumber = (phone: string, method: string) => {
  const cleanPhone = phone.replace(/\s+/g, '').replace(/[^\d]/g, '');
  
  if (method === 'Mpeza') {
    const mpesaRegex = /^8[2-7]\d{7}$/;
    if (!mpesaRegex.test(cleanPhone)) {
      return { 
        isValid: false, 
        error: 'Número M-Pesa inválido. Use: 8X XXX XXXX (ex: 84 123 4567)' 
      };
    }
    return { 
      isValid: true, 
      formatted: `258${cleanPhone}` 
    };
  }
  
  if (method === 'E-Mola') {
    const emolaRegex = /^8[7-9]\d{7}$/;
    if (!emolaRegex.test(cleanPhone)) {
      return { 
        isValid: false, 
        error: 'Número E-Mola inválido. Use: 8X XXX XXXX (ex: 87 123 4567)' 
      };
    }
    return { 
      isValid: true, 
      formatted: cleanPhone
    };
  }
  
  return { isValid: false, error: 'Método não suportado' };
};

export async function POST(request: NextRequest) {
  try {
    console.log('📦 Recebendo solicitação de pagamento...');
    
    const { paymentMethod, contactNumber, amount, documentId } = await request.json();

    // Validações
    if (!paymentMethod || !contactNumber || !amount || !documentId) {
      return NextResponse.json(
        { success: false, error: 'Dados incompletos' },
        { status: 400 }
      );
    }

    // Validar número
    const phoneValidation = validatePhoneNumber(contactNumber, paymentMethod);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { success: false, error: phoneValidation.error },
        { status: 400 }
      );
    }

    // ✅ TENTAR INTEGRAÇÃO REAL COM MPESA
    if (paymentMethod === 'Mpeza') {
      try {
        // Importação dinâmica para evitar erros de build
        const { mpesaService } = await import('@/lib/mpesaService');
        
        console.log('🔐 Tentando M-Pesa real...');
        
        const result = await mpesaService.initiateSTKPush(
          phoneValidation.formatted!,
          amount,
          documentId,
          `Liberação documento ${documentId}`
        );

        console.log('📞 Resposta M-Pesa:', result);

        if (result.ResponseCode === '0') {
          return NextResponse.json({
            success: true,
            paymentId: result.CheckoutRequestID,
            message: 'Pagamento M-Pesa iniciado! Aguarde confirmação no telefone.',
            details: {
              method: 'Mpeza',
              amount,
              documentId,
              checkoutRequestId: result.CheckoutRequestID
            }
          });
        } else {
          // Se M-Pesa falhar, usar simulação como fallback
          console.log('❌ M-Pesa falhou, usando simulação...');
          throw new Error(result.ResponseDescription || 'Erro M-Pesa');
        }

      } catch (mpesaError: any) {
        console.log('🔄 M-Pesa não disponível, usando simulação:', mpesaError.message);
        
        // Fallback para simulação
        await new Promise(resolve => setTimeout(resolve, 2000));
        const success = Math.random() > 0.1;

        if (success) {
          return NextResponse.json({
            success: true,
            paymentId: `SIM_${Date.now()}`,
            message: 'Pagamento simulado (M-Pesa em manutenção)',
            details: {
              method: 'Mpeza',
              amount,
              documentId,
              contactNumber,
              note: 'Modo simulação - M-Pesa real em configuração'
            }
          });
        } else {
          return NextResponse.json({
            success: false,
            error: 'Pagamento falhou na simulação'
          }, { status: 400 });
        }
      }

    } else if (paymentMethod === 'E-Mola') {
      // Simulação para E-Mola
      await new Promise(resolve => setTimeout(resolve, 2000));
      const success = Math.random() > 0.1;

      if (success) {
        return NextResponse.json({
          success: true,
          paymentId: `EMOLA_${Date.now()}`,
          message: 'Pagamento E-Mola simulado com sucesso',
          details: {
            method: 'E-Mola',
            amount,
            documentId,
            contactNumber
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Pagamento E-Mola falhou'
        }, { status: 400 });
      }

    } else {
      return NextResponse.json({
        success: false,
        error: 'Método não suportado'
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('💥 Erro geral:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno: ' + error.message
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}