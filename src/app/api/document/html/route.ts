// app/api/document/html/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: { message: 'ID do documento é obrigatório' } },
        { status: 400 }
      );
    }

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ Erro de autenticação:', authError);
      return NextResponse.json(
        { success: false, error: { message: 'Não autorizado' } },
        { status: 401 }
      );
    }

    console.log('🔍 Buscando documento:', { documentId, userId: user.id });

    // Buscar documento com verificação de propriedade
    const { data: document, error: documentError } = await supabase
      .from('faturas')
      .select('html_content, user_id, numero, tipo_documento')
      .eq('id', documentId)
      .eq('user_id', user.id) // ✅ CRÍTICO: Verificar se o documento pertence ao usuário
      .single();

    if (documentError) {
      console.error('❌ Erro ao buscar documento:', documentError);
      
      if (documentError.code === 'PGRST116') { // Documento não encontrado
        return NextResponse.json(
          { success: false, error: { message: 'Documento não encontrado ou não pertence ao usuário' } },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: { message: 'Erro ao buscar documento' } },
        { status: 500 }
      );
    }

    if (!document) {
      console.error('❌ Documento não encontrado para o usuário:', { documentId, userId: user.id });
      return NextResponse.json(
        { success: false, error: { message: 'Documento não encontrado' } },
        { status: 404 }
      );
    }

    console.log('✅ Documento encontrado:', { 
      documentId, 
      userDocId: document.user_id, 
      requestingUser: user.id,
      hasHtml: !!document.html_content,
      numero: document.numero
    });

    // Verificar se há HTML content
    if (!document.html_content) {
      console.warn('⚠️ Documento sem HTML content:', documentId);
      return NextResponse.json(
        { success: false, error: { message: 'Documento não possui conteúdo HTML' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { 
        html: document.html_content,
        documentInfo: {
          numero: document.numero,
          tipo: document.tipo_documento
        }
      }
    });

  } catch (error) {
    console.error('💥 Erro interno ao buscar HTML:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Erro interno do servidor' } },
      { status: 500 }
    );
  }
}