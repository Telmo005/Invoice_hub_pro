import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = await supabaseServer()

  try {
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Buscar emissor padrão usando a função RPC
    const { data: emissorPadrao, error } = await supabase
      .rpc('obter_emissor_padrao', { p_user_id: user.id })

    if (error) {
      console.error('Erro ao buscar emissor padrão:', error)
      return NextResponse.json(
        { error: 'Erro ao carregar empresa padrão' },
        { status: 500 }
      )
    }

    if (!emissorPadrao || emissorPadrao.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma empresa padrão definida' },
        { status: 404 }
      )
    }

    const emissor = emissorPadrao[0]

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
      pessoa_contato: emissor.pessoa_contato,
      padrao: emissor.padrao
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