// app/api/document/invoice/find/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Validar corpo da requisição
    const body = await request.json();
    const { numero } = body;

    if (!numero) {
      return NextResponse.json(
        { error: 'Número da fatura é obrigatório' },
        { status: 400 }
      );
    }

    if (typeof numero !== 'string' || numero.length > 20) {
      return NextResponse.json(
        { error: 'Número inválido' },
        { status: 400 }
      );
    }

    // Sanitizar e verificar
    const numeroSanitizado = numero.trim().toUpperCase();

    const { data: existingFatura, error: queryError } = await supabase
      .from('faturas')
      .select('id, numero, tipo_documento, status, data_fatura')
      .eq('user_id', user.id)
      .eq('numero', numeroSanitizado)
      .eq('tipo_documento', 'fatura')
      //.is('deleted_at', null)
      .single();

    if (queryError && queryError.code !== 'PGRST116') {
      console.error('Erro ao verificar fatura:', queryError);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      exists: !!existingFatura,
      numero: numeroSanitizado,
      fatura: existingFatura ? {
        id: existingFatura.id,
        numero: existingFatura.numero,
        status: existingFatura.status,
        data_fatura: existingFatura.data_fatura
      } : null
    });

  } catch (error) {
    console.error('Erro ao verificar fatura:', error);
    
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}