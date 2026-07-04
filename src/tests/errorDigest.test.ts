import { describe, it, expect } from 'vitest';
import { summarizeErrorLogs } from '@/lib/monitoring/errorDigest';

describe('summarizeErrorLogs', () => {
  it('devolve total zero e listas vazias sem logs', () => {
    const summary = summarizeErrorLogs([]);
    expect(summary.total).toBe(0);
    expect(summary.byAction).toEqual([]);
    expect(summary.samples).toEqual([]);
  });

  it('agrupa por action e conta ocorrências', () => {
    const summary = summarizeErrorLogs([
      { action: 'paysuite_webhook_document_create_failed', message: 'a', created_at: '2026-07-04T10:00:00Z' },
      { action: 'paysuite_webhook_document_create_failed', message: 'b', created_at: '2026-07-04T11:00:00Z' },
      { action: 'next_number_rpc_error', message: 'c', created_at: '2026-07-04T09:00:00Z' }
    ]);
    expect(summary.total).toBe(3);
    expect(summary.byAction).toEqual([
      { action: 'paysuite_webhook_document_create_failed', count: 2 },
      { action: 'next_number_rpc_error', count: 1 }
    ]);
  });

  it('usa a mensagem mais recente de cada action como amostra', () => {
    const summary = summarizeErrorLogs([
      { action: 'x', message: 'antiga', created_at: '2026-07-04T09:00:00Z' },
      { action: 'x', message: 'mais recente', created_at: '2026-07-04T11:00:00Z' }
    ]);
    expect(summary.samples).toHaveLength(1);
    expect(summary.samples[0].message).toBe('mais recente');
  });
});
