import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

interface EmissorCreateData {
  nome_empresa: string
  documento: string
  pais: string
  cidade: string
  bairro: string
  pessoa_contato?: string
  email: string
  telefone: string
  padrao?: boolean
}

function validateEmissorData(data: any): { isValid: boolean; errors: string[]; validatedData?: EmissorCreateData } {
  const errors: string[] = []

  if (!data.nome_empresa?.trim()) errors.push('Nome da empresa é obrigatório')
  if (!data.documento?.trim()) errors.push('Documento é obrigatório')
  if (!data.pais?.trim()) errors.push('País é obrigatório')
  if (!data.cidade?.trim()) errors.push('Cidade é obrigatória')
  if (!data.bairro?.trim()) errors.push('Bairro é obrigatório')
  if (!data.email?.trim()) errors.push('Email é obrigatório')
  if (!data.telefone?.trim()) errors.push('Telefone é obrigatório')

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Email inválido')
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  const validatedData: EmissorCreateData = {
    nome_empresa: data.nome_empresa.trim(),
    documento: data.documento.trim(),
    pais: data.pais.trim(),
    cidade: data.cidade.trim(),
    bairro: data.bairro.trim(),
    pessoa_contato: data.pessoa_contato?.trim(),
    email: data.email.trim(),
    telefone: data.telefone.trim(),
    padrao: Boolean(data.padrao)
  }

  return { isValid: true, errors: [], validatedData }
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await supabaseServer()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { data: emissores, error } = await supabase
      .from('emissores')
      .select('*')
      .eq('user_id', user.id)
      .order('padrao', { ascending: false })
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao carregar empresas' },
        { status: 500 }
      )
    }

    const empresas = emissores.map(emissor => ({
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
    }))

    return NextResponse.json({ empresas })

  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    const validation = validateEmissorData(body)
    if (!validation.isValid || !validation.validatedData) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.errors },
        { status: 400 }
      )
    }

    const validatedData = validation.validatedData

    if (validatedData.padrao) {
      await supabase
        .from('emissores')
        .update({ padrao: false })
        .eq('user_id', user.id)
        .eq('padrao', true)
    }

    const { data: novoEmissor, error } = await supabase
      .from('emissores')
      .insert({
        user_id: user.id,
        nome_empresa: validatedData.nome_empresa,
        documento: validatedData.documento,
        pais: validatedData.pais,
        cidade: validatedData.cidade,
        bairro: validatedData.bairro,
        pessoa_contato: validatedData.pessoa_contato,
        email: validatedData.email,
        telefone: validatedData.telefone,
        padrao: validatedData.padrao || false
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe uma empresa com este documento' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Erro ao criar empresa' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      emissor: novoEmissor,
      message: 'Empresa criada com sucesso'
    }, { status: 201 })

  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}