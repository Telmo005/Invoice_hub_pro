import { describe, it, expect } from 'vitest';
import {
  validateInvoicePayload,
  validateQuotationPayload,
  validateReceiptPayload
} from '@/lib/validation/documentSchemas';

const emitenteMz = {
  nomeEmpresa: 'Empresa Teste',
  documento: '123456789',
  pais: 'Moçambique',
  cidade: 'Maputo',
  bairro: 'Centro',
  email: 'emitente@example.com',
  telefone: '841234567'
};

const destinatario = {
  nomeCompleto: 'Cliente Teste',
  email: 'cliente@example.com',
  telefone: '849876543'
};

const itemComTaxa = {
  id: 1,
  quantidade: 2,
  descricao: 'Produto',
  precoUnitario: 1000,
  taxas: [{ nome: 'IVA', valor: 17, tipo: 'percent' as const }]
};

// Ver A4 em docs/auditoria-inicial.md: os schemas exigiam prefixos 'CTC' e
// 'RCB' que nunca correspondem ao que a BD gera (gerar_numero_documento usa
// 'COT'/'FTR'/'REC') -- teria partido a criação de cotações/recibos assim
// que os schemas fossem ligados às rotas. Isto é um teste de regressão.
describe('validateInvoicePayload -- número FTR', () => {
  it('aceita o prefixo FTR gerado pela BD', () => {
    const result = validateInvoicePayload({
      formData: {
        faturaNumero: 'FTR/2026/001',
        dataFatura: '2026-07-02',
        dataVencimento: '2026-07-16',
        moeda: 'MZN',
        emitente: emitenteMz,
        destinatario
      },
      items: [itemComTaxa]
    });
    expect(result.ok).toBe(true);
  });
});

describe('validateQuotationPayload -- número COT (não CTC)', () => {
  it('aceita o prefixo COT gerado pela BD', () => {
    const result = validateQuotationPayload({
      formData: {
        cotacaoNumero: 'COT/2026/001',
        dataFatura: '2026-07-02',
        dataVencimento: '2026-07-02',
        moeda: 'MZN',
        emitente: emitenteMz,
        destinatario
      },
      items: [itemComTaxa]
    });
    expect(result.ok).toBe(true);
  });

  it('rejeita o prefixo antigo CTC (bug corrigido)', () => {
    const result = validateQuotationPayload({
      formData: {
        cotacaoNumero: 'CTC/2026/001',
        dataFatura: '2026-07-02',
        dataVencimento: '2026-07-02',
        moeda: 'MZN',
        emitente: emitenteMz,
        destinatario
      },
      items: [itemComTaxa]
    });
    expect(result.ok).toBe(false);
  });
});

describe('validateReceiptPayload -- número REC (não RCB)', () => {
  it('aceita o prefixo REC gerado pela BD', () => {
    const result = validateReceiptPayload({
      formData: {
        reciboNumero: 'REC/2026/001',
        dataRecebimento: '2026-07-02',
        valorRecebido: 1000,
        moeda: 'MZN',
        emitente: emitenteMz
      }
    });
    expect(result.ok).toBe(true);
  });

  it('rejeita o prefixo antigo RCB (bug corrigido)', () => {
    const result = validateReceiptPayload({
      formData: {
        reciboNumero: 'RCB/2026/001',
        dataRecebimento: '2026-07-02',
        valorRecebido: 1000,
        moeda: 'MZN',
        emitente: emitenteMz
      }
    });
    expect(result.ok).toBe(false);
  });
});

// Ver A5: NUIT só é obrigatório em 9 dígitos quando pais = Moçambique,
// aplicado também aos emitentes/destinatários submetidos inline no wizard.
describe('emitenteSchema / destinatarioSchema -- NUIT condicional', () => {
  it('rejeita NUIT inválido para emitente moçambicano', () => {
    const result = validateInvoicePayload({
      formData: {
        faturaNumero: 'FTR/2026/002',
        dataFatura: '2026-07-02',
        dataVencimento: '2026-07-16',
        moeda: 'MZN',
        emitente: { ...emitenteMz, documento: '123' },
        destinatario
      },
      items: [itemComTaxa]
    });
    expect(result.ok).toBe(false);
  });

  it('aceita documento livre para emitente estrangeiro', () => {
    const result = validateInvoicePayload({
      formData: {
        faturaNumero: 'FTR/2026/003',
        dataFatura: '2026-07-02',
        dataVencimento: '2026-07-16',
        moeda: 'MZN',
        emitente: { ...emitenteMz, pais: 'Portugal', documento: 'PT-999' },
        destinatario
      },
      items: [itemComTaxa]
    });
    expect(result.ok).toBe(true);
  });
});

// 2026-07-03: descoberto ao testar o checkout PaySuite em produção pela
// primeira vez -- o wizard envia `null` (não `undefined`) para campos
// opcionais como pessoaContato/logo/assinatura (assinatura é SEMPRE null,
// não há UI para a preencher), mas .optional() só aceita undefined,
// rejeitando null com "Expected string, received null". Isto reprovava a
// validação em praticamente qualquer documento real -- checkout e,
// potencialmente, também a criação direta (mesmo schema). Regressão.
describe('campos opcionais aceitam null (não só undefined)', () => {
  it('aceita logo/assinatura/pessoaContato como null', () => {
    const result = validateInvoicePayload({
      formData: {
        faturaNumero: 'FTR/2026/004',
        dataFatura: '2026-07-02',
        dataVencimento: '2026-07-16',
        moeda: 'MZN',
        emitente: { ...emitenteMz, pessoaContato: null },
        destinatario
      },
      items: [itemComTaxa],
      logo: null,
      assinatura: null
    });
    expect(result.ok).toBe(true);
  });

  it('aceita validezCotacao como string (valor real vindo do formulário)', () => {
    const result = validateQuotationPayload({
      formData: {
        cotacaoNumero: 'COT/2026/004',
        dataFatura: '2026-07-02',
        dataVencimento: '2026-07-16',
        moeda: 'MZN',
        emitente: emitenteMz,
        destinatario,
        validezCotacao: '15'
      },
      items: [itemComTaxa],
      logo: null,
      assinatura: null
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data.formData as any).validezCotacao).toBe(15);
    }
  });
});
