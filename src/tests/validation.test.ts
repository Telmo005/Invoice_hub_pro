import { describe, it, expect } from 'vitest';
import { isEmail, isMozambiquePais, isValidNuit, isValidDocumentoFiscal, validateEmissor } from '@/lib/validation';

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

// 2026-07-05: campo "Documento Fiscal" deixou de estar limitado ao NUIT --
// o utilizador escolhe o tipo (NUIT/NIF/VAT/TIN/CPF/Outro). Só o NUIT tem
// regra de formato real, e só quando o país é Moçambique.
describe('isValidDocumentoFiscal (documento fiscal genérico)', () => {
  it('exige 9 dígitos apenas para NUIT em Moçambique', () => {
    expect(isValidDocumentoFiscal('NUIT', '123', 'Moçambique')).toBe(false);
    expect(isValidDocumentoFiscal('NUIT', '123456789', 'Moçambique')).toBe(true);
  });

  it('não aplica a regra de 9 dígitos a outros tipos, mesmo em Moçambique', () => {
    expect(isValidDocumentoFiscal('NIF', '123', 'Moçambique')).toBe(true);
    expect(isValidDocumentoFiscal('VAT', 'GB123456789', 'Moçambique')).toBe(true);
    expect(isValidDocumentoFiscal('CPF', '12345678900', 'Moçambique')).toBe(true);
    expect(isValidDocumentoFiscal('Outro', 'qualquer-coisa', 'Moçambique')).toBe(true);
  });

  it('continua a exigir que o campo não esteja vazio, seja qual for o tipo', () => {
    expect(isValidDocumentoFiscal('Outro', '', 'Moçambique')).toBe(false);
    expect(isValidDocumentoFiscal('NIF', '', 'Portugal')).toBe(false);
  });

  it('validateEmissor aceita um NIF não-numérico para uma empresa em Moçambique', () => {
    const result = validateEmissor({
      nome_empresa: 'Empresa MZ com NIF estrangeiro',
      documento: 'NIF-ABC-123',
      documento_tipo: 'NIF',
      pais: 'Moçambique',
      cidade: 'Maputo',
      bairro: 'Centro',
      email: 'contato@empresa.co.mz',
      telefone: '841234567'
    });
    expect(result.valid).toBe(true);
    expect(result.data?.documento_tipo).toBe('NIF');
  });

  it('validateEmissor sem documento_tipo continua a tratar como NUIT (compatibilidade)', () => {
    const result = validateEmissor({
      nome_empresa: 'Empresa MZ antiga',
      documento: '123',
      pais: 'Moçambique',
      cidade: 'Maputo',
      bairro: 'Centro',
      email: 'contato@empresa.co.mz',
      telefone: '841234567'
    });
    expect(result.valid).toBe(false);
  });
});
