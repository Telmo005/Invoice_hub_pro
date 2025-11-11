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

  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    documentId = searchParams.get('id');

    await logger.log({
      action: 'document_view',
      message: `Tentativa de busca de HTML do documento: ${documentId}`,
      details: { documentId, endpoint: '/api/document/html' }
    });

    if (!documentId) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'ID do documento não fornecido para busca de HTML',
        details: { endpoint: '/api/document/html' }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID do documento é obrigatório'
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Tentativa de acesso não autorizado ao HTML do documento',
        details: { documentId }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Não autorizado'
        }
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    user = authUser;

    await logger.log({
      action: 'document_view',
      message: `Buscando HTML do documento no banco: ${documentId}`,
      details: { user: user.id, documentId }
    });

    const { data: document, error: documentError } = await supabase
      .from('faturas')
      .select('html_content, user_id, numero, tipo_documento, status')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (documentError) {
      if (documentError.code === 'PGRST116') {
        await logger.log({
          action: 'document_view',
          level: 'warn',
          message: 'Tentativa de acessar HTML de documento não encontrado',
          details: { user: user.id, documentId }
        });

        const errorResponse: ApiResponse = {
          success: false,
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Documento não encontrado ou não pertence ao usuário'
          }
        };
        return NextResponse.json(errorResponse, { status: 404 });
      }

      await logger.logError(documentError, 'get_document_html_database', {
        user: user.id,
        documentId
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Erro ao buscar documento'
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    if (!document) {
      await logger.log({
        action: 'document_view',
        level: 'warn',
        message: 'Documento não encontrado para o usuário',
        details: { user: user.id, documentId }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Documento não encontrado'
        }
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    if (!document.html_content) {
      await logger.log({
        action: 'document_view',
        level: 'warn',
        message: `Documento sem conteúdo HTML: ${document.numero}`,
        details: {
          user: user.id,
          documentId,
          documentNumero: document.numero
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'NO_HTML_CONTENT',
          message: 'Documento não possui conteúdo HTML'
        }
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    await logger.log({
      action: 'document_view',
      message: `HTML do documento recuperado com sucesso: ${document.numero}`,
      details: {
        user: user.id,
        documentId,
        documentNumero: document.numero,
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
      durationMs: duration
    });

    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
      }
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  } finally {
    const duration = Date.now() - startTime;
    
    await logger.logApiCall(
      '/api/document/html',
      'GET',
      duration,
      true
    );
  }
}