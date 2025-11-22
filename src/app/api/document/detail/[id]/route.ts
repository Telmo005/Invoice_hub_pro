import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import { InvoiceData, FormDataFatura, ItemFatura } from '@/types/invoice-types';

interface ApiResponse<T=any> { success: boolean; data?: T; error?: { code: string; message: string; details?: any } }

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const start = Date.now();
  const supabase = await supabaseServer();
  const documentoId = params.id;
  let userId: string | null = null;

  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json<ApiResponse>({ success: false, error: { code: 'UNAUTHORIZED', message: 'Não autenticado' } }, { status: 401 });
    }
    userId = user.id;

    // Carregar base + tipo via view para determinar tipo_documento
    const { data: viewDoc, error: viewErr } = await supabase
      .from('view_documentos_pagamentos')
      .select('id, user_id, numero, tipo_documento, moeda, data_criacao, data_vencimento, status_documento')
      .eq('id', documentoId)
      .eq('user_id', userId)
      .single();

    if (viewErr || !viewDoc) {
      return NextResponse.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Documento não encontrado' } }, { status: 404 });
    }

    const tipo = (viewDoc as any).tipo_documento as 'fatura' | 'cotacao' | 'recibo';

    // Carregar emitente/destinatario detalhados via documentos_base
    const { data: baseDoc, error: baseErr } = await supabase
      .from('documentos_base')
      .select('id, numero, moeda, termos, ordem_compra, data_emissao, emitente_id, destinatario_id')
      .eq('id', documentoId)
      .single();

    if (baseErr || !baseDoc) {
      return NextResponse.json<ApiResponse>({ success: false, error: { code: 'BASE_NOT_FOUND', message: 'Base do documento não encontrada' } }, { status: 404 });
    }

    // Emitente
    const { data: emitenteRow } = await supabase
      .from('emissores')
      .select('nome_empresa, documento, pais, cidade, bairro, email, telefone, pessoa_contato')
      .eq('id', (baseDoc as any).emitente_id)
      .single();

    // Destinatario
    const { data: destinatarioRow } = await supabase
      .from('destinatarios')
      .select('nome_completo, documento, pais, cidade, bairro, email, telefone')
      .eq('id', (baseDoc as any).destinatario_id)
      .single();

    // Itens
    const { data: itensRows } = await supabase
      .from('itens_documento')
      .select('id_original, quantidade, descricao, preco_unitario')
      .eq('documento_id', documentoId);

    const items: ItemFatura[] = (itensRows || []).map((it, idx) => ({
      id: it.id_original || idx + 1,
      quantidade: it.quantidade || 1,
      descricao: it.descricao || 'Item',
      precoUnitario: it.preco_unitario || 0,
      taxas: [],
      totalItem: (it.quantidade || 1) * (it.preco_unitario || 0)
    }));

    // Campos específicos por tipo
    let formSpecific: Partial<FormDataFatura> = {};
    if (tipo === 'fatura') {
      const { data: faturaSpec } = await supabase
        .from('faturas')
        .select('desconto, tipo_desconto, documento_referencia, data_vencimento')
        .eq('id', documentoId)
        .single();
      // calcular validezFatura em dias se possível
      let validezFatura: string | undefined = undefined;
      if (faturaSpec?.data_vencimento && baseDoc.data_emissao) {
        const d1 = new Date(baseDoc.data_emissao);
        const d2 = new Date(faturaSpec.data_vencimento);
        const diffDays = Math.max(0, Math.round((d2.getTime() - d1.getTime()) / (1000*60*60*24)));
        validezFatura = String(diffDays);
      }
      formSpecific = {
        faturaNumero: baseDoc.numero,
        validezFatura,
        desconto: faturaSpec?.desconto || 0,
        tipoDesconto: (faturaSpec?.tipo_desconto as any) || 'fixed',
        dataFatura: baseDoc.data_emissao || new Date().toISOString(),
        dataVencimento: faturaSpec?.data_vencimento || viewDoc.data_vencimento,
        documentoReferencia: faturaSpec?.documento_referencia || undefined
      } as Partial<FormDataFatura>;
    } else if (tipo === 'cotacao') {
      const { data: cotacaoSpec } = await supabase
        .from('cotacoes')
        .select('validez_dias, desconto, tipo_desconto')
        .eq('id', documentoId)
        .single();
      formSpecific = {
        cotacaoNumero: baseDoc.numero,
        validezCotacao: cotacaoSpec?.validez_dias ? String(cotacaoSpec.validez_dias) : undefined,
        desconto: cotacaoSpec?.desconto || 0,
        tipoDesconto: (cotacaoSpec?.tipo_desconto as any) || 'fixed',
        dataFatura: baseDoc.data_emissao || new Date().toISOString()
      } as Partial<FormDataFatura>;
    } else if (tipo === 'recibo') {
      const { data: reciboSpec } = await supabase
        .from('recibos')
        .select('valor_recebido, forma_pagamento, referencia_recebimento, motivo_pagamento, documento_referencia')
        .eq('id', documentoId)
        .single();
      formSpecific = {
        reciboNumero: baseDoc.numero,
        valorRecebido: reciboSpec?.valor_recebido || 0,
        formaPagamento: reciboSpec?.forma_pagamento || 'mpesa',
        referenciaRecebimento: reciboSpec?.referencia_recebimento || undefined,
        motivoPagamento: reciboSpec?.motivo_pagamento || undefined,
        documentoReferencia: reciboSpec?.documento_referencia || undefined,
        dataPagamento: new Date().toISOString(),
        dataFatura: baseDoc.data_emissao || new Date().toISOString(),
        dataRecebimento: baseDoc.data_emissao || new Date().toISOString(),
        desconto: 0,
        tipoDesconto: 'fixed'
      } as Partial<FormDataFatura>;
    }

    const formData: FormDataFatura = {
      tipo,
      emitente: {
        nomeEmpresa: emitenteRow?.nome_empresa || '',
        documento: emitenteRow?.documento || '',
        pais: emitenteRow?.pais || '',
        cidade: emitenteRow?.cidade || '',
        bairro: emitenteRow?.bairro || '',
        email: emitenteRow?.email || '',
        telefone: emitenteRow?.telefone || '',
        pessoaContato: emitenteRow?.pessoa_contato || ''
      },
      destinatario: {
        nomeCompleto: destinatarioRow?.nome_completo || '',
        documento: destinatarioRow?.documento || '',
        pais: destinatarioRow?.pais || '',
        cidade: destinatarioRow?.cidade || '',
        bairro: destinatarioRow?.bairro || '',
        email: destinatarioRow?.email || '',
        telefone: destinatarioRow?.telefone || ''
      },
      dataFatura: baseDoc.data_emissao || new Date().toISOString(),
      ordemCompra: baseDoc.ordem_compra || '',
      termos: baseDoc.termos || '',
      moeda: baseDoc.moeda || 'MZN',
      desconto: (formSpecific as any).desconto || 0,
      tipoDesconto: (formSpecific as any).tipoDesconto || 'fixed',
      faturaNumero: (formSpecific as any).faturaNumero,
      cotacaoNumero: (formSpecific as any).cotacaoNumero,
      reciboNumero: (formSpecific as any).reciboNumero,
      validezFatura: (formSpecific as any).validezFatura,
      validezCotacao: (formSpecific as any).validezCotacao,
      valorRecebido: (formSpecific as any).valorRecebido,
      referenciaRecebimento: (formSpecific as any).referenciaRecebimento,
      formaPagamento: (formSpecific as any).formaPagamento,
      documentoReferencia: (formSpecific as any).documentoReferencia,
      motivoPagamento: (formSpecific as any).motivoPagamento,
      dataRecebimento: (formSpecific as any).dataRecebimento,
      dataPagamento: (formSpecific as any).dataPagamento,
      metodoPagamento: undefined
    };

    // Totais simplificados (recalcular no wizard)
    const subtotal = items.reduce((s, it) => s + (it.quantidade * it.precoUnitario), 0);
    const totais = { subtotal, totalTaxas: 0, totalFinal: subtotal, taxasDetalhadas: [], desconto: formData.desconto };

    const invoiceData: InvoiceData = { tipo, formData, items, totais, logo: null, assinatura: null };

    return NextResponse.json<ApiResponse>({ success: true, data: { invoiceData } });
  } catch (e) {
    await logger.logError(e as Error, 'document_detail_unexpected', { documentoId, userId });
    return NextResponse.json<ApiResponse>({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao obter documento', details: (e as Error).message } }, { status: 500 });
  } finally {
    await logger.logApiCall('/api/document/detail/[id]', 'GET', Date.now() - start, true);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}
