import { PaymentRequest, PaymentResponse } from '@/app/api/payments/types/payment';;
import { mpesaService } from '@/app/api/payments/services/mpesaService';
import { emolaService } from '@/app/api/payments/services/emolaService';

export const processPayment = async (data: PaymentRequest): Promise<PaymentResponse> => {
  const { paymentMethod, amount, phoneNumber, invoiceNumber } = data;

  console.log('🎯 Iniciando pagamento:', {
    method: paymentMethod,
    amount: `${amount} MT`,
    phone: phoneNumber.replace(/\d(?=\d{4})/g, '*'), // Mask phone in logs
    reference: invoiceNumber
  });

  try {
    let result: PaymentResponse;

    if (paymentMethod === 'Mpeza') {
      result = await mpesaService.process(amount, phoneNumber, invoiceNumber);
    } else {
      result = await emolaService.process(amount, phoneNumber, invoiceNumber);
    }

    // Log do resultado
    if (result.success) {
      console.log('✅ Pagamento bem-sucedido:', {
        paymentId: result.paymentId,
        transactionId: result.transactionId,
        method: paymentMethod
      });
    } else {
      console.log('❌ Pagamento falhou:', {
        error: result.error,
        method: paymentMethod
      });
    }

    return result;

  } catch (error) {
    console.error('💥 Erro crítico no processamento:', error);
    
    return {
      success: false,
      error: 'Erro interno no processamento do pagamento',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};