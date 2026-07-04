import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withApiGuard } from '@/lib/api/guard';
import { logger } from '@/lib/logger';
import { emailService } from '@/services/email-service';
import { isAuthorizedCronRequest } from '@/lib/cron/authorizeCron';
import { summarizeErrorLogs, buildErrorDigestHtml } from '@/lib/monitoring/errorDigest';

// Tarefa diária (Vercel Cron, ver vercel.json): sem isto, um pagamento preso
// ou um webhook a falhar só é descoberto quando um utilizador reclama --
// aconteceu várias vezes em 2026-07 (ver limpeza de 14 pagamentos presos).
// Consulta system_logs por entradas level='error' das últimas 24h e envia um
// resumo por email para ALERT_EMAIL, se configurado. Não falha o cron se o
// email não estiver configurado -- apenas regista um aviso, para não
// bloquear o resto do sistema por falta de uma env var opcional.
const DIGEST_WINDOW_HOURS = 24;

export const GET = withApiGuard(async (request: NextRequest) => {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new Date(Date.now() - DIGEST_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const { data: logs, error } = await supabaseAdmin
    .from('system_logs')
    .select('action, message, created_at')
    .eq('level', 'error')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    await logger.logError(error, 'error_alert_cron_query_failed');
    return NextResponse.json({ success: false, error: 'Falha ao consultar system_logs' }, { status: 500 });
  }

  const summary = summarizeErrorLogs(logs || []);

  if (summary.total === 0) {
    await logger.log({
      action: 'system_alert',
      level: 'info',
      message: 'error-alert cron executado: sem erros nas últimas 24h',
      details: { total: 0 }
    });
    return NextResponse.json({ success: true, data: { total: 0, emailSent: false } });
  }

  const alertEmail = process.env.ALERT_EMAIL;
  let emailSent = false;

  if (!alertEmail) {
    await logger.log({
      action: 'system_alert',
      level: 'warn',
      message: `error-alert cron: ${summary.total} erro(s) encontrados mas ALERT_EMAIL não está configurado`,
      details: { total: summary.total, byAction: summary.byAction }
    });
  } else {
    const html = buildErrorDigestHtml(summary);
    const result = await emailService.sendErrorDigest(
      alertEmail,
      `Invoice Hub Pro: ${summary.total} erro(s) nas últimas 24h`,
      html
    );
    emailSent = result.success;

    await logger.log({
      action: 'system_alert',
      level: 'info',
      message: `error-alert cron executado: ${summary.total} erro(s), email ${emailSent ? 'enviado' : 'falhou'}`,
      details: { total: summary.total, byAction: summary.byAction, emailSent }
    });
  }

  return NextResponse.json({ success: true, data: { total: summary.total, byAction: summary.byAction, emailSent } });
}, { rate: { limit: 5, intervalMs: 60_000 }, auditAction: 'error_alert_cron' });
