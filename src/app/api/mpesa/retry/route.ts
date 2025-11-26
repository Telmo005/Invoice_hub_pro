import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const start = Date.now();
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Não autenticado' } }, { status: 401 });

  try {
    // Busca APENAS pagamentos que NUNCA foram tentados (retry_count é null)
    const { data: pendentes } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'aguardando_documento')
      .is('documento_id', null)
      .is('retry_count', null)  // Apenas os que nunca tentaram
      .limit(10);

    const resultados: any[] = [];

    for (const pagamento of pendentes || []) {
      const payload = pagamento.metadata?.originalPayload?.document_payload || pagamento.metadata?.originalPayload || {};
      const numero = payload.numero || `AUTO-${Date.now().toString().slice(-6)}`;

      const baseInsert = {
        user_id: user.id,
        emitente_id: payload.emitente_id,
        destinatario_id: payload.destinatario_id,
        numero,
        status: 'emitida',
        moeda: payload.moeda || pagamento.moeda || 'MZN',
        html_content: payload.html_content || null,
        html_generated_at: payload.html_content ? new Date().toISOString() : null
      };

      if (!baseInsert.emitente_id || !baseInsert.destinatario_id) {
        // Marca como falha permanente - SEM retry
        await supabase.from('pagamentos')
          .update({ 
            status: 'falha_permanente',
            erro: 'Dados incompletos: emitente ou destinatário faltando'
          })
          .eq('id', pagamento.id);
        resultados.push({ 
          payment_id: pagamento.id, 
          status: 'failed', 
          reason: 'missing emitente/destinatario' 
        });
        continue;
      }

      const { data: baseDoc, error: baseErr } = await supabase
        .from('documentos_base')
        .insert(baseInsert)
        .select('*')
        .single();

      if (baseErr || !baseDoc) {
        // Marca como falha permanente - SEM retry
        await supabase.from('pagamentos')
          .update({ 
            status: 'falha_permanente',
            erro: `Erro ao criar documento base: ${baseErr?.message}`
          })
          .eq('id', pagamento.id);
        resultados.push({ 
          payment_id: pagamento.id, 
          status: 'failed', 
          error: baseErr?.message 
        });
        continue;
      }

      // specialized
      let specErr: any = null;
      const tipo = pagamento.tipo_documento;
      if (tipo === 'fatura') {
        const { error } = await supabase.from('faturas').insert({ 
          id: baseDoc.id, 
          data_vencimento: payload.data_vencimento || new Date().toISOString().slice(0,10) 
        });
        specErr = error;
      } else if (tipo === 'cotacao') {
        const { error } = await supabase.from('cotacoes').insert({ 
          id: baseDoc.id, 
          validez_dias: payload.validez_dias || 15 
        });
        specErr = error;
      } else if (tipo === 'recibo') {
        const { error } = await supabase.from('recibos').insert({ 
          id: baseDoc.id, 
          user_id: user.id, 
          tipo_recibo: payload.tipo_recibo || 'pagamento', 
          valor_recebido: pagamento.valor, 
          forma_pagamento: 'mpesa' 
        });
        specErr = error;
      }

      if (specErr) {
        // Rollback e marca como falha permanente - SEM retry
        await supabase.from('documentos_base').delete().eq('id', baseDoc.id);
        await supabase.from('pagamentos')
          .update({ 
            status: 'falha_permanente',
            erro: `Erro ao criar documento especializado: ${specErr.message}`
          })
          .eq('id', pagamento.id);
        resultados.push({ 
          payment_id: pagamento.id, 
          status: 'failed', 
          error: specErr.message 
        });
        continue;
      }

      // SUCESSO - processa normalmente
      await supabase.from('pagamentos')
        .update({ 
          documento_id: baseDoc.id, 
          status: 'pago', 
          paid_at: new Date().toISOString() 
        })
        .eq('id', pagamento.id);
      resultados.push({ 
        payment_id: pagamento.id, 
        status: 'associated', 
        documento_id: baseDoc.id 
      });
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        processed: resultados,
        total: resultados.length,
        success: resultados.filter(r => r.status === 'associated').length,
        failed: resultados.filter(r => r.status === 'failed').length
      }, 
      message: 'Processamento executado (apenas uma tentativa)', 
      timestamp: new Date().toISOString() 
    });
  } catch (e) {
    await logger.logError(e as Error, 'mpesa_retry_unexpected', {});
    return NextResponse.json({ 
      success: false, 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Erro interno' 
      } 
    }, { status: 500 });
  } finally {
    await logger.logApiCall('/api/mpesa/retry', 'POST', Date.now() - start, true);
  }
}

export async function OPTIONS() { 
  return new NextResponse(null, { status: 200 }); 
}