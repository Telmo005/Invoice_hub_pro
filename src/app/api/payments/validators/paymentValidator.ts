import { PaymentRequest } from '../types/payment';

export const validatePaymentRequest = (data: PaymentRequest) => {
  // 1. Validação de campos obrigatórios
  const required = ['paymentMethod', 'amount', 'phoneNumber', 'invoiceNumber'];
  const missing = required.filter(field => !data[field as keyof PaymentRequest]);
  
  if (missing.length > 0) {
    return { isValid: false, error: `Campos obrigatórios: ${missing.join(', ')}` };
  }

  // 2. Validação de tipo
  if (typeof data.amount !== 'number') {
    return { isValid: false, error: 'Amount deve ser número' };
  }

  // 3. Validação de valor
  if (data.amount < 1 || data.amount > 1000000) {
    return { isValid: false, error: 'Valor deve estar entre 1 e 1.000.000 MT' };
  }

  // 4. Validação de método de pagamento
  if (!['Mpeza', 'E-Mola'].includes(data.paymentMethod)) {
    return { isValid: false, error: 'Método de pagamento inválido' };
  }

  // 5. Validação robusta de telefone
  if (!isValidMozambiquePhone(data.phoneNumber)) {
    return { isValid: false, error: 'Número de telefone moçambicano inválido' };
  }

  // 6. Validação de comprimento máximo
  if (data.invoiceNumber.length > 50) {
    return { isValid: false, error: 'Número de fatura muito longo' };
  }

  return { isValid: true };
};

const isValidMozambiquePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  
  // Formato Mozambique: 82, 83, 84, 85, 86, 87 + 7 dígitos
  const phoneRegex = /^8[2-7][0-9]{7}$/;
  
  return phoneRegex.test(cleaned) && cleaned.length === 9;
};