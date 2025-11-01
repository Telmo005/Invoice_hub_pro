// src/config/invoice-config.ts
export const INVOICE_STORAGE_CONFIG = {
  MAX_INVOICES: 100,
  EXPIRATION_TIME_MS: 3600000, // 1 hora
  CLEANUP_INTERVAL_MS: 60000, // 1 minuto
  MAX_DATA_SIZE_BYTES: 2 * 1024 * 1024 // 2MB
};

export const DATA_VALIDATION_CONFIG = {
  REQUIRED_FIELDS: ['formData', 'items', 'totais'],
  MAX_ITEMS: 100,
  MAX_DESCRIPTION_LENGTH: 500
};