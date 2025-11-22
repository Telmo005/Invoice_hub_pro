// app/api/document/receipt/find/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

interface FindReceiptResponse {
  exists: boolean;
  numero: string;
  recibo?: {
    id: string;
    numero: string;
    status: string;
    data_emissao: string;
    data_recebimento: string;
    valor_recebido: number;
    forma_pagamento?: string;
    referencia_recebimento?: string;
    documento_referencia?: string;
    motivo_pagamento?: string;
    local_emissao?: string;
    subtotal?: number;
    total_desconto?: number;
    total_final?: number;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let user: any = null;
  let numeroRecibo: string | null = null;

  try {
    const supabase = await supabaseServer();

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Tentativa de acesso não autorizado à API de busca de recibo',
        details: {
          endpoint: '/api/document/receipt/find',
          error: authError?.message
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Não autorizado',
          details: 'Usuário não autenticado ou token inválido'
        }
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    user = authUser;

    let body: { numero?: string };
    try {
      body = await request.json();
    } catch (parseError) {
      await logger.logError(parseError as Error, 'parse_find_receipt_request', {
        endpoint: '/api/document/receipt/find',
        method: 'POST',
        user: user.id
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'JSON inválido',
          details: 'O corpo da requisição deve ser um JSON válido'
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { numero } = body;

    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Tentativa de busca de recibo: ${numero}`,
      details: {
        user: user.id,
        tipo: 'recibo',
        numero: numero
      }
    });

    if (!numero) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Número do recibo não fornecido para busca',
        details: {
          user: user.id,
          endpoint: '/api/document/receipt/find'
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Número do recibo é obrigatório',
          details: {
            missingField: 'numero',
            expected: 'String com o número do recibo'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (typeof numero !== 'string' || numero.length > 50) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Número do recibo inválido fornecido',
        details: {
          user: user.id,
          numero: numero,
          length: numero.length,
          maxLength: 50
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Número inválido',
          details: {
            provided: numero,
            maxLength: 50,
            suggestion: 'O número deve ser uma string com até 50 caracteres'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const numeroSanitizado = numero.trim().toUpperCase();
    numeroRecibo = numeroSanitizado;

    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Buscando recibo no banco: ${numeroSanitizado}`,
      details: {
        user: user.id,
        numero: numeroSanitizado,
        tipo: 'recibo'
      }
    });

    // Novo schema: buscar em documentos_base + recibos + totais
    const { data: baseRow, error: baseError } = await supabase
      .from('documentos_base')
      .select('id, numero, status, data_emissao')
      .eq('user_id', user.id)
      .eq('numero', numeroSanitizado)
      .maybeSingle();

    if (baseError && baseError.code !== 'PGRST116') {
      await logger.logError(baseError, 'find_receipt_base_error', { user: user.id, numero: numeroSanitizado });
      return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Erro ao acessar documentos_base' } }, { status: 500 });
    }

    let reciboDetalhes: FindReceiptResponse['recibo'] | undefined;
    if (baseRow) {
      const { data: reciboRow } = await supabase
        .from('recibos')
        .select('valor_recebido, forma_pagamento, referencia_recebimento, motivo_pagamento, documento_referencia, data_recebimento, local_emissao')
        .eq('id', baseRow.id)
        .maybeSingle();

      const { data: totaisRow } = await supabase
        .from('totais_documento')
        .select('subtotal, total_desconto, total_final')
        .eq('documento_id', baseRow.id)
        .maybeSingle();

      if (reciboRow) {
        reciboDetalhes = {
          id: baseRow.id,
          numero: baseRow.numero,
          status: baseRow.status,
          data_emissao: baseRow.data_emissao,
          data_recebimento: reciboRow.data_recebimento || baseRow.data_emissao,
          valor_recebido: reciboRow.valor_recebido,
          forma_pagamento: reciboRow.forma_pagamento || undefined,
          referencia_recebimento: reciboRow.referencia_recebimento || undefined,
          documento_referencia: reciboRow.documento_referencia || undefined,
          motivo_pagamento: reciboRow.motivo_pagamento || undefined,
          local_emissao: reciboRow.local_emissao || undefined,
          subtotal: totaisRow?.subtotal,
          total_desconto: totaisRow?.total_desconto,
          total_final: totaisRow?.total_final
        };
      }
    }

    const reciboExiste = !!reciboDetalhes;

    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Busca de recibo concluída: ${numeroSanitizado} - ${reciboExiste ? 'Encontrado' : 'Não encontrado'}`,
      details: {
        user: user.id,
        numero: numeroSanitizado,
        encontrada: reciboExiste,
        reciboId: reciboDetalhes?.id,
        status: reciboDetalhes?.status
      }
    });

    const successResponse: ApiResponse<FindReceiptResponse> = {
      success: true,
      data: {
        exists: reciboExiste,
        numero: numeroSanitizado,
        recibo: reciboDetalhes
      }
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const duration = Date.now() - startTime;

    await logger.logError(error as Error, 'find_receipt_unexpected', {
      user: user?.id,
      numeroRecibo,
      durationMs: duration,
      endpoint: '/api/document/receipt/find'
    });

    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ?
          (error instanceof Error ? error.message : 'Erro desconhecido') :
          undefined
      }
    };

    return NextResponse.json(errorResponse, { status: 500 });
  } finally {
    const duration = Date.now() - startTime;

    await logger.logApiCall(
      '/api/document/receipt/find',
      'POST',
      duration,
      true
    );
  }
}
