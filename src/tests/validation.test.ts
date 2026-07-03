import { describe, it, expect } from 'vitest';
import { isEmail, isMozambiquePais, isValidNuit, validateEmissor } from '@/lib/validation';

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

// Ver A5 em docs/auditoria-inicial.md: NUIT (9 dígitos) só é exigido quando
// país = Moçambique; estrangeiros mantêm apenas a verificação de não-vazio.
describe('isMozambiquePais', () => {
  it('reconhece variantes comuns de Moçambique', () => {
    expect(isMozambiquePais('Moçambique')).toBe(true);
    expect(isMozambiquePais('Mocambique')).toBe(true);
    expect(isMozambiquePais('mocambique')).toBe(true);
    expect(isMozambiquePais('MZ')).toBe(true);
    expect(isMozambiquePais('  moçambique  ')).toBe(true);
  });

  it('não reconhece outros países ou valores vazios', () => {
    expect(isMozambiquePais('Portugal')).toBe(false);
    expect(isMozambiquePais('')).toBe(false);
    expect(isMozambiquePais(undefined)).toBe(false);
  });
});

describe('isValidNuit', () => {
  it('aceita 9 dígitos, com ou sem espaços/traços', () => {
    expect(isValidNuit('123456789')).toBe(true);
    expect(isValidNuit('123 456 789')).toBe(true);
    expect(isValidNuit('123-456-789')).toBe(true);
  });

  it('rejeita formatos inválidos', () => {
    expect(isValidNuit('12345678')).toBe(false); // 8 dígitos
    expect(isValidNuit('1234567890')).toBe(false); // 10 dígitos
    expect(isValidNuit('abcdefghi')).toBe(false);
    expect(isValidNuit('')).toBe(false);
  });
});

describe('validateEmissor com NUIT condicional', () => {
  it('exige NUIT de 9 dígitos quando país = Moçambique', () => {
    const result = validateEmissor({
      nome_empresa: 'Empresa MZ',
      documento: '123', // inválido para Moçambique
      pais: 'Moçambique',
      cidade: 'Maputo',
      bairro: 'Centro',
      email: 'contato@empresa.co.mz',
      telefone: '841234567'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'documento')).toBe(true);
  });

  it('aceita NUIT de 9 dígitos válido para Moçambique', () => {
    const result = validateEmissor({
      nome_empresa: 'Empresa MZ',
      documento: '123456789',
      pais: 'Moçambique',
      cidade: 'Maputo',
      bairro: 'Centro',
      email: 'contato@empresa.co.mz',
      telefone: '841234567'
    });
    expect(result.valid).toBe(true);
  });

  it('não exige formato de NUIT para países estrangeiros', () => {
    const result = validateEmissor({
      nome_empresa: 'Empresa PT',
      documento: 'PT123', // formato livre, não é Moçambique
      pais: 'Portugal',
      cidade: 'Lisboa',
      bairro: 'Centro',
      email: 'contato@empresa.pt',
      telefone: '911234567'
    });
    expect(result.valid).toBe(true);
  });
});
