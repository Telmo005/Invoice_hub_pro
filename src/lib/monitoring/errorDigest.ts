export interface ErrorLogEntry {
  action: string;
  message: string;
  created_at: string;
}

export interface ErrorDigestSummary {
  total: number;
  byAction: Array<{ action: string; count: number }>;
  // Amostra mais recente de cada action -- suficiente para diagnosticar sem
  // despejar todas as linhas (podem ser dezenas) no corpo do email.
  samples: ErrorLogEntry[];
}

export function summarizeErrorLogs(logs: ErrorLogEntry[]): ErrorDigestSummary {
  const counts = new Map<string, number>();
  const latestByAction = new Map<string, ErrorLogEntry>();

  for (const log of logs) {
    counts.set(log.action, (counts.get(log.action) ?? 0) + 1);

    const existing = latestByAction.get(log.action);
    if (!existing || new Date(log.created_at) > new Date(existing.created_at)) {
      latestByAction.set(log.action, log);
    }
  }

  const byAction = Array.from(counts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: logs.length,
    byAction,
    samples: byAction.map(({ action }) => latestByAction.get(action)!)
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildErrorDigestHtml(summary: ErrorDigestSummary): string {
  const rows = summary.byAction.map(({ action, count }) => {
    const sample = summary.samples.find(s => s.action === action);
    return `
      <tr>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${escapeHtml(action)}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;">${count}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#4b5563;">${escapeHtml(sample?.message ?? '')}</td>
      </tr>`;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter','Segoe UI',system-ui,sans-serif;color:#1f2937;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#b91c1c 0%,#ef4444 100%);color:white;padding:32px 30px;text-align:center;">
      <div style="font-size:22px;font-weight:700;">Invoice Hub Pro</div>
      <h1 style="font-size:20px;font-weight:600;margin:12px 0 0 0;">${summary.total} erro(s) nas últimas 24h</h1>
    </div>
    <div style="padding:24px 30px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr>
            <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Ação</th>
            <th style="padding:8px 12px;border:1px solid #e5e7eb;">Ocorrências</th>
            <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Última mensagem</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="text-align:center;padding:20px 30px;background:#f8fafc;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;">
      <p style="margin:4px 0;">Consulte system_logs para detalhes completos.</p>
    </div>
  </div>
</body>
</html>`;
}
