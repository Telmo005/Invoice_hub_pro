import { NextRequest, NextResponse } from 'next/server';
import { withApiGuard } from '@/lib/api/guard';
import { supabaseServer } from '@/lib/supabase-server';
import { validateEmissor } from '@/lib/validation';
import { logger } from '@/lib/logger';

// GET single emissor
export const GET = withApiGuard(async (request: NextRequest, { user }) => {
  const { searchParams } = new URL(request.url);
  // id is in pathname params; Next.js passes via context in app router normally, but here we parse
  const id = request.nextUrl.pathname.split('/').pop();
  if (!id) return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('emissores')
    .select('id,nome_empresa,documento,pais,cidade,bairro,telefone,email,pessoa_contato,padrao')
    .eq('user_id', user.id)
    .eq('id', id)
    .single();
  if (error || !data) {
    await logger.logError(error as any, 'emissor_get');
    return NextResponse.json({ error: 'Emissor não encontrado' }, { status: 404 });
  }
  return { emissor: {
    id: data.id,
    nome: data.nome_empresa,
    nuip: data.documento,
    pais: data.pais,
    cidade: data.cidade,
    endereco: data.bairro,
    telefone: data.telefone,
    email: data.email,
    pessoa_contato: data.pessoa_contato,
    padrao: data.padrao
  }};
}, { auth: true, rate: { limit: 60, intervalMs: 60_000 }, auditAction: 'emissor_get' });

// PATCH update emissor
export const PATCH = withApiGuard(async (request: NextRequest, { user }) => {
  const id = request.nextUrl.pathname.split('/').pop();
  if (!id) return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
  const body = await request.json();
  const { valid, errors, data } = validateEmissor(body);
  if (!valid || !data) {
    return NextResponse.json({ error: 'Dados inválidos', details: errors }, { status: 400 });
  }
  const supabase = await supabaseServer();
  // Se marcar padrao, limpar outros padrao
  if (data.padrao) {
    await supabase
      .from('emissores')
      .update({ padrao: false })
      .eq('user_id', user.id)
      .eq('padrao', true);
  }
  const { data: updated, error } = await supabase
    .from('emissores')
    .update({
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
    .eq('user_id', user.id)
    .eq('id', id)
    .select('id,nome_empresa,documento,pais,cidade,bairro,telefone,email,pessoa_contato,padrao')
    .single();
  if (error || !updated) {
    await logger.logError(error as any, 'emissor_patch');
    return NextResponse.json({ error: 'Erro ao atualizar emissor' }, { status: 500 });
  }
  await logger.log({ action: 'emissor_update', level: 'audit', message: 'Emissor atualizado', details: { emissorId: updated.id } });
  return { success: true, emissor: updated, message: 'Emissor atualizado com sucesso' };
}, { auth: true, rate: { limit: 40, intervalMs: 60_000 }, csrf: true, auditAction: 'emissor_patch' });

// DELETE emissor
export const DELETE = withApiGuard(async (request: NextRequest, { user }) => {
  const id = request.nextUrl.pathname.split('/').pop();
  if (!id) return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
  const supabase = await supabaseServer();
  // Verifica existência primeiro
  const { data: existing } = await supabase
    .from('emissores')
    .select('id')
    .eq('user_id', user.id)
    .eq('id', id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: 'Emissor não encontrado' }, { status: 404 });
  }
  const { error } = await supabase
    .from('emissores')
    .delete()
    .eq('user_id', user.id)
    .eq('id', id);
  if (error) {
    await logger.logError(error as any, 'emissor_delete');
    return NextResponse.json({ error: 'Erro ao excluir emissor' }, { status: 500 });
  }
  await logger.log({ action: 'emissor_delete', level: 'audit', message: 'Emissor excluído', details: { emissorId: id } });
  return { success: true, id };
}, { auth: true, rate: { limit: 30, intervalMs: 60_000 }, csrf: true, auditAction: 'emissor_delete' });

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-csrf-token',
    },
  });
}
