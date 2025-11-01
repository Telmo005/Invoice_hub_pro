// lib/security/audit-log.ts
export async function logAuthEvent(params: {
  event: string;
  metadata: Record<string, unknown>;
  userId?: string;
}) {
  // Em desenvolvimento, apenas log no console
  if (process.env.NODE_ENV === 'development') {
    console.log('[Auth Event]', params.event, params.metadata);
    return;
  }

  // Se não houver service role key, não tente logar
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  try {
    const { supabaseAdmin } = await import('@/lib/security/supabase-admin');
    await supabaseAdmin.from('auth_audit_log').insert({
      event_type: params.event,
      metadata: params.metadata,
      user_id: params.userId || null
    });
  } catch (error) {
    console.error('Failed to log auth event:', error);
  }
}