import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(_request: NextRequest) {
  try {
    const supabase = await supabaseServer()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Buscar emissor padrão
    const { data: emissorPadrao, error } = await supabase
      .from('emissores')
      .select('*')
      .eq('user_id', user.id)
      .eq('padrao', true)
      .single()

    if (error) {
      // Se não encontrou nenhum padrão, retorna null (não é erro)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ empresa: null })
      }
      
      console.error('Erro ao buscar emissor padrão:', error)
      return NextResponse.json(
        { error: 'Erro ao carregar empresa padrão' },
        { status: 500 }
      )
    }

    // Transformar para formato do frontend
    const empresa = {
      id: emissorPadrao.id,
      nome: emissorPadrao.nome_empresa,
      nuip: emissorPadrao.documento,
      pais: emissorPadrao.pais,
      cidade: emissorPadrao.cidade,
      endereco: emissorPadrao.bairro,
      telefone: emissorPadrao.telefone,
      email: emissorPadrao.email,
      pessoa_contato: emissorPadrao.pessoa_contato,
      padrao: emissorPadrao.padrao
    }

    return NextResponse.json({ empresa })

  } catch (error) {
    console.error('Erro completo ao carregar emissor padrão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}