# Variáveis de ambiente

Referência para onboarding/deploy (ver auditoria-inicial.md M4 -- não existia
nenhum ficheiro de referência). Lista confirmada via grep de `process.env.`
em todo o `src/`, `middleware.ts` e `next.config.ts` -- não assumida.

Crie um `.env.local` (nunca comitado) com estas chaves preenchidas.

| Variável | Onde é usada | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente + servidor | Project Settings > API no Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente + servidor | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | rotas server-side (`supabaseAdmin`) | nunca expor ao cliente |
| `NEXT_PUBLIC_APP_URL` | links de email, redirects de checkout PaySuite | ex: `https://invoicehubpro.com` |
| `ALLOWED_ORIGIN` | CORS das rotas de API | origem exata permitida |
| `GMAIL_USER` | `email-service.ts` | conta Gmail usada para envio |
| `GMAIL_APP_PASSWORD` | `email-service.ts` | App Password do Gmail, não a password da conta |
| `PAYSUITE_API_TOKEN` | checkout/subscribe (PaySuite) | token da API do gateway |
| `PAYSUITE_WEBHOOK_SECRET` | webhook do PaySuite | usado para verificar `X-Signature` |
| `CRON_SECRET` | `subscription-check`, `error-alert` | Vercel injeta `Authorization: Bearer $CRON_SECRET` nos crons de `vercel.json` |
| `ALERT_EMAIL` | `error-alert` cron | destinatário do resumo diário de erros; se vazio, o cron só regista aviso |
| `NODE_ENV` | vários | `development` / `production` |

Nenhum valor real está neste ficheiro -- apenas nomes e propósito.
