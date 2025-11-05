// app/api/document/find/route.ts
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

interface FindDocumentResponse {
  exists: boolean;
  numero: string;
  documento?: {
    id: string;
    numero: string;
    tipo: string;
    status: string;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let user: any = null;
  let numeroDocumento: string | null = null;
  let tipoDocumento: string | null = null;

  try {
    const supabase = await supabaseServer();

    // 1. Verificar autenticação
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Tentativa de acesso não autorizado à API de busca de documento',
        details: { 
          endpoint: '/api/document/find',
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

    // 2. Validar corpo da requisição
    let body: { numero?: string; tipo?: string };
    try {
      body = await request.json();
    } catch (parseError) {
      await logger.logError(parseError as Error, 'parse_find_document_request', {
        endpoint: '/api/document/find',
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

    const { numero, tipo } = body;

    // Log de tentativa de busca
    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Tentativa de busca de documento: ${numero} (${tipo})`,
      details: {
        user: user.id,
        numero: numero,
        tipo: tipo
      }
    });

    if (!numero || !tipo) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Dados obrigatórios faltando para busca de documento',
        details: {
          user: user.id,
          missingFields: {
            numero: !numero,
            tipo: !tipo
          },
          required: ['numero', 'tipo']
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Número e tipo são obrigatórios',
          details: {
            missingFields: {
              numero: !numero,
              tipo: !tipo
            },
            required: ['numero', 'tipo']
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (typeof numero !== 'string' || numero.length > 20) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Número de documento inválido fornecido',
        details: {
          user: user.id,
          numero: numero,
          length: numero.length,
          maxLength: 20,
          tipo: tipo
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

    if (!['fatura', 'cotacao'].includes(tipo)) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Tipo de documento inválido fornecido',
        details: {
          user: user.id,
          tipo: tipo,
          allowedTypes: ['fatura', 'cotacao'],
          numero: numero
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Tipo de documento inválido',
          details: {
            provided: tipo,
            allowed: ['fatura', 'cotacao'],
            suggestion: 'O tipo deve ser "fatura" ou "cotacao"'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // 3. Sanitizar dados
    const numeroSanitizado = numero.trim().toUpperCase();
    numeroDocumento = numeroSanitizado;
    tipoDocumento = tipo;

    // Log da busca no banco
    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Buscando documento no banco: ${numeroSanitizado} (${tipo})`,
      details: {
        user: user.id,
        numero: numeroSanitizado,
        tipo: tipo
      }
    });

    // 4. Verificar se já existe documento com este número para o usuário
    const { data: existingDocument, error: queryError } = await supabase
      .from('faturas')
      .select('id, numero, tipo_documento, status')
      .eq('user_id', user.id)
      .eq('numero', numeroSanitizado)
      .eq('tipo_documento', tipo)
      .single();

    // Tratar erro específico de "nenhum resultado" (PGRST116) como sucesso
    if (queryError && queryError.code !== 'PGRST116') {
      await logger.logError(queryError, 'find_document_database', {
        user: user.id,
        numero: numeroSanitizado,
        tipo: tipo,
        databaseError: queryError.message,
        databaseCode: queryError.code
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Erro ao buscar documento',
          details: {
            databaseError: queryError.message,
            suggestion: 'Tente novamente em alguns instantes'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const documentoExiste = !!existingDocument;

    // Log do resultado da busca
    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Busca de documento concluída: ${numeroSanitizado} (${tipo}) - ${documentoExiste ? 'Encontrado' : 'Não encontrado'}`,
      details: {
        user: user.id,
        numero: numeroSanitizado,
        tipo: tipo,
        encontrado: documentoExiste,
        documentoId: existingDocument?.id,
        status: existingDocument?.status
      }
    });

    // 5. Retornar resultado
    const successResponse: ApiResponse<FindDocumentResponse> = {
      success: true,
      data: {
        exists: documentoExiste,
        numero: numeroSanitizado,
        documento: existingDocument ? {
          id: existingDocument.id,
          numero: existingDocument.numero,
          tipo: existingDocument.tipo_documento,
          status: existingDocument.status
        } : undefined
      }
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'find_document_unexpected', {
      user: user?.id,
      numeroDocumento,
      tipoDocumento,
      durationMs: duration,
      endpoint: '/api/document/find'
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
      '/api/document/find',
      'POST',
      duration,
      true // Considera sucesso se não caiu no catch
    );
  }
}