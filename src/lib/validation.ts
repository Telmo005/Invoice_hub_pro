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

export interface FieldError {
  field: string;
  message: string;
}

export function validateEmissor(input: any): { valid: boolean; errors: FieldError[]; data?: any } {
  const errors: FieldError[] = [];
  if (!isNonEmptyString(input?.nome_empresa)) errors.push({ field: 'nome_empresa', message: 'Nome da empresa é obrigatório' });
  if (!isNonEmptyString(input?.documento)) errors.push({ field: 'documento', message: 'Documento é obrigatório' });
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
