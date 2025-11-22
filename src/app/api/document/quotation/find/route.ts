// app/api/document/quotation/find/route.ts
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

interface FindQuotationResponse {
  exists: boolean;
  numero: string;
  cotacao?: {
    id: string;
    numero: string;
    status: string;
    data_emissao: string;
    validez_dias: number;
    data_expiracao: string;
    expirada: boolean;
    subtotal?: number;
    total_desconto?: number;
    total_final?: number;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let user: any = null;
  let numeroCotacao: string | null = null;

  try {
    const supabase = await supabaseServer();

    // Verificar autenticação
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Tentativa de acesso não autorizado à API de busca de cotação',
        details: { 
          endpoint: '/api/document/quotation/find',
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
      await logger.logError(parseError as Error, 'parse_find_quotation_request', {
        endpoint: '/api/document/quotation/find',
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
      message: `Tentativa de busca de cotação: ${numero}`,
      details: {
        user: user.id,
        tipo: 'cotacao',
        numero: numero
      }
    });

    if (!numero) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Número da cotação não fornecido para busca',
        details: {
          user: user.id,
          endpoint: '/api/document/quotation/find'
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Número da cotação é obrigatório',
          details: {
            missingField: 'numero',
            expected: 'String com o número da cotação'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (typeof numero !== 'string' || numero.length > 20) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Número da cotação inválido fornecido',
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
    numeroCotacao = numeroSanitizado;

    // Log da busca no banco
    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Buscando cotação no banco: ${numeroSanitizado}`,
      details: {
        user: user.id,
        numero: numeroSanitizado,
        tipo: 'cotacao'
      }
    });

    // Novo schema: buscar em documentos_base + cotacoes
    const { data: existingCotacao, error: queryError } = await supabase
      .from('documentos_base')
      .select('id, numero, status, data_emissao')
      .eq('user_id', user.id)
      .eq('numero', numeroSanitizado)
      .maybeSingle();

    // Tratar erro específico de "nenhum resultado" (PGRST116) como sucesso
    if (queryError && queryError.code !== 'PGRST116') {
      await logger.logError(queryError, 'find_quotation_database', {
        user: user.id,
        numero: numeroSanitizado,
        databaseError: queryError.message,
        databaseCode: queryError.code
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Erro ao buscar cotação',
          details: {
            databaseError: queryError.message,
            suggestion: 'Tente novamente em alguns instantes'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    let cotacaoDetalhes: FindQuotationResponse['cotacao'] | undefined = undefined;
    const cotacaoExiste = !!existingCotacao;
    let dataExpiracao: string | null = null;
    let validezDias: number = 0;
    let subtotal: number | undefined;
    let totalDesconto: number | undefined;
    let totalFinal: number | undefined;

    if (cotacaoExiste) {
      // Buscar dados específicos da cotação
      const { data: dadosCotacao } = await supabase
        .from('cotacoes')
        .select('validez_dias, desconto, tipo_desconto')
        .eq('id', existingCotacao.id)
        .maybeSingle();

      validezDias = dadosCotacao?.validez_dias ?? 15;

      // Calcular data de expiração via função ou manualmente
      const { data: expData } = await supabase.rpc('obter_data_expiracao_cotacao', { p_cotacao_id: existingCotacao.id });
      if (expData) dataExpiracao = expData;
      else {
        // fallback manual
        const emissao = existingCotacao.data_emissao ? new Date(existingCotacao.data_emissao) : new Date();
        const dias = (validezDias ?? 0);
        const fallbackExp = new Date(emissao.getTime() + (dias * 86400000));
        dataExpiracao = fallbackExp.toISOString().substring(0,10);
      }

      // Totais
      const { data: totais } = await supabase
        .from('totais_documento')
        .select('subtotal, total_desconto, total_final')
        .eq('documento_id', existingCotacao.id)
        .maybeSingle();
      subtotal = totais?.subtotal;
      totalDesconto = totais?.total_desconto;
      totalFinal = totais?.total_final;

      const expirada = dataExpiracao ? new Date(dataExpiracao) < new Date() : false;
      cotacaoDetalhes = {
        id: existingCotacao.id,
        numero: existingCotacao.numero,
        status: existingCotacao.status,
        data_emissao: existingCotacao.data_emissao,
        validez_dias: validezDias,
        data_expiracao: dataExpiracao!,
        expirada,
        subtotal,
        total_desconto: totalDesconto,
        total_final: totalFinal
      };
    }

    // Log do resultado da busca
    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Busca de cotação concluída: ${numeroSanitizado} - ${cotacaoExiste ? 'Encontrada' : 'Não encontrada'}${cotacaoDetalhes?.expirada ? ' (Expirada)' : ''}`,
      details: {
        user: user.id,
        numero: numeroSanitizado,
        encontrada: cotacaoExiste,
        cotacaoId: cotacaoDetalhes?.id,
        status: cotacaoDetalhes?.status,
        expirada: cotacaoDetalhes?.expirada,
        dataExpiracao: cotacaoDetalhes?.data_expiracao,
        validezDias: cotacaoDetalhes?.validez_dias,
        totalFinal: cotacaoDetalhes?.total_final
      }
    });

    // Resposta de sucesso
    const successResponse: ApiResponse<FindQuotationResponse> = {
      success: true,
      data: {
        exists: cotacaoExiste,
        numero: numeroSanitizado,
        cotacao: cotacaoDetalhes
      }
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'find_quotation_unexpected', {
      user: user?.id,
      numeroCotacao,
      durationMs: duration,
      endpoint: '/api/document/quotation/find'
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
      '/api/document/quotation/find',
      'POST',
      duration,
      true // Considera sucesso se não caiu no catch
    );
  }
}