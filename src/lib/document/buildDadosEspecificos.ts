// Extraído dos 3 create routes (invoice/quotation/receipt), que construíam
// exatamente esta mesma forma de objeto de forma independente -- reutilizado
// agora também pelo webhook do PaySuite (Fase 4) para não voltar a duplicar
// a mesma lógica pela 4ª vez.
//
// Regressão 2026-07-04: esta função costumava incluir 'numero' lido do
// formData (o número previsualizado no wizard via /api/document/next-number).
// criar_documento_completo() só reserva o número de forma atómica
// (reservar_numero_documento) quando 'numero' é NULL -- ao reenviar o valor
// previsualizado, a condição de corrida C3 (docs/auditoria-inicial.md)
// continuava viva apesar da função atómica já existir na BD desde a migração
// 20260701_fix_document_numbering_race_condition.sql. Corrigido ao nunca
// incluir 'numero' aqui -- o chamador deve obter o número real a partir do
// documento criado (SELECT numero FROM documentos_base WHERE id = ...).

interface BuildDadosEspecificosParams {
  tipo: 'fatura' | 'cotacao' | 'recibo';
  formData: any;
  logo?: string | null;
  assinatura?: string | null;
  totais?: { desconto?: number };
}

export function buildDadosEspecificos({ tipo, formData, logo, assinatura, totais }: BuildDadosEspecificosParams): Record<string, unknown> {
  const statusDocumento = formData.status === 'paga' ? 'paga' : 'emitida';

  if (tipo === 'fatura') {
    return {
      // 'numero' é deliberadamente omitido -- ver comentário no topo do
      // ficheiro sobre a condição de corrida (C3 na auditoria). O número
      // previsualizado no wizard (via previsualizar_proximo_numero_documento,
      // apenas leitura) nunca é reenviado para criação; criar_documento_completo
      // reserva o número real de forma atómica via reservar_numero_documento
      // quando 'numero' está ausente.
      data_emissao: formData.dataFatura ?? null,
      data_vencimento: formData.dataVencimento ?? null,
      ordem_compra: formData.ordemCompra ?? null,
      termos: formData.termos ?? null,
      moeda: formData.moeda || 'MT',
      logo_url: logo || null,
      assinatura_base64: assinatura || null,
      status: statusDocumento,
      desconto: formData.desconto || 0,
      tipo_desconto: formData.tipoDesconto || 'fixed',
      metodo_pagamento: formData.metodoPagamento || null
    };
  }

  if (tipo === 'cotacao') {
    return {
      data_emissao: formData.dataFatura ?? null,
      data_vencimento: formData.dataVencimento ?? null,
      ordem_compra: formData.ordemCompra ?? null,
      termos: formData.termos ?? null,
      moeda: formData.moeda ?? 'MT',
      logo_url: logo ?? null,
      assinatura_base64: assinatura ?? null,
      validez_dias: formData.validezCotacao ? Number(formData.validezCotacao) : 15,
      desconto: typeof formData.desconto === 'number' ? formData.desconto : (totais?.desconto ?? 0),
      tipo_desconto: formData.tipoDesconto ?? 'fixed',
      metodo_pagamento: formData.metodoPagamento || null,
      status: statusDocumento
    };
  }

  // recibo
  const termos = formData.termos || (formData.formaPagamento ? `Forma de pagamento: ${formData.formaPagamento}` : null);
  return {
    data_emissao: formData.dataRecebimento,
    moeda: formData.moeda || 'MT',
    termos,
    ordem_compra: formData.ordemCompra || null,
    tipo_recibo: 'pagamento',
    valor_recebido: formData.valorRecebido,
    forma_pagamento: formData.formaPagamento || null,
    metodo_pagamento: formData.formaPagamento || null,
    referencia_recebimento: formData.referenciaPagamento || null,
    motivo_pagamento: formData.motivoPagamento || null,
    documento_referencia: formData.documentoAssociadoCustom || null,
    data_recebimento: formData.dataRecebimento,
    local_emissao: formData.emitente?.cidade || null,
    logo_url: logo || null,
    status: statusDocumento
  };
}

export function mapItensParaRpc(items: any[]): Array<Record<string, unknown>> {
  return (items || []).map((it) => ({
    id_original: it.id,
    quantidade: it.quantidade,
    descricao: it.descricao,
    preco_unitario: it.precoUnitario,
    taxas: Array.isArray(it.taxas) ? it.taxas.map((t: any) => ({ nome: t.nome, valor: t.valor, tipo: t.tipo })) : []
  }));
}
