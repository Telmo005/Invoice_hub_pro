import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withApiGuard } from '@/lib/api/guard';
import { logger } from '@/lib/logger';
import { emailService } from '@/services/email-service';
import { SUBSCRIPTION_GRACE_PERIOD_DAYS, SUBSCRIPTION_REMINDER_DAYS_BEFORE } from '@/lib/payments/config';
import { isAuthorizedCronRequest } from '@/lib/cron/authorizeCron';

// Fase 4 bloco 4e: tarefa diária (Vercel Cron, ver vercel.json) que substitui
// a cobrança recorrente que o PaySuite não suporta -- em vez de tentar
// cobrar automaticamente, (1) avisa por email quem está perto da renovação
// e ainda não recebeu o lembrete deste ciclo, e (2) bloqueia (marca como
// 'vencida') quem já passou da data de renovação + período de tolerância
// sem renovar. `hasActiveSubscription()` já nega acesso com base na data
// mesmo sem este cron correr -- esta tarefa serve para o estado em BD
// refletir a realidade (dashboards/admin) e para disparar os emails.
//
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function sendReminders(): Promise<number> {
  const reminderThreshold = new Date();
  reminderThreshold.setDate(reminderThreshold.getDate() + SUBSCRIPTION_REMINDER_DAYS_BEFORE);
  const thresholdStr = reminderThreshold.toISOString().slice(0, 10);

  const { data: dueSoon, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id, user_id, data_proxima_cobranca')
    .eq('plano', 'mensal')
    .eq('status', 'ativa')
    .is('lembrete_enviado_em', null)
    .gte('data_proxima_cobranca', todayStr())
    .lte('data_proxima_cobranca', thresholdStr);

  if (error) {
    await logger.logError(error, 'subscription_cron_reminder_query_failed');
    return 0;
  }

  let sent = 0;
  for (const sub of dueSoon || []) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(sub.user_id);
    const email = userData?.user?.email;
    if (!email) continue;

    const renewLink = `${process.env.NEXT_PUBLIC_APP_URL}/pages/subscription`;
    const result = await emailService.sendSubscriptionReminder(email, sub.data_proxima_cobranca, renewLink);
    if (result.success) {
      await supabaseAdmin
        .from('subscriptions')
        .update({ lembrete_enviado_em: new Date().toISOString() })
        .eq('id', sub.id);
      sent++;
    }
  }
  return sent;
}

async function blockOverdue(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SUBSCRIPTION_GRACE_PERIOD_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data: overdue, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id, user_id')
    .eq('plano', 'mensal')
    .eq('status', 'ativa')
    .lte('data_proxima_cobranca', cutoffStr);

  if (error) {
    await logger.logError(error, 'subscription_cron_overdue_query_failed');
    return 0;
  }

  let blocked = 0;
  for (const sub of overdue || []) {
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'vencida', bloqueado_em: new Date().toISOString(), lembrete_enviado_em: null })
      .eq('id', sub.id);
    blocked++;

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(sub.user_id);
    const email = userData?.user?.email;
    if (email) {
      const renewLink = `${process.env.NEXT_PUBLIC_APP_URL}/pages/subscription`;
      await emailService.sendSubscriptionBlocked(email, renewLink);
    }
  }
  return blocked;
}

export const GET = withApiGuard(async (request: NextRequest) => {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [remindersSent, blockedCount] = await Promise.all([sendReminders(), blockOverdue()]);

  await logger.log({
    action: 'system_alert',
    level: 'info',
    message: 'subscription-check executado',
    details: { remindersSent, blockedCount }
  });

  return NextResponse.json({ success: true, data: { remindersSent, blockedCount } });
}, { rate: { limit: 5, intervalMs: 60_000 }, auditAction: 'subscription_cron' });
