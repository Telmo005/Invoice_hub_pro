// Versão simplificada sem dependências externas
export const sanitizeInput = (data: any): any => {
  if (typeof data === 'string') {
    // Sanitização básica - remove tags HTML
    return data
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#x27;')
      .replace(/"/g, '&quot;')
      .trim();
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
};

export const maskPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length <= 4) return '****';
  return `${cleaned.slice(0, 2)}****${cleaned.slice(-2)}`;
};

export const isValidAmount = (amount: number): boolean => {
  return amount >= 1 && amount <= 1000000;
};