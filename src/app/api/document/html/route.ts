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

    // Buscar documento base (contém html_content na nova estrutura)
    const { data: baseDoc, error: baseError } = await supabase
      .from('documentos_base')
      .select('id, numero, status, moeda, html_content, html_generated_at')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (baseError || !baseDoc) {
      await logger.log({
        action: 'document_view',
        level: 'warn',
        message: 'Documento base não encontrado',
        details: { user: user.id, documentId }
      });
      return NextResponse.json({
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento não encontrado' }
      }, { status: 404 });
    }

    // Detectar tipo por existência nas tabelas especializadas
    const [fatura, cotacao, recibo] = await Promise.all([
      supabase.from('faturas').select('id').eq('id', documentId).maybeSingle(),
      supabase.from('cotacoes').select('id').eq('id', documentId).maybeSingle(),
      supabase.from('recibos').select('id').eq('id', documentId).maybeSingle()
    ]);

    let tipoDocumento: string = 'desconhecido';
    if (fatura.data) tipoDocumento = 'fatura';
    else if (cotacao.data) tipoDocumento = 'cotacao';
    else if (recibo.data) tipoDocumento = 'recibo';

    let htmlContent = baseDoc.html_content;

    if (!htmlContent) {
      if (tipoDocumento === 'recibo') {
        htmlContent = `<div style="font-family:Arial; padding:16px;">
          <h2 style="margin:0 0 8px;">Recibo ${baseDoc.numero}</h2>
          <p style="color:#555;">Este recibo não possui HTML armazenado. Pode gerar PDF simplificado ou reprocessar mais tarde.</p>
        </div>`;
      } else {
        htmlContent = `<div style="font-family:Arial; padding:16px;">
          <h2 style="margin:0 0 8px;">Documento ${baseDoc.numero}</h2>
          <p style="color:#555;">Nenhum HTML foi gerado ainda para este documento (${tipoDocumento}).</p>
          <p style="font-size:12px; color:#888;">Regenere o conteúdo usando o template de impressão.</p>
        </div>`;
      }
    }

    await logger.log({
      action: 'document_view',
      message: `HTML preparado para documento: ${baseDoc.numero}`,
      details: {
        user: user.id,
        documentId,
        tipo: tipoDocumento,
        placeholder: baseDoc.html_content ? false : true
      }
    });

    const successResponse: ApiResponse<HtmlDocumentResponse> = {
      success: true,
      data: { 
        html: htmlContent,
        documentInfo: {
          numero: baseDoc.numero,
          tipo: tipoDocumento
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