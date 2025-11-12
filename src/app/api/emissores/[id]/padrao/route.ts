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

// ✅ PATCH - Definir emissor como padrão
export async function PATCH(
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

    // 1. Primeiro, remover o padrão de todos os emissores do usuário
    const { error: clearError } = await supabase
      .from('emissores')
      .update({ padrao: false })
      .eq('user_id', user.id);

    if (clearError) {
      console.error('Erro ao limpar padrão:', clearError);
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'CLEAR_DEFAULT_ERROR',
          message: 'Erro ao limpar emissores padrão'
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // 2. Definir o emissor específico como padrão
    const { data: emissor, error: updateError } = await supabase
      .from('emissores')
      .update({ padrao: true })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError || !emissor) {
      console.error('Erro ao definir padrão:', updateError);
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'SET_DEFAULT_ERROR',
          message: 'Erro ao definir emissor como padrão'
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const successResponse: ApiResponse = {
      success: true,
      data: {
        message: 'Emissor definido como padrão com sucesso',
        emissor
      }
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Erro completo:', error);
    await logger.logError(error as Error, 'set_default_emitter', {
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
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}