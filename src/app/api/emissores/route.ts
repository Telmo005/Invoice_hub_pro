import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { withApiGuard } from '@/lib/api/guard'
import { validateEmissor } from '@/lib/validation'
import { logger } from '@/lib/logger'

export const GET = withApiGuard(async (_req: NextRequest, { user }) => {
  const supabase = await supabaseServer()
  const { data: emissores, error } = await supabase
    .from('emissores')
    .select('id,nome_empresa,documento,pais,cidade,bairro,telefone,email,pessoa_contato,padrao')
    .eq('user_id', user.id)
    .order('padrao', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) {
    await logger.logError(error, 'emissores_list')
    return NextResponse.json({ error: 'Erro ao carregar empresas' }, { status: 500 })
  }

  return {
    empresas: emissores.map(e => ({
      id: e.id,
      nome: e.nome_empresa,
      nuip: e.documento,
      pais: e.pais,
      cidade: e.cidade,
      endereco: e.bairro,
      telefone: e.telefone,
      email: e.email,
      pessoa_contato: e.pessoa_contato,
      padrao: e.padrao
    }))
  }
}, { auth: true, rate: { limit: 60, intervalMs: 60_000 }, auditAction: 'emissores_get' })

export const POST = withApiGuard(async (request: NextRequest, { user }) => {
  const supabase = await supabaseServer()
  const body = await request.json()
  const { valid, errors, data } = validateEmissor(body)
  if (!valid || !data) {
    await logger.log({ action: 'validation', level: 'warn', message: 'Dados inválidos emissor', details: { errors } })
    return NextResponse.json({ error: 'Dados inválidos', details: errors }, { status: 400 })
  }

  if (data.padrao) {
    const { error: clearError } = await supabase
      .from('emissores')
      .update({ padrao: false })
      .eq('user_id', user.id)
      .eq('padrao', true)
    if (clearError) {
      await logger.logError(clearError, 'emissores_clear_default')
      return NextResponse.json({ error: 'Erro ao atualizar empresas' }, { status: 500 })
    }
  }

  const { data: novoEmissor, error } = await supabase
    .from('emissores')
    .insert({
      user_id: user.id,
      nome_empresa: data.nome_empresa,
      documento: data.documento,
      pais: data.pais,
      cidade: data.cidade,
      bairro: data.bairro,
      pessoa_contato: data.pessoa_contato,
      email: data.email,
      telefone: data.telefone,
      padrao: data.padrao || false
    })
    .select('id,nome_empresa,documento,pais,cidade,bairro,telefone,email,pessoa_contato,padrao')
    .single()

  if (error) {
    await logger.logError(error, 'emissores_insert')
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'Documento duplicado' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao criar empresa' }, { status: 500 })
  }

  await logger.log({ action: 'document_create', level: 'audit', message: 'Emissor criado', details: { emissorId: novoEmissor.id } })
  return { success: true, emissor: novoEmissor, message: 'Empresa criada com sucesso' }
}, { auth: true, rate: { limit: 20, intervalMs: 60_000 }, csrf: true, auditAction: 'emissores_post' })

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}