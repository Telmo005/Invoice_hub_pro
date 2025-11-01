import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

interface RouteParams {
  params: {
    id: string
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const { id } = params

    // Usar a função RPC para definir como padrão
    const { data, error } = await supabase
      .rpc('definir_emissor_padrao', {
        p_user_id: user.id,
        p_emissor_id: id
      })

    if (error) {
      console.error('Erro ao definir emissor padrão:', error)
      return NextResponse.json(
        { error: 'Erro ao definir empresa como padrão' },
        { status: 500 }
      )
    }

    if (!data.success) {
      return NextResponse.json(
        { error: data.error || 'Erro ao definir empresa como padrão' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Empresa definida como padrão com sucesso'
    })

  } catch (error) {
    console.error('Erro completo ao definir emissor padrão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}