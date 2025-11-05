// app/api/emissores/[id]/padrao/route.ts - VERSÃO CORRIGIDA
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: {
    id: string
  }
}

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

// ✅ CORREÇÃO: Adicionar 'await' antes de params
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
  let user: any = null;
  
  // ✅ CORREÇÃO CRÍTICA: Aguardar os params
  const { id } = await params; // ← ADICIONAR 'await' AQUI
  let emissorId: string | null = id;

  try {
    const supabase = await supabaseServer()

    // Verificar autenticação
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Tentativa de acesso não autorizado à API de definição de emissor padrão',
        details: { 
          endpoint: '/api/emissores/[id]/padrao',
          method: 'PATCH',
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
      return NextResponse.json(errorResponse, { status: 401 })
    }

    user = authUser;

    // Log de tentativa de definição de emissor padrão
    await logger.log({
      action: 'user_profile_update',
      level: 'info',
      message: `Tentativa de definir emissor como padrão: ${id}`,
      details: {
        user: user.id,
        emissorId: id,
        endpoint: '/api/emissores/[id]/padrao'
      }
    });

    // ✅ AGORA 'id' já está disponível (foi await acima)

    // Log antes de chamar a RPC
    await logger.log({
      action: 'user_profile_update',
      level: 'info',
      message: `Chamando função RPC para definir emissor padrão`,
      details: {
        user: user.id,
        emissorId: id,
        function: 'definir_emissor_padrao'
      }
    });

    // Usar a função RPC para definir como padrão
    const { data, error } = await supabase
      .rpc('definir_emissor_padrao', {
        p_user_id: user.id,
        p_emissor_id: id
      })

    if (error) {
      await logger.logError(error, 'set_default_emitter_rpc', {
        user: user.id,
        emissorId: id,
        rpcError: error.message,
        rpcCode: error.code,
        rpcDetails: error.details
      });

      console.error('Erro ao definir emissor padrão:', error)
      
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Erro ao definir empresa como padrão',
          details: {
            databaseError: error.message,
            suggestion: 'Verifique se o emissor existe e tente novamente'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 500 })
    }

    if (!data.success) {
      await logger.log({
        action: 'user_profile_update',
        level: 'warn',
        message: `Falha ao definir emissor padrão: ${data.error}`,
        details: {
          user: user.id,
          emissorId: id,
          rpcResponse: data,
          error: data.error
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'OPERATION_FAILED',
          message: data.error || 'Erro ao definir empresa como padrão',
          details: {
            rpcError: data.error,
            suggestion: data.error || 'Verifique os dados e tente novamente'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 })
    }

    // Log de sucesso
    await logger.log({
      action: 'user_profile_update',
      level: 'audit',
      message: `Emissor definido como padrão com sucesso: ${id}`,
      details: {
        user: user.id,
        emissorId: id,
        rpcResponse: data,
        operation: 'set_default_emitter'
      }
    });

    const successResponse: ApiResponse<{ message: string }> = {
      success: true,
      data: {
        message: 'Empresa definida como padrão com sucesso'
      }
    };

    return NextResponse.json(successResponse)

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'set_default_emitter_unexpected', {
      user: user?.id,
      emissorId,
      durationMs: duration,
      endpoint: '/api/emissores/[id]/padrao',
      method: 'PATCH'
    });

    console.error('Erro completo ao definir emissor padrão:', error)
    
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
    
    return NextResponse.json(errorResponse, { status: 500 })
  } finally {
    const duration = Date.now() - startTime;
    
    // Log de performance da API
    await logger.logApiCall(
      '/api/emissores/[id]/padrao',
      'PATCH',
      duration,
      true
    );
  }
}