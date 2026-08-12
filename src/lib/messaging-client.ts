/**
 * Client for the shared messaging gateway (SMS + Android push to the
 * system owner's device) — the "payment gateway" project, not to be
 * modified from here. Same shape as src/lib/payments/providers/
 * PayGateProvider.ts (thin fetch wrapper, bearer token, never throw past
 * this file) but there's no webhook/callback side to this one: both
 * endpoints just queue and deliver within ~15s on the gateway's own side.
 *
 * Env vars (server-side only — never expose to the client, never commit):
 *   MESSAGING_BASE_URL = https://<gateway-domain>
 *   MESSAGING_API_KEY  = <shared internal token the gateway issues for
 *                         trusted callers of /api/internal/messages/* — NOT
 *                         the same as PAYGATE_API_KEY (that one is per-app,
 *                         scoped to /api/v1/charges only)>
 */

type SendResult = { ok: true; id: string } | { ok: false; error: string };

/** Every push always shows this as its title — the notification should
 *  read as coming from this app, not as a one-off label per event type.
 *  Matters because the celular-gateway receives pushes from several apps
 *  (Invoice Hub, bShare, DueloBet, the gateway itself) on one device. */
const APP_NAME = 'Invoice Hub Pro';

// `fetch` has no default timeout — a hung/unreachable gateway would
// otherwise block whichever request triggered the notification
// indefinitely instead of failing fast.
const REQUEST_TIMEOUT_MS = 8_000;

function config(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = process.env.MESSAGING_BASE_URL;
  const apiKey = process.env.MESSAGING_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

/**
 * Sends a real SMS. `to` must already be E.164. Never throws — callers
 * that need to know whether the message actually got queued should check
 * `.ok`; fire-and-forget callers can ignore the result.
 */
export async function sendSms(to: string, message: string): Promise<SendResult> {
  const cfg = config();
  if (!cfg) return { ok: false, error: 'MESSAGING_BASE_URL/MESSAGING_API_KEY não configurados' };

  try {
    const res = await fetch(`${cfg.baseUrl}/api/internal/messages/sms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.id) {
      return { ok: false, error: `sendSms falhou: ${res.status} ${JSON.stringify(json)}` };
    }
    return { ok: true, id: json.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Fires an Android push notification to the system owner's device.
 * Genuinely fire-and-forget: never throws, so a gateway outage can never
 * take down whichever real operation it's attached to. Still `await` it at
 * call sites so the serverless function doesn't get torn down mid-fetch.
 *
 * `subject`/`description` are laid out in the body like an email (subject
 * line, blank line, description); the title is always APP_NAME. Logs its
 * own failures with console.error only, NOT src/lib/logger.ts's
 * SystemLogger — the logger's error-level writes call sendPush (see the
 * hook in logger.ts), so sendPush calling back into it would recurse.
 */
export async function sendPush(subject: string, description: string): Promise<void> {
  const cfg = config();
  const body = `${subject}\n\n${description}`;
  if (!cfg) {
    console.error('sendPush: MESSAGING_BASE_URL/MESSAGING_API_KEY não configurados, a ignorar', { subject });
    return;
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/api/internal/messages/push`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: APP_NAME, body: body.slice(0, 500) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`sendPush falhou: ${res.status} ${text}`, { subject });
    }
  } catch (err) {
    console.error('sendPush: fetch falhou', { subject, err });
  }
}
