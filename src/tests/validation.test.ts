import { describe, it, expect } from 'vitest';
import { isEmail, validateEmissor } from '@/lib/validation';

describe('validation utils', () => {
  it('validates email format', () => {
    expect(isEmail('user@example.com')).toBe(true);
    expect(isEmail('bad-email')).toBe(false);
  });

  it('validates emissor data', () => {
    const result = validateEmissor({
      nome_empresa: 'Empresa',
      documento: '123',
      pais: 'PT',
      cidade: 'Lisboa',
      bairro: 'Centro',
      email: 'contato@empresa.com',
      telefone: '999'
    });
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});
