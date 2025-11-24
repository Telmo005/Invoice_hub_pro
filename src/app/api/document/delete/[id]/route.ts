// app/api/document/delete/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import { withApiGuard } from '@/lib/api/guard';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export const DELETE = withApiGuard(async (
  request: NextRequest,
  { user }
) => {
  const startTime = Date.now();
  let documentId: string | null = null;

  try {
    const id = request.nextUrl.pathname.split('/').pop();
    if (!id) {
      return NextResponse.json({ success: false, error: { code: 'MISSING_ID', message: 'ID não fornecido' } }, { status: 400 });
    }
    const supabase = await supabaseServer();
    documentId = id;

    // Log de tentativa de DELETE
    await logger.log({
      action: 'document_delete',
      level: 'info',
      message: `Tentativa de eliminar documento: ${documentId}`,
      details: {
        user: user.id,
        documentId: documentId
      }
    });

    // Verificar se documento existe e é do usuário
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
          error: docError?.message
        }
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

    // Validação: Só permite delete de RASCUNHOS
    if (document.status !== 'rascunho') {
      await logger.log({
        action: 'document_delete',
        level: 'warn',
        message: `Tentativa de eliminar documento não-rascunho: ${document.numero}`,
        details: {
          user: user.id,
          documentId: documentId,
          documentNumero: document.numero,
          documentStatus: document.status
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_OPERATION',
          message: 'Só é possível eliminar rascunhos',
          details: {
            currentStatus: document.status,
            allowedStatus: 'rascunho'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Executar DELETE
    const { error: deleteError } = await supabase
      .from('faturas')
      .delete()
      .eq('id', documentId)
      .eq('user_id', user.id);

    if (deleteError) {
      await logger.logError(deleteError, 'delete_document_database', {
        user: user.id,
        documentId: documentId,
        documentNumero: document.numero
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Erro ao eliminar documento'
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // Log de sucesso
    await logger.log({
      action: 'document_delete',
      level: 'audit',
      message: `Documento eliminado permanentemente: ${document.numero}`,
      details: {
        user: user.id,
        documentId: documentId,
        documentNumero: document.numero,
        documentTipo: document.tipo_documento
      }
    });

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
      '/api/document/[id]',
      'DELETE',
      duration,
      true
    );
  }
}, { auth: true, rate: { limit: 15, intervalMs: 60_000 }, csrf: true, auditAction: 'document_delete' });

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