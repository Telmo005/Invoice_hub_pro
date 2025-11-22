// app/api/document/invoice/find/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

// Interface para resposta padronizada
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

interface FindInvoiceResponse {
  exists: boolean;
  numero: string;
  fatura?: {
    id: string;
    numero: string;
    status: string;
    data_emissao: string;
    data_vencimento?: string;
    subtotal?: number;
    total_desconto?: number;
    total_final?: number;
    desconto?: number;
    tipo_desconto?: string;
    pagamento?: {
      metodo: string;
      status: string;
      valor: number;
      created_at?: string;
    };
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let user: any = null;
  let numeroFatura: string | null = null;

  try {
    const supabase = await supabaseServer();
    
    // Verificar autenticação
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Tentativa de acesso não autorizado à API de busca de fatura',
        details: { 
          endpoint: '/api/document/invoice/find',
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

    // Validar corpo da requisição
    let body: { numero?: string };
    try {
      body = await request.json();
    } catch (parseError) {
      await logger.logError(parseError as Error, 'parse_find_invoice_request', {
        endpoint: '/api/document/invoice/find',
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

    // Log de tentativa de busca
    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Tentativa de busca de fatura: ${numero}`,
      details: {
        user: user.id,
        tipo: 'fatura',
        numero: numero
      }
    });

    if (!numero) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Número da fatura não fornecido para busca',
        details: {
          user: user.id,
          endpoint: '/api/document/invoice/find'
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Número da fatura é obrigatório',
          details: {
            missingField: 'numero',
            expected: 'String com o número da fatura'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (typeof numero !== 'string' || numero.length > 20) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Número da fatura inválido fornecido',
        details: {
          user: user.id,
          numero: numero,
          length: numero.length,
          maxLength: 20
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Número inválido',
          details: {
            provided: numero,
            maxLength: 20,
            suggestion: 'O número deve ser uma string com até 20 caracteres'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Sanitizar e verificar
    const numeroSanitizado = numero.trim().toUpperCase();
    numeroFatura = numeroSanitizado;

    // Log da busca no banco
    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Buscando fatura no banco: ${numeroSanitizado}`,
      details: {
        user: user.id,
        numero: numeroSanitizado,
        tipo: 'fatura'
      }
    });

    // Novo schema: numero/status/datas estão em documentos_base; detalhes em faturas; totais em totais_documento
    // Podemos usar a view vw_documentos_completos para simplificar
    const { data: viewRow, error: viewError } = await supabase
      .from('vw_documentos_completos')
      .select('id, numero, status, data_emissao, fatura_vencimento, subtotal, total_desconto, total_final')
      .eq('user_id', user.id)
      .eq('numero', numeroSanitizado)
      .eq('tipo_documento', 'fatura')
      .maybeSingle();

    if (viewError && viewError.code !== 'PGRST116') {
      await logger.logError(viewError, 'find_invoice_view_error', {
        user: user.id,
        numero: numeroSanitizado,
        databaseError: viewError.message,
        databaseCode: viewError.code
      });
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Erro ao consultar view de fatura',
          details: { databaseError: viewError.message }
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    let desconto: number | undefined;
    let tipoDesconto: string | undefined;
    if (viewRow) {
      const { data: descontoRow } = await supabase
        .from('faturas')
        .select('desconto, tipo_desconto')
        .eq('id', viewRow.id)
        .maybeSingle();
      desconto = descontoRow?.desconto;
      tipoDesconto = descontoRow?.tipo_desconto;

      // Obter último pagamento (se existir)
      const { data: pagamentoRow } = await supabase
        .from('pagamentos')
        .select('metodo, status, valor, created_at')
        .eq('documento_id', viewRow.id)
        .eq('tipo_documento', 'fatura')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pagamentoRow) {
        (viewRow as any).pagamento = {
          metodo: pagamentoRow.metodo,
          status: pagamentoRow.status,
          valor: pagamentoRow.valor,
          created_at: pagamentoRow.created_at
        };
      }
    }

    const faturaExiste = !!viewRow;

    // Log do resultado da busca
    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Busca de fatura concluída: ${numeroSanitizado} - ${faturaExiste ? 'Encontrada' : 'Não encontrada'}`,
      details: {
        user: user.id,
        numero: numeroSanitizado,
        encontrada: faturaExiste,
        faturaId: viewRow?.id,
        status: viewRow?.status
      }
    });

    // Resposta de sucesso
    const successResponse: ApiResponse<FindInvoiceResponse> = {
      success: true,
      data: {
        exists: faturaExiste,
        numero: numeroSanitizado,
        fatura: viewRow ? {
          id: viewRow.id,
          numero: viewRow.numero,
          status: viewRow.status,
          data_emissao: viewRow.data_emissao,
          data_vencimento: viewRow.fatura_vencimento ?? undefined,
          subtotal: viewRow.subtotal ?? undefined,
          total_desconto: viewRow.total_desconto ?? undefined,
          total_final: viewRow.total_final ?? undefined,
          desconto,
          tipo_desconto: tipoDesconto,
          pagamento: (viewRow as any).pagamento
        } : undefined
      }
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'find_invoice_unexpected', {
      user: user?.id,
      numeroFatura,
      durationMs: duration,
      endpoint: '/api/document/invoice/find'
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
    
    // Log de performance da API
    await logger.logApiCall(
      '/api/document/invoice/find',
      'POST',
      duration,
      true // Considera sucesso se não caiu no catch
    );
  }
}