// app/api/emissores/[id]/route.ts
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

// ✅ GET - Obter emissor específico (CORRIGIDO)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let user: any = null;

  try {
    const { id } = await context.params; // ✅ Correção aqui
    const supabase = await supabaseServer();

    // Verificar autenticação
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Tentativa de acesso não autorizado à API de busca de emissor',
        details: { 
          endpoint: '/api/emissores/[id]',
          method: 'GET'
        }
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

    // Log de tentativa de busca
    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Tentativa de buscar emissor: ${id}`,
      details: {
        user: user.id,
        emissorId: id
      }
    });

    // Buscar emitente específico
    const { data: emissor, error } = await supabase
      .from('emissores')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        await logger.log({
          action: 'document_view',
          level: 'warn',
          message: 'Emissor não encontrado',
          details: {
            user: user.id,
            emissorId: id
          }
        });

        const errorResponse: ApiResponse = {
          success: false,
          error: {
            code: 'EMISSOR_NOT_FOUND',
            message: 'Empresa não encontrada'
          }
        };
        return NextResponse.json(errorResponse, { status: 404 });
      }

      await logger.logError(error, 'get_emissor_database', {
        user: user.id,
        emissorId: id
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Erro ao carregar dados da empresa'
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // Log de sucesso
    await logger.log({
      action: 'document_view',
      level: 'info',
      message: `Emissor encontrado: ${emissor.nome_empresa}`,
      details: {
        user: user.id,
        emissorId: id,
        emissorNome: emissor.nome_empresa
      }
    });

    // Transformar para formato do frontend
    const empresa = {
      id: emissor.id,
      nome: emissor.nome_empresa,
      nuip: emissor.documento,
      pais: emissor.pais,
      cidade: emissor.cidade,
      endereco: emissor.bairro,
      telefone: emissor.telefone,
      email: emissor.email,
      pessoa_contato: emissor.pessoa_contato
    };

    const successResponse: ApiResponse<{ empresa: any }> = {
      success: true,
      data: { empresa }
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    await logger.logError(error as Error, 'get_emissor_unexpected', {
      user: user?.id,
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
      '/api/emissores/[id]',
      'GET',
      duration,
      true
    );
  }
}

// ✅ PUT - Atualizar emissor (CORRIGIDO)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let user: any = null;

  try {
    const { id } = await context.params; // ✅ Correção aqui
    const supabase = await supabaseServer();
    const body = await request.json();

    // Verificar autenticação
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
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

    // Log de tentativa de atualização
    await logger.log({
      action: 'document_update',
      level: 'info',
      message: `Tentativa de atualizar emissor: ${id}`,
      details: {
        user: user.id,
        emissorId: id
      }
    });

    // Atualizar emitente
    const { data: emissorAtualizado, error } = await supabase
      .from('emissores')
      .update({
        nome_empresa: body.nome_empresa,
        documento: body.documento,
        pais: body.pais,
        cidade: body.cidade,
        bairro: body.bairro,
        pessoa_contato: body.pessoa_contato,
        email: body.email,
        telefone: body.telefone,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      await logger.logError(error, 'update_emissor_database', {
        user: user.id,
        emissorId: id
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Erro ao atualizar empresa'
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // Log de sucesso
    await logger.log({
      action: 'document_update',
      level: 'audit',
      message: `Emissor atualizado com sucesso: ${emissorAtualizado.nome_empresa}`,
      details: {
        user: user.id,
        emissorId: id,
        emissorNome: emissorAtualizado.nome_empresa
      }
    });

    const successResponse: ApiResponse<{ emissor: any }> = {
      success: true,
      data: {
        emissor: emissorAtualizado
      }
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    await logger.logError(error as Error, 'update_emissor_unexpected', {
      user: user?.id,
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
      '/api/emissores/[id]',
      'PUT',
      duration,
      true
    );
  }
}

// ✅ DELETE - Eliminar emissor (CORRIGIDO)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let user: any = null;

  try {
    const { id } = await context.params; // ✅ Correção aqui
    const supabase = await supabaseServer();

    // Verificar autenticação
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
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

    // Log de tentativa de exclusão
    await logger.log({
      action: 'document_delete',
      level: 'info',
      message: `Tentativa de excluir emissor: ${id}`,
      details: {
        user: user.id,
        emissorId: id
      }
    });

    // Buscar informações do emissor antes de excluir
    const { data: emissor } = await supabase
      .from('emissores')
      .select('nome_empresa, documento')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    // Verificar se existem faturas vinculadas
    const { data: faturas, error: _checkError } = await supabase
      .from('faturas')
      .select('id')
      .eq('emitente_id', id)
      .eq('user_id', user.id)
      .limit(1);

    if (faturas && faturas.length > 0) {
      await logger.log({
        action: 'document_delete',
        level: 'warn',
        message: `Tentativa de excluir emissor com faturas vinculadas: ${emissor?.nome_empresa}`,
        details: {
          user: user.id,
          emissorId: id,
          emissorNome: emissor?.nome_empresa,
          faturasCount: faturas.length
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'EMISSOR_HAS_DOCUMENTS',
          message: 'Não é possível excluir esta empresa pois existem faturas vinculadas a ela'
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Excluir emitente
    const { error } = await supabase
      .from('emissores')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      await logger.logError(error, 'delete_emissor_database', {
        user: user.id,
        emissorId: id
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Erro ao excluir empresa'
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // Log de sucesso
    await logger.log({
      action: 'document_delete',
      level: 'audit',
      message: `Emissor excluído com sucesso: ${emissor?.nome_empresa}`,
      details: {
        user: user.id,
        emissorId: id,
        emissorNome: emissor?.nome_empresa
      }
    });

    const successResponse: ApiResponse<{ message: string }> = {
      success: true,
      data: {
        message: 'Empresa excluída com sucesso'
      }
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    await logger.logError(error as Error, 'delete_emissor_unexpected', {
      user: user?.id,
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
      '/api/emissores/[id]',
      'DELETE',
      duration,
      true
    );
  }
}

// ✅ OPTIONS - CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}