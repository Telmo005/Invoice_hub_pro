import { PaymentResponse } from '@/app/api/payments/types/payment';

export const emolaService = {
    async process(amount: number, phone: string, reference: string): Promise<PaymentResponse> {
        // Sandbox simulation
        if (process.env.MPESA_ENVIRONMENT === 'sandbox') {
            return {
                success: true,
                paymentId: `emola_${Date.now()}`,
                transactionId: `E${Math.random().toString(36).substr(2, 9)}`,
                message: 'Pagamento E-Mola simulado (Sandbox)'
            };
        }

        // Implementação real aqui
        throw new Error('Implementação E-Mola não disponível');
    }
};