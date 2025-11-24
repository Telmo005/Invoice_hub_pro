// app/api/document/next-number/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  let user: any = null;

  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo'); // 'fatura' | 'cotacao' | 'recibo'

    if (!tipo || !['fatura', 'cotacao', 'recibo'].includes(tipo)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de documento inválido' },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();
    
    // Verificar autenticação
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    user = authUser;

    // Nova função: gerar_numero_documento(p_user_id UUID, p_tipo_documento TEXT)
    const { data: numeroGerado, error } = await supabase.rpc('gerar_numero_documento', {
      p_user_id: user.id,
      p_tipo_documento: tipo
    });

    if (error) {
      await logger.logError(error as any, 'next_number_rpc_error', {
        user: user.id,
        tipo,
        endpoint: '/api/document/next-number',
        hint: error.hint,
        code: error.code
      });
      return NextResponse.json({
        success: false,
        error: 'Falha ao gerar número',
        details: error.message,
        hint: error.hint || 'Verifique o schema e permissões'
      }, { status: 500 });
    }

    await logger.log({
      action: 'number_generate',
      level: 'info',
      message: `Número gerado (${tipo}): ${numeroGerado}`,
      details: { user: user.id, tipo }
    });

    return NextResponse.json({
      success: true,
      data: {
        numero: numeroGerado,
        tipo,
        usuario: user.id
      }
    });

  } catch (error) {
    await logger.logError(error as Error, 'next_number_unexpected', {
      user: user?.id,
      endpoint: '/api/document/next-number'
    });
    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}