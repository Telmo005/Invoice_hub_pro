import type { SupabaseClient } from '@supabase/supabase-js';

// criar_documento_completo() reserva o número real de forma atómica e não o
// devolve (só devolve o id) -- ver buildDadosEspecificos.ts. Os chamadores
// que precisam de mostrar/logar o número definitivo (não o previsualizado no
// wizard, que pode divergir sob concorrência) devem usar isto após a criação.
export async function fetchNumeroDocumento(
  supabase: SupabaseClient,
  documentoId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('documentos_base')
    .select('numero')
    .eq('id', documentoId)
    .maybeSingle();

  if (error || !data) return null;
  return data.numero;
}
