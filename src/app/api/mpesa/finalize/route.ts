import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

interface ErrorResponse { success: false; error: { code: string; message: string; details?: any } }
interface SuccessResponse { success: true; data: any; message: string; timestamp: string }

const error = (code: string, message: string, details?: any, status: number = 400) =>
  NextResponse.json<ErrorResponse>({ success: false, error: { code, message, details } }, { status });

export async function POST(request: NextRequest) {
  const start = Date.now();
  const supabase = await supabaseServer();
  let userId: string | null = null;
  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return error('UNAUTHORIZED', 'Não autenticado', authErr?.message, 401);
    }
    userId = user.id;

    const body = await request.json();
    const { payment_id, document_payload } = body;

    if (!payment_id || !document_payload) {
      return error('VALIDATION_ERROR', 'payment_id e document_payload são obrigatórios');
    }

    // Idempotência: carregar pagamento independente do estado
    const { data: pagamentoExistente, error: pagamentoExistenteErr } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('id', payment_id)
      .eq('user_id', userId)
      .single();

    if (pagamentoExistenteErr || !pagamentoExistente) {
      return error('PAYMENT_NOT_FOUND', 'Pagamento não encontrado', pagamentoExistenteErr?.message, 404);
    }

    if (pagamentoExistente.documento_id) {
      // Já processado anteriormente
      return NextResponse.json<SuccessResponse>({
        success: true,
        data: { documento_id: pagamentoExistente.documento_id, payment_id, status: pagamentoExistente.status },
        message: 'Pagamento já associado anteriormente (idempotente)',
        timestamp: new Date().toISOString()
      });
    }

    if (pagamentoExistente.status !== 'aguardando_documento') {
      return error('INVALID_STATUS', 'Pagamento não está aguardando documento', { status_atual: pagamentoExistente.status }, 409);
    }

    // Extrair payload para criação
    const {
      emitente_id,
      destinatario_id,
      numero,
      tipo_documento = pagamentoExistente.tipo_documento,
      moeda = pagamentoExistente.moeda,
      itens = [],
      dados_especificos = {},
    } = document_payload;

    if (!emitente_id || !destinatario_id || !numero) {
      return error('DOCUMENT_FIELDS_MISSING', 'emitente_id, destinatario_id e numero são obrigatórios');
    }

    // Criar documento base
    const baseInsert = {
      user_id: userId,
      emitente_id,
      destinatario_id,
      numero,
      status: 'emitida',
      moeda,
      termos: document_payload.termos || null,
      ordem_compra: document_payload.ordem_compra || null,
      html_content: document_payload.html_content || null,
      html_generated_at: document_payload.html_content ? new Date().toISOString() : null
    };

    const { data: baseDoc, error: baseErr } = await supabase
      .from('documentos_base')
      .insert(baseInsert)
      .select('*')
      .single();

    if (baseErr || !baseDoc) {
      await supabase.from('pagamentos').update({ retry_count: (pagamentoExistente.retry_count || 0) + 1, last_retry_at: new Date().toISOString() }).eq('id', pagamentoExistente.id);
      return error('DOCUMENT_CREATE_FAILED', 'Falha ao criar documento base', baseErr?.message, 500);
    }

    // Inserir tabela especializada
    let specError: any = null;
    if (tipo_documento === 'fatura') {
      const { error: fErr } = await supabase.from('faturas').insert({
        id: baseDoc.id,
        data_vencimento: document_payload.data_vencimento || new Date().toISOString().slice(0,10),
        desconto: document_payload.desconto || 0,
        tipo_desconto: document_payload.tipo_desconto || 'fixed',
        documento_referencia: document_payload.documento_referencia || null,
        metodo_pagamento: document_payload.metodo_pagamento || null
      });
      specError = fErr;
    } else if (tipo_documento === 'cotacao') {
      const { error: qErr } = await supabase.from('cotacoes').insert({
        id: baseDoc.id,
        validez_dias: document_payload.validez_dias || 15,
        desconto: document_payload.desconto || 0,
        tipo_desconto: document_payload.tipo_desconto || 'fixed'
      });
      specError = qErr;
    } else if (tipo_documento === 'recibo') {
      const { error: rErr } = await supabase.from('recibos').insert({
        id: baseDoc.id,
        user_id: userId,
        tipo_recibo: document_payload.tipo_recibo || 'pagamento',
        valor_recebido: document_payload.valor_recebido || pagamentoExistente.valor,
        forma_pagamento: document_payload.forma_pagamento || 'mpesa',
        referencia_recebimento: document_payload.referencia_recebimento || null,
        motivo_pagamento: document_payload.motivo_pagamento || null,
        documento_referencia: document_payload.documento_referencia || null
      });
      specError = rErr;
    }

    if (specError) {
      // rollback base
      await supabase.from('documentos_base').delete().eq('id', baseDoc.id);
      await supabase.from('pagamentos').update({ retry_count: (pagamentoExistente.retry_count || 0) + 1, last_retry_at: new Date().toISOString() }).eq('id', pagamentoExistente.id);
      return error('DOCUMENT_SPECIALIZED_FAILED', 'Falha na criação especializada', specError.message, 500);
    }

    // Criar itens se fornecidos
    if (Array.isArray(itens) && itens.length) {
      const itemRows = itens.map((it: any, idx: number) => ({
        documento_id: baseDoc.id,
        id_original: idx + 1,
        quantidade: it.quantidade || 1,
        descricao: it.descricao || 'Item',
        preco_unitario: it.preco_unitario || 0
      }));
      await supabase.from('itens_documento').insert(itemRows);
    }

    // Associar pagamento
    const { error: payUpdateErr } = await supabase
      .from('pagamentos')
      .update({ documento_id: baseDoc.id, status: 'pago', paid_at: new Date().toISOString() })
      .eq('id', pagamentoExistente.id);

    if (payUpdateErr) {
      return error('PAYMENT_UPDATE_FAILED', 'Documento criado mas falhou a associação do pagamento', payUpdateErr.message, 500);
    }

    const success: SuccessResponse = {
      success: true,
      data: { documento_id: baseDoc.id, payment_id: pagamentoExistente.id, status: 'associado' },
      message: 'Documento criado e pagamento associado com sucesso',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(success);
  } catch (e) {
    await logger.logError(e as Error, 'mpesa_finalize_unexpected', { userId });
    return error('INTERNAL_ERROR', 'Erro interno ao finalizar pagamento', (e as Error).message, 500);
  } finally {
    await logger.logApiCall('/api/mpesa/finalize', 'POST', Date.now() - start, true);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}
