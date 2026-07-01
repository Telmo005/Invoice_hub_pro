// Centralized validation utilities
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isEmail(value: unknown): value is string {
  return isNonEmptyString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function normalizeDocumentoTipo(raw: unknown): 'fatura' | 'cotacao' | 'recibo' | null {
  if (!isNonEmptyString(raw)) return null;
  const v = raw.toLowerCase().trim();
  if (v === 'fatura' || v === 'cotacao' || v === 'recibo') return v;
  return null;
}

// NUIT moçambicano: 9 dígitos. Só é exigido quando o país indicado é
// Moçambique -- emissores/destinatários estrangeiros mantêm apenas a
// verificação de "não vazio" (ver A5 em docs/auditoria-inicial.md).
const MOZAMBIQUE_PAIS_VALUES = ['moçambique', 'mocambique', 'mz', 'mozambique'];

export function isMozambiquePais(pais: unknown): boolean {
  if (!isNonEmptyString(pais)) return false;
  const normalized = pais.trim().toLowerCase();
  return MOZAMBIQUE_PAIS_VALUES.includes(normalized);
}

export function isValidNuit(value: unknown): boolean {
  if (!isNonEmptyString(value)) return false;
  const digitsOnly = value.replace(/[\s-]/g, '');
  return /^\d{9}$/.test(digitsOnly);
}

export interface FieldError {
  field: string;
  message: string;
}

export function validateEmissor(input: any): { valid: boolean; errors: FieldError[]; data?: any } {
  const errors: FieldError[] = [];
  if (!isNonEmptyString(input?.nome_empresa)) errors.push({ field: 'nome_empresa', message: 'Nome da empresa é obrigatório' });
  if (!isNonEmptyString(input?.documento)) errors.push({ field: 'documento', message: 'Documento é obrigatório' });
  else if (isMozambiquePais(input?.pais) && !isValidNuit(input.documento)) {
    errors.push({ field: 'documento', message: 'NUIT inválido: deve ter 9 dígitos' });
  }
  if (!isNonEmptyString(input?.pais)) errors.push({ field: 'pais', message: 'País é obrigatório' });
  if (!isNonEmptyString(input?.cidade)) errors.push({ field: 'cidade', message: 'Cidade é obrigatória' });
  if (!isNonEmptyString(input?.bairro)) errors.push({ field: 'bairro', message: 'Bairro é obrigatório' });
  if (!isNonEmptyString(input?.email)) errors.push({ field: 'email', message: 'Email é obrigatório' });
  else if (!isEmail(input.email)) errors.push({ field: 'email', message: 'Email inválido' });
  if (!isNonEmptyString(input?.telefone)) errors.push({ field: 'telefone', message: 'Telefone é obrigatório' });

  if (errors.length) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    data: {
      nome_empresa: input.nome_empresa.trim(),
      documento: input.documento.trim(),
      pais: input.pais.trim(),
      cidade: input.cidade.trim(),
      bairro: input.bairro.trim(),
      pessoa_contato: input.pessoa_contato?.trim(),
      email: input.email.trim(),
      telefone: input.telefone.trim(),
      padrao: Boolean(input.padrao)
    }
  };
}

export function safeTrim(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.trim() : undefined;
}
