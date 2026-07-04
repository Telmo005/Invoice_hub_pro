import { describe, it, expect } from 'vitest';
import { buildDadosEspecificos, mapItensParaRpc } from '@/lib/document/buildDadosEspecificos';

describe('buildDadosEspecificos -- fatura', () => {
  it('mapeia os campos base corretamente', () => {
    const result = buildDadosEspecificos({
      tipo: 'fatura',
      formData: {
        faturaNumero: 'FTR/2026/001',
        dataFatura: '2026-07-03',
        dataVencimento: '2026-07-18',
        ordemCompra: 'OC-1',
        termos: 'Termos',
        moeda: 'MZN',
        desconto: 10,
        tipoDesconto: 'fixed',
        metodoPagamento: 'mpesa'
      }
    });
    expect(result.moeda).toBe('MZN');
    expect(result.desconto).toBe(10);
    expect(result.status).toBe('emitida');
  });
});

// Regressão 2026-07-04: 'numero' costumava ser reenviado a partir do valor
// previsualizado no wizard (/api/document/next-number, antes baseado em
// gerar_numero_documento -- COUNT(*) sujeito à condição de corrida C3 da
// auditoria). criar_documento_completo só reserva o número de forma atómica
// via reservar_numero_documento quando 'numero' está ausente; ao reenviar o
// valor previsualizado, a correção da condição de corrida (já presente na BD
// desde 20260701_fix_document_numbering_race_condition.sql) nunca era
// efetivamente usada. 'numero' nunca deve ser incluído no resultado, mesmo
// que faturaNumero/cotacaoNumero/reciboNumero venham preenchidos.
describe('buildDadosEspecificos -- nunca reenvia o número previsualizado', () => {
  it('omite numero para fatura', () => {
    const result = buildDadosEspecificos({
      tipo: 'fatura',
      formData: { faturaNumero: 'FTR/2026/001', dataFatura: '2026-07-03' }
    });
    expect(result.numero).toBeUndefined();
    expect('numero' in result).toBe(false);
  });

  it('omite numero para cotação', () => {
    const result = buildDadosEspecificos({
      tipo: 'cotacao',
      formData: { cotacaoNumero: 'COT/2026/001', dataFatura: '2026-07-03' }
    });
    expect(result.numero).toBeUndefined();
    expect('numero' in result).toBe(false);
  });

  it('omite numero para recibo', () => {
    const result = buildDadosEspecificos({
      tipo: 'recibo',
      formData: { reciboNumero: 'REC/2026/001', dataRecebimento: '2026-07-03', valorRecebido: 100 }
    });
    expect(result.numero).toBeUndefined();
    expect('numero' in result).toBe(false);
  });
});

describe('buildDadosEspecificos -- cotação', () => {
  it('usa 15 dias de validade por defeito quando não informado', () => {
    const result = buildDadosEspecificos({
      tipo: 'cotacao',
      formData: { cotacaoNumero: 'COT/2026/001', dataFatura: '2026-07-03' }
    });
    expect(result.validez_dias).toBe(15);
  });

  it('respeita a validade informada', () => {
    const result = buildDadosEspecificos({
      tipo: 'cotacao',
      formData: { cotacaoNumero: 'COT/2026/001', dataFatura: '2026-07-03', validezCotacao: '30' }
    });
    expect(result.validez_dias).toBe(30);
  });
});

// Regressão 2026-07-03: o formulário grava em formData.referenciaPagamento/
// documentoAssociadoCustom (nomes usados pelos próprios inputs do wizard),
// mas prepareInvoiceData() estava a produzir referenciaRecebimento/
// documentoReferencia -- nomes que esta função NUNCA leu, perdendo os
// dados silenciosamente. Fixa aqui o contrato desta função como a fonte de
// verdade: só aceita os nomes corretos.
describe('buildDadosEspecificos -- recibo', () => {
  it('mapeia referenciaPagamento para referencia_recebimento', () => {
    const result = buildDadosEspecificos({
      tipo: 'recibo',
      formData: {
        reciboNumero: 'REC/2026/001',
        dataRecebimento: '2026-07-03',
        valorRecebido: 100,
        moeda: 'MZN',
        referenciaPagamento: 'REF-123'
      }
    });
    expect(result.referencia_recebimento).toBe('REF-123');
  });

  it('mapeia documentoAssociadoCustom para documento_referencia', () => {
    const result = buildDadosEspecificos({
      tipo: 'recibo',
      formData: {
        reciboNumero: 'REC/2026/001',
        dataRecebimento: '2026-07-03',
        valorRecebido: 100,
        moeda: 'MZN',
        documentoAssociadoCustom: 'FTR/2026/001'
      }
    });
    expect(result.documento_referencia).toBe('FTR/2026/001');
  });

  it('não confunde com os nomes antigos/incorretos (referenciaRecebimento/documentoReferencia)', () => {
    const result = buildDadosEspecificos({
      tipo: 'recibo',
      formData: {
        reciboNumero: 'REC/2026/001',
        dataRecebimento: '2026-07-03',
        valorRecebido: 100,
        moeda: 'MZN',
        // Nomes errados -- não devem ser lidos por esta função.
        referenciaRecebimento: 'NAO-DEVERIA-APARECER',
        documentoReferencia: 'NAO-DEVERIA-APARECER'
      }
    });
    expect(result.referencia_recebimento).toBeNull();
    expect(result.documento_referencia).toBeNull();
  });
});

describe('mapItensParaRpc', () => {
  it('mapeia itens e taxas para o formato esperado pelo RPC', () => {
    const result = mapItensParaRpc([
      { id: 1, quantidade: 2, descricao: 'Produto', precoUnitario: 100, taxas: [{ nome: 'IVA', valor: 17, tipo: 'percent' }] }
    ]);
    expect(result).toEqual([
      { id_original: 1, quantidade: 2, descricao: 'Produto', preco_unitario: 100, taxas: [{ nome: 'IVA', valor: 17, tipo: 'percent' }] }
    ]);
  });

  it('devolve array vazio para itens undefined/null', () => {
    expect(mapItensParaRpc(undefined as any)).toEqual([]);
  });
});
