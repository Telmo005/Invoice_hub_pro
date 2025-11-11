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

// ✅ GET - Obter emissor específico
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let user: any = null;

  try {
    const { id } = await context.params;
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

    // Buscar emissor específico
    const { data: emissor, error: emissorError } = await supabase
      .from('emissores')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (emissorError || !emissor) {
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'EMISSOR_NOT_FOUND',
          message: 'Emissor não encontrado'
        }
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const successResponse: ApiResponse = {
      success: true,
      data: emissor
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    await logger.logError(error as Error, 'get_emitter_by_id', {
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
  }
}

// ✅ PATCH - Atualizar emissor
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let user: any = null;

  try {
    const { id } = await context.params;
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

    // Atualizar emissor
    const { data: emissor, error: updateError } = await supabase
      .from('emissores')
      .update(body)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Erro ao atualizar emissor'
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const successResponse: ApiResponse = {
      success: true,
      data: emissor
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    await logger.logError(error as Error, 'update_emitter', {
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
  }
}

// ✅ DELETE - Eliminar emissor
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let user: any = null;

  try {
    const { id } = await context.params;
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

    // Eliminar emissor
    const { error: deleteError } = await supabase
      .from('emissores')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: 'Erro ao eliminar emissor'
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const successResponse: ApiResponse = {
      success: true,
      data: { message: 'Emissor eliminado com sucesso' }
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    await logger.logError(error as Error, 'delete_emitter', {
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
  }
}

// ✅ OPTIONS - CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}