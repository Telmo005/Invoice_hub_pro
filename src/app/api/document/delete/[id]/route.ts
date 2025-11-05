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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  let user: any = null;
  let documentId: string | null = null;
  let documentInfo: any = null;

  try {
    const supabase = await supabaseServer();
    
    // 1. Verificar autenticação
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Tentativa de DELETE não autorizada em documento',
        details: { 
          endpoint: '/api/document/[id]',
          method: 'DELETE',
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
    documentId = params.id;

    // Log de tentativa de DELETE
    await logger.log({
      action: 'document_delete',
      level: 'info',
      message: `Tentativa de eliminar documento: ${documentId}`,
      details: {
        user: user.id,
        documentId: documentId,
        endpoint: '/api/document/[id]'
      }
    });

    console.log('Tentando eliminar documento:', documentId, 'usuário:', user.id);

    // 2. Verificar se documento existe e é do usuário
    const { data: document, error: docError } = await supabase
      .from('faturas')
      .select('id, user_id, status, tipo_documento, numero, data_fatura')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      await logger.log({
        action: 'document_delete',
        level: 'warn',
        message: 'Tentativa de eliminar documento não encontrado',
        details: {
          user: user.id,
          documentId: documentId,
          error: docError?.message,
          code: docError?.code
        }
      });

      console.log('Documento não encontrado ou não pertence ao usuário:', docError);
      
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Documento não encontrado',
          details: {
            documentId: documentId,
            suggestion: 'Verifique se o documento existe e pertence a você'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    documentInfo = document;

    // 3. VALIDAÇÃO: Só permite delete de RASCUNHOS
    if (document.status !== 'rascunho') {
      await logger.log({
        action: 'document_delete',
        level: 'warn',
        message: `Tentativa de eliminar documento não-rascunho: ${document.numero}`,
        details: {
          user: user.id,
          documentId: documentId,
          documentNumero: document.numero,
          documentTipo: document.tipo_documento,
          documentStatus: document.status,
          requiredStatus: 'rascunho'
        }
      });

      console.log('Tentativa de eliminar documento não-rascunho:', document.status);
      
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_OPERATION',
          message: 'Só é possível eliminar rascunhos',
          details: {
            currentStatus: document.status,
            documentNumber: document.numero,
            documentType: document.tipo_documento,
            allowedStatus: 'rascunho',
            suggestion: 'Documentos emitidos ou pagos não podem ser eliminados'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Log antes do DELETE
    await logger.log({
      action: 'document_delete',
      level: 'info',
      message: `Executando DELETE permanente do documento: ${document.numero}`,
      details: {
        user: user.id,
        documentId: documentId,
        documentNumero: document.numero,
        documentTipo: document.tipo_documento,
        documentStatus: document.status
      }
    });

    // 4. HARD DELETE
    console.log('Executando DELETE na tabela faturas para ID:', documentId);
    const { error: deleteError } = await supabase
      .from('faturas')
      .delete()
      .eq('id', documentId)
      .eq('user_id', user.id);

    if (deleteError) {
      await logger.logError(deleteError, 'delete_document_database', {
        user: user.id,
        documentId: documentId,
        documentNumero: document.numero,
        databaseError: deleteError.message,
        databaseCode: deleteError.code
      });

      console.error('Erro ao eliminar documento:', deleteError);
      
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Erro ao eliminar documento',
          details: {
            databaseError: deleteError.message,
            suggestion: 'Tente novamente em alguns instantes'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // Log de sucesso do DELETE
    await logger.log({
      action: 'document_delete',
      level: 'audit',
      message: `Documento eliminado permanentemente: ${document.numero}`,
      details: {
        user: user.id,
        documentId: documentId,
        documentNumero: document.numero,
        documentTipo: document.tipo_documento,
        operation: 'hard_delete',
        deletedAt: new Date().toISOString()
      }
    });

    console.log('Documento eliminado com sucesso:', documentId);
    
    const successResponse: ApiResponse<{ message: string; document: any }> = {
      success: true,
      data: {
        message: 'Rascunho eliminado permanentemente',
        document: {
          id: documentId,
          numero: document.numero,
          tipo: document.tipo_documento
        }
      }
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'delete_document_unexpected', {
      user: user?.id,
      documentId,
      documentInfo,
      durationMs: duration,
      endpoint: '/api/document/[id]',
      method: 'DELETE'
    });

    console.error('Erro completo ao eliminar documento:', error);
    
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
      '/api/document/[id]',
      'DELETE',
      duration,
      true // Considera sucesso se não caiu no catch
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}