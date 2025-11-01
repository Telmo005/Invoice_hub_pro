export interface PaymentRequest {
    paymentMethod: 'Mpeza' | 'E-Mola';
    amount: number;
    currency: string;
    phoneNumber: string;
    invoiceNumber: string;
    invoiceData?: any;
}

export interface PaymentResponse {
    success: boolean;
    paymentId?: string;
    transactionId?: string;
    message?: string;
    error?: string;
}