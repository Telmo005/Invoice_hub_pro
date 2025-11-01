import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await supabaseServer();
    
    // 1. Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn('Tentativa de delete não autorizada');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const documentId = params.id;
    console.log('Tentando eliminar documento:', documentId, 'usuário:', user.id);

    // 2. Verificar se documento existe e é do usuário
    const { data: document, error: docError } = await supabase
      .from('faturas')
      .select('id, user_id, status, tipo_documento, numero')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      console.log('Documento não encontrado ou não pertence ao usuário:', docError);
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    // 3. VALIDAÇÃO: Só permite delete de RASCUNHOS
    if (document.status !== 'rascunho') {
      console.log('Tentativa de eliminar documento não-rascunho:', document.status);
      return NextResponse.json(
        { 
          error: 'Só é possível eliminar rascunhos. Documentos emitidos ou pagos não podem ser eliminados.' 
        },
        { status: 400 }
      );
    }

    // 4. HARD DELETE
    console.log('Executando DELETE na tabela faturas para ID:', documentId);
    const { error: deleteError } = await supabase
      .from('faturas')
      .delete()
      .eq('id', documentId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Erro ao eliminar documento:', deleteError);
      return NextResponse.json({ 
        error: 'Erro ao eliminar documento',
        details: deleteError.message 
      }, { status: 500 });
    }

    console.log('Documento eliminado com sucesso:', documentId);
    return NextResponse.json({ 
      success: true,
      message: 'Rascunho eliminado permanentemente'
    });

  } catch (error) {
    console.error('Erro completo ao eliminar documento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
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