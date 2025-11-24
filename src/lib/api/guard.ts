import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { rateLimit } from '@/app/api/lib/rate.limit';
import { logger } from '@/lib/logger';
import { verifyCsrfToken } from '@/lib/security/csrf';

interface GuardOptions {
  auth?: boolean;
  rate?: { limit: number; intervalMs?: number };
  csrf?: boolean;
  auditAction?: string;
}

const limiterCache = new Map<number, ReturnType<typeof rateLimit>>();

export function withApiGuard<T>(handler: (req: NextRequest, ctx: { user: any | null }) => Promise<T | NextResponse>, opts: GuardOptions = {}) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const start = Date.now();
    const identifier = req.headers.get('x-forwarded-for') || 'anonymous';
    let user: any = null;
    let ok = true;

    try {
      // Rate limit
      if (opts.rate) {
        const interval = opts.rate.intervalMs || 60_000;
        if (!limiterCache.has(interval)) {
          limiterCache.set(interval, rateLimit({ interval, uniqueTokenPerInterval: 500 }));
        }
        const limited = limiterCache.get(interval)!.check(opts.rate.limit, identifier);
        if (limited) {
          ok = false;
          return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }
      }

      // Auth
      if (opts.auth) {
        const supabase = await supabaseServer();
        const { data: { user: supUser } } = await supabase.auth.getUser();
        if (!supUser) {
          ok = false;
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        user = supUser;
      }

      // CSRF (only for mutating) - expects header x-csrf-token and cookie csrf_token
      if (opts.csrf && req.method !== 'GET' && req.method !== 'OPTIONS') {
        const sent = req.headers.get('x-csrf-token');
        const cookieHeader = req.headers.get('cookie') || '';
        const stored = /csrf_token=([^;]+)/.exec(cookieHeader)?.[1];
        const valid = verifyCsrfToken(sent, stored);
        if (!valid) {
          ok = false;
          await logger.logSecurityEvent('csrf_validation_failed', 'medium', {
            path: req.nextUrl.pathname,
            method: req.method,
            hasHeader: !!sent,
            hasCookie: !!stored
          });
          return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
        }
      }

      const result = await handler(req, { user });
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result as any);
    } catch (err) {
      await logger.logError(err as Error, opts.auditAction || 'api_guard_error');
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    } finally {
      await logger.logApiCall(req.nextUrl.pathname, req.method, Date.now() - start, ok);
    }
  };
}
