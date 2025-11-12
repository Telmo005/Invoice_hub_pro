// app/api/document/next-number/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  let user: any = null;

  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo'); // 'fatura' ou 'cotacao'
    
    if (!tipo || !['fatura', 'cotacao'].includes(tipo)) {
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

    // Chamar a função PostgreSQL para gerar número PARA ESTE USUÁRIO
    const { data, error } = await supabase.rpc(
      'gerar_proximo_numero_documento_usuario',
      { 
        p_user_id: user.id,
        p_tipo: tipo 
      }
    );

    if (error) {
      console.error('Erro ao gerar número:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        numero: data,
        tipo: tipo,
        usuario: user.id
      }
    });

  } catch (error) {
    console.error('Erro no endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor'
      },
      { status: 500 }
    );
  }
}