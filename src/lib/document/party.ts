import { supabaseServer } from '@/lib/supabase-server';

export interface PartyEmitenteInput {
  nomeEmpresa?: string;
  documento?: string;
  pais?: string;
  cidade?: string;
  bairro?: string;
  pessoaContato?: string | null;
  email?: string;
  telefone?: string;
}

export interface PartyDestinatarioInput {
  nomeCompleto?: string;
  documento?: string | null;
  pais?: string | null;
  cidade?: string | null;
  bairro?: string | null;
  email?: string;
  telefone?: string;
}

// client é opcional -- por defeito usa supabaseServer() (contexto de sessão
// autenticada, respeita RLS). O webhook do PaySuite (Fase 4) não tem sessão
// de utilizador, por isso passa explicitamente supabaseAdmin (service role).
export async function ensureEmitenteId(userId: string, emissor: PartyEmitenteInput, client?: any) : Promise<string> {
  const supabase = client ?? await supabaseServer();
  let emissorId: string | null = null;
  if (emissor.documento) {
    const { data } = await supabase
      .from('emissores')
      .select('id')
      .eq('user_id', userId)
      .eq('documento', emissor.documento)
      .maybeSingle();
    emissorId = data?.id ?? null;
  }
  if (!emissorId && emissor.nomeEmpresa) {
    const { data } = await supabase
      .from('emissores')
      .select('id')
      .eq('user_id', userId)
      .eq('nome_empresa', emissor.nomeEmpresa)
      .maybeSingle();
    emissorId = data?.id ?? null;
  }
  if (!emissorId) {
    const { data } = await supabase
      .from('emissores')
      .insert({
        user_id: userId,
        nome_empresa: emissor.nomeEmpresa ?? 'Empresa',
        documento: emissor.documento ?? '',
        pais: emissor.pais ?? '',
        cidade: emissor.cidade ?? '',
        bairro: emissor.bairro ?? '',
        pessoa_contato: emissor.pessoaContato ?? null,
        email: emissor.email ?? '',
        telefone: emissor.telefone ?? ''
      })
      .select('id')
      .single();
    emissorId = data?.id ?? null;
  }
  return emissorId as string;
}

export async function ensureDestinatarioId(userId: string, dest?: PartyDestinatarioInput, client?: any) : Promise<string | null> {
  if (!dest) return null;
  const supabase = client ?? await supabaseServer();
  let destinatarioId: string | null = null;
  if (dest.documento) {
    const { data } = await supabase
      .from('destinatarios')
      .select('id')
      .eq('user_id', userId)
      .eq('documento', dest.documento)
      .maybeSingle();
    destinatarioId = data?.id ?? null;
  }
  if (!destinatarioId && dest.nomeCompleto) {
    const { data } = await supabase
      .from('destinatarios')
      .select('id')
      .eq('user_id', userId)
      .eq('nome_completo', dest.nomeCompleto)
      .maybeSingle();
    destinatarioId = data?.id ?? null;
  }
  if (!destinatarioId) {
    const { data } = await supabase
      .from('destinatarios')
      .insert({
        user_id: userId,
        nome_completo: dest.nomeCompleto ?? 'Cliente',
        documento: dest.documento ?? null,
        pais: dest.pais ?? null,
        cidade: dest.cidade ?? null,
        bairro: dest.bairro ?? null,
        email: dest.email ?? '',
        telefone: dest.telefone ?? ''
      })
      .select('id')
      .single();
    destinatarioId = data?.id ?? null;
  }
  return destinatarioId as string | null;
}
