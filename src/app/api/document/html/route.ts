// app/api/document/html/route.ts
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

interface HtmlDocumentResponse {
  html: string;
  documentInfo: {
    numero: string;
    tipo: string;
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let user: any = null;
  let documentId: string | null = null;
  let documentInfo: any = null;

  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    documentId = searchParams.get('id');

    // Log de tentativa de busca de HTML
    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Tentativa de busca de HTML do documento: ${documentId}`,
      details: {
        documentId: documentId,
        endpoint: '/api/document/html'
      }
    });

    if (!documentId) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'ID do documento não fornecido para busca de HTML',
        details: {
          endpoint: '/api/document/html',
          searchParams: Object.fromEntries(searchParams)
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID do documento é obrigatório',
          details: {
            missingField: 'id',
            expected: 'Parâmetro de query "id" com o ID do documento'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Verificar autenticação
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Tentativa de acesso não autorizado ao HTML do documento',
        details: { 
          endpoint: '/api/document/html',
          documentId: documentId,
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

    console.log('🔍 Buscando documento:', { documentId, userId: user.id });

    // Log da busca no banco
    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Buscando HTML do documento no banco: ${documentId}`,
      details: {
        user: user.id,
        documentId: documentId
      }
    });

    // Buscar documento com verificação de propriedade
    const { data: document, error: documentError } = await supabase
      .from('faturas')
      .select('html_content, user_id, numero, tipo_documento, status')
      .eq('id', documentId)
      .eq('user_id', user.id) // ✅ CRÍTICO: Verificar se o documento pertence ao usuário
      .single();

    if (documentError) {
      // Tratamento específico para "documento não encontrado"
      if (documentError.code === 'PGRST116') {
        await logger.log({
          action: 'document_view',
          level: 'warn',
          message: 'Tentativa de acessar HTML de documento não encontrado',
          details: {
            user: user.id,
            documentId: documentId,
            error: 'Documento não encontrado ou não pertence ao usuário',
            code: documentError.code
          }
        });

        const errorResponse: ApiResponse = {
          success: false,
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Documento não encontrado ou não pertence ao usuário',
            details: {
              documentId: documentId,
              suggestion: 'Verifique se o documento existe e pertence a você'
            }
          }
        };
        return NextResponse.json(errorResponse, { status: 404 });
      }

      await logger.logError(documentError, 'get_document_html_database', {
        user: user.id,
        documentId: documentId,
        databaseError: documentError.message,
        databaseCode: documentError.code
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Erro ao buscar documento',
          details: {
            databaseError: documentError.message,
            suggestion: 'Tente novamente em alguns instantes'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    if (!document) {
      await logger.log({
        action: 'document_view',
        level: 'warn',
        message: 'Documento não encontrado para o usuário',
        details: {
          user: user.id,
          documentId: documentId,
          requestingUser: user.id
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Documento não encontrado',
          details: {
            documentId: documentId,
            suggestion: 'Verifique se o documento existe'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    documentInfo = document;

    console.log('✅ Documento encontrado:', { 
      documentId, 
      userDocId: document.user_id, 
      requestingUser: user.id,
      hasHtml: !!document.html_content,
      numero: document.numero
    });

    // Verificar se há HTML content
    if (!document.html_content) {
      await logger.log({
        action: 'document_view',
        level: 'warn',
        message: `Documento sem conteúdo HTML: ${document.numero}`,
        details: {
          user: user.id,
          documentId: documentId,
          documentNumero: document.numero,
          documentTipo: document.tipo_documento,
          documentStatus: document.status
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'NO_HTML_CONTENT',
          message: 'Documento não possui conteúdo HTML',
          details: {
            documentNumber: document.numero,
            documentType: document.tipo_documento,
            suggestion: 'O documento pode não ter sido gerado corretamente'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Log de sucesso na recuperação do HTML
    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `HTML do documento recuperado com sucesso: ${document.numero}`,
      details: {
        user: user.id,
        documentId: documentId,
        documentNumero: document.numero,
        documentTipo: document.tipo_documento,
        documentStatus: document.status,
        htmlLength: document.html_content.length
      }
    });

    const successResponse: ApiResponse<HtmlDocumentResponse> = {
      success: true,
      data: { 
        html: document.html_content,
        documentInfo: {
          numero: document.numero,
          tipo: document.tipo_documento
        }
      }
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'get_document_html_unexpected', {
      user: user?.id,
      documentId,
      documentInfo,
      durationMs: duration,
      endpoint: '/api/document/html'
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
      '/api/document/html',
      'GET',
      duration,
      true // Considera sucesso se não caiu no catch
    );
  }
}