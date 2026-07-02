# Auditoria Inicial — Invoice Hub Pro

Data: 2026-07-01
Branch auditada: `feat/add_logo` (paridade com `main` na maioria dos ficheiros)
Âmbito: stack, segurança, isolamento multi-tenant, lógica financeira/geração de documentos, e módulo de pagamentos (M-Pesa).

## 1. Stack atual (confirmada por inspeção, não assumida)

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15.5.19 (App Router), React 19.2 / React DOM 19.2 |
| Linguagem | TypeScript 5.9 |
| Base de dados | Supabase (Postgres) — `@supabase/supabase-js` 2.80, `@supabase/ssr` 0.7 |
| Autenticação | Supabase Auth (cookies de sessão via `@supabase/ssr`) |
| Estilos | Tailwind CSS 4 + Bootstrap 5.3 |
| Email | Nodemailer 9.x (Gmail) |
| Validação | Zod 3.23 (usado em apenas 1 de ~29 rotas de API) |
| Pagamentos | Integração M-Pesa própria (agregador via `MPESA_BASE_URL`), sem SDK de terceiros |
| Testes | Vitest 4.x — cobertura mínima (2 testes, ver secção 4) |
| Lint/format | ESLint 9 + typescript-eslint 8; sem Prettier configurado |
| Análise de código morto | Knip |

Não existem ficheiros de configuração para Stripe, PaySuite, e2Payments, ou qualquer outro agregador — a única integração de pagamento é M-Pesa, construída à medida.

**Descoberta importante de contexto**: a integração M-Pesa já não é "a implementar de raiz" (Fase 4 do pedido original) — já existe e já está a ser usada exatamente para o modelo "10 MT por documento" (ver secção 5). Isto muda o ponto de partida da Fase 4: é conserto/robustecimento de algo que já existe, não construção do zero.

---

## 2. Lista priorizada de problemas

### 🔴 CRÍTICO

**C1. Não existe Row Level Security (RLS) em nenhuma tabela.**
`database.sql` (770 linhas) e todos os ficheiros em `migrations/` não têm nenhum `ENABLE ROW LEVEL SECURITY` nem `CREATE POLICY`. Todo o isolamento entre utilizadores depende de cada rota de API lembrar-se de filtrar por `user_id`. Um único filtro esquecido = exposição de dados financeiros de outro utilizador. Numa app financeira multi-tenant, isto é a prioridade máxima.

**C2. IDOR não autenticado confirmado em visualização/PDF de documentos.**
- [src/app/api/document/view/[id]/route.ts](src/app/api/document/view/[id]/route.ts) (linhas 84-135) e [src/app/api/document/pdf/[id]/route.ts](src/app/api/document/pdf/[id]/route.ts) (linhas 84-161): usam o cliente `supabaseAdmin` (service-role, ignora RLS), **sem qualquer verificação de autenticação**, e filtram apenas por `.eq('id', documentId)`.
- Qualquer pessoa que conheça/adivinhe um UUID de documento consegue ver o HTML completo (valores, nome do cliente, dados da empresa) — endpoints GET públicos, sem rate limiting.
- Isto é uma fuga de dados cross-tenant real e explorável hoje, não uma hipótese teórica.

**C3. Condição de corrida na numeração de documentos.**
`gerar_numero_documento` ([database.sql:312-351](database.sql#L312-L351)) calcula o próximo número com `SELECT COUNT(*) + 1`, sem `FOR UPDATE`, sem `pg_advisory_xact_lock`, sem sequence dedicada. Duas inserções concorrentes do mesmo utilizador podem calcular o mesmo número. O único guarda-costas é a constraint `UNIQUE(user_id, numero)`, que transforma a corrida num erro não tratado em vez de a prevenir. Para numeração sequencial legal de faturas em Moçambique, isto é um risco de integridade real.

**C4. Total persistido não inclui impostos (IVA).**
`calcular_totais_documento` ([database.sql:362-419](database.sql#L362-L419)) calcula `total_final = subtotal - total_desconto` — **o imposto nunca é somado**. A coluna `total_taxas` existe em `totais_documento` mas fica sempre a 0 (default), nunca é escrita pelo trigger. Entretanto, o total mostrado ao utilizador/no PDF é calculado no cliente ([src/app/hooks/forms/useNewDocumentWizzardForm.ts:245-300](src/app/hooks/forms/useNewDocumentWizzardForm.ts#L245-L300)) e **inclui** impostos. Resultado: o valor guardado na BD (usado para conciliação de pagamentos, `vw_pagamentos_detalhados`) pode divergir do valor mostrado/cobrado ao cliente sempre que exista IVA na fatura. Isto é um bug financeiro direto.

### 🟠 ALTO

**A1. `middleware.ts` não faz autenticação/autorização — apenas headers de segurança.**
O matcher cobre `/dashboard`, `/invoices`, `/quotations`, `/receipts`, mas o corpo do middleware nunca chama `supabase.auth.getUser()` nem redireciona utilizadores não autenticados. A proteção fica inteiramente delegada a cada página/rota lembrar-se de verificar (arquitetura "fail-open"). C2 é exatamente este modo de falha a acontecer na prática.

**A2. `/api/mpesa` e `/api/mpesa/retry` sem rate limiting nem CSRF**, ao contrário de outras rotas (`/api/emissores`, `/api/document/*/create`) que usam `withApiGuard`. Abre a porta a flooding/abuso em endpoints que iniciam cobranças reais.

**A3. Bug de autorização em `finalize/route.ts`**: [src/app/api/mpesa/finalize/route.ts:15](src/app/api/mpesa/finalize/route.ts#L15) tem `const userId: string | null = null; // Placeholder` — a verificação de posse do pagamento (`.eq('user_id', userId)`) está efetivamente quebrada/inativa.

**A4. Validação de input inconsistente**: Zod é usado em apenas 1 das ~29 rotas de API (`document/validate`). As rotas de criação de fatura/cotação/recibo fazem `request.json()` cru com verificações manuais parciais — payloads malformados ou anómalos chegam à RPC `criar_documento_completo` sem validação de tipo/tamanho/formato.

**A5. Nenhuma verificação NUIT.** `emissores.documento`/`destinatarios.documento` são `TEXT` livre, sem CHECK nem regex, no cliente ou na BD. Um NUIT moçambicano tem 9 dígitos com estrutura definida; atualmente aceita-se qualquer texto, o que é depois impresso em documentos legais.

**A6. HTML não escapado em emails transacionais.** [src/services/email-service.ts:246,249](src/services/email-service.ts#L246-L249) interpola `clientName`/`documentNumber` diretamente no HTML do email sem sanitização — contrasta com `templateService.ts` que usa `escapeHtml` consistentemente nos templates de documentos. Um nome de cliente maldoso pode injetar HTML no email de notificação.

**A7. `document/detail/[id]/route.ts` verifica `user_id` só na primeira query**, e as queries seguintes (a `documentos_base`, `itens_documento`, `faturas`/`cotacoes`/`recibos`) filtram só por `id`/`documento_id`. Não é explorável isoladamente hoje, mas é frágil — sem RLS como rede de segurança, qualquer refactor futuro pode reintroduzir IDOR silenciosamente.

### 🟡 MÉDIO

**M1. Desconto percentual sem limite superior.** Só existe `CHECK (desconto >= 0)`; nada impede um desconto de 500%. É mitigado por `LEAST(v_desconto, v_subtotal)` (não fica negativo), mas mascara erros de input sem aviso.

**M2. CSP permite `'unsafe-inline'`** em `script-src` e `style-src` ([middleware.ts:26-27](middleware.ts#L26-L27)) — enfraquece a defesa contra XSS, sem estratégia de nonce/hash.

**M3. Dois clientes `supabaseAdmin` distintos** ([src/lib/supabase-admin.ts](src/lib/supabase-admin.ts) e [src/lib/security/supabase-admin.ts](src/lib/security/supabase-admin.ts)) com comportamento de falha diferente — um lança erro se faltar env var, o outro cai silenciosamente para `''`. Consolidar num só.

**M4. Falta `.env.example`.** Variáveis usadas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NEXT_PUBLIC_APP_URL`, `MPESA_API_KEY`, `MPESA_BASE_URL`, `MPESA_TIMEOUT`, `ALLOWED_ORIGIN`, `NODE_ENV`) não têm um ficheiro de referência para onboarding/deploy — aumenta risco de má configuração em produção.

**M5. Sem rounding explícito no SQL.** `calcular_totais_documento` não chama `ROUND()` — valores `NUMERIC` passam com precisão total, com risco de inconsistência de exibição/impressão face ao arredondamento (se algum) aplicado no cliente.

**M6. Inconsistência entre migrations**: [migrations/20251121_remove_check_metodo_pagamento.sql](migrations/20251121_remove_check_metodo_pagamento.sql) remove o CHECK de `faturas.metodo_pagamento` (tornando-o texto livre), enquanto `pagamentos.metodo` continua a impor um enum fixo — inconsistência entre tabelas relacionadas.

**M7. Sem rate limiting real** — o único "rate limit" é implementado no cliente ([src/app/hooks/document/useDocumentManager.ts:69-110](src/app/hooks/document/useDocumentManager.ts#L69-L110)), trivialmente contornável chamando a API diretamente. Existe um `withApiGuard` server-side robusto, mas só é usado nalgumas rotas (ver A2).

**M8. 2 vulnerabilidades moderadas no `npm audit`**, herdadas de `postcss` empacotado dentro do `next` (GHSA-qx2v-qp2m-jg93, XSS em CSS, CVSS 6.1). A sugestão do `npm audit fix` (downgrade do Next para 9.3.3) é enganosa — é preciso aguardar patch upstream do Next, não seguir a sugestão automática.

### 🟢 BAIXO

- Log obsoleto em [src/app/api/document/receipt/create/route.ts:289](src/app/api/document/receipt/create/route.ts#L289) referencia a RPC removida `criar_fatura_completa` — é só texto de log, a chamada real (linha 273) já usa `criar_documento_completo` corretamente. Resto da migração do README está limpo (sem outras referências vivas a nomes removidos).
- Todas as colunas monetárias usam `NUMERIC` (não `FLOAT`/`REAL`) — boa prática já seguida, evita bugs clássicos de arredondamento binário.
- `X-XSS-Protection` header definido — obsoleto/no-op em browsers modernos, inofensivo mas desnecessário.
- Modelo de IVA é livre (o utilizador define impostos nomeados por item) — não é um bug, mas significa que não há uma taxa de IVA moçambicana fixa/validada em lado nenhum do sistema.
- Cookie CSRF com `httpOnly`, `sameSite: 'strict'` — bem implementado onde é aplicado; falta é aplicá-lo consistentemente (ver A2).

---

## 3. Estado real do módulo de pagamentos (vs. Fase 4 do pedido original)

**O que já existe:**
- Modelo pay-per-documento (10 MT) **já implementado**: [src/app/hooks/payment/usePayment.ts:53](src/app/hooks/payment/usePayment.ts#L53) define `LIBERATION_FEE = 10`. Fluxo: valida número → cobra 10 MT via M-Pesa → só depois cria o documento (`/api/mpesa` inicia com status `aguardando_documento`, `/api/mpesa/finalize` cria o documento depois de confirmado).
- Tabela `pagamentos` já com maior parte dos campos do target spec (user_id, metodo, valor, moeda, status, mpesa_transaction_id, timestamps), mais campos de fraude/risco (`risk_score`, `customer_ip`, `device_fingerprint`) definidos mas não usados no código.
- Tabela separada `mpesa_transactions` regista payloads brutos de pedido/resposta do gateway.

**O que falta (gaps reais vs. o pedido):**
- **Sem endpoint de webhook** — o fluxo é 100% síncrono (pedido/resposta); não há verificação de assinatura de callback do gateway em lado nenhum do código.
- **Sem modelo de assinatura mensal** — nenhuma tabela `subscriptions`, nenhum campo `plano`/`tier` em `emissores` ou utilizadores.
- **Só M-Pesa** — sem e-Mola nem Visa/Mastercard (o enum de `metodo` já tem placeholders `stripe`/`multicaixa` mas sem implementação).
- **"Retry" é enganoso**: não há retry automático com backoff da chamada M-Pesa (removido explicitamente, comentário no código confirma "single-shot"); o que existe é um cron manual que reassocia pagamentos já confirmados a documentos quando o `finalize` falhou.
- Bug de autorização já referido em A3 (`userId` hardcoded a `null` em `finalize`).
- Sem idempotency key server-side para a chamada ao gateway (a referência de transação é gerada no cliente, sem verificação de unicidade antes de chamar o M-Pesa).

---

## 4. Cobertura de testes

Suite atual: [src/tests/validation.test.ts](src/tests/validation.test.ts) — **2 testes** (formato de email + campos obrigatórios de emissor). Zero cobertura para: cálculo de totais/descontos, concorrência de numeração, cálculo de impostos, validação de NUIT, expiração de cotação, ou qualquer fluxo de pagamento. Todos os bugs financeiros críticos (C3, C4) são exatamente a classe de defeito que testes apanhariam.

---

## 5. Proposta de plano de correção (por fase)

Esta proposta segue a ordem pedida (corrigir críticos/altos primeiro, depois modernizar). Não vou avançar para a Fase 2 sem a tua confirmação.

1. **RLS + fecho dos IDOR (C1, C2, A1, A7)** — adicionar políticas RLS em todas as tabelas de tenant (`auth.uid() = user_id`, propagado a tabelas filhas via join a `documentos_base.user_id`), e adicionar autenticação + verificação de posse em `document/view/[id]` e `document/pdf/[id]` imediatamente (isto pode e deve ser corrigido antes de tudo o resto — é uma fuga de dados ativa).
2. **Numeração de documentos (C3)** — substituir `SELECT COUNT(*)` por uma sequence por utilizador/tipo ou `pg_advisory_xact_lock`, com teste de concorrência.
3. **Impostos no total persistido (C4)** — corrigir `calcular_totais_documento` para somar `total_taxas` corretamente, e reconciliar com o cálculo do lado do cliente para que ambos concordem (idealmente, o cliente deixa de recalcular e só reflete o valor vindo da BD).
4. **Correções altas restantes (A2–A6)**: rate limiting + CSRF nas rotas M-Pesa, corrigir `userId` hardcoded em `finalize`, adotar Zod em todas as rotas de criação/edição, validação de NUIT, escape de HTML nos emails.
5. **Médios (M1–M8)**: cap de desconto a 100%, `.env.example`, consolidar clientes admin, CSP sem `unsafe-inline`, rounding explícito, alinhar constraint de `metodo_pagamento`.
6. **Testes de regressão** cobrindo especificamente os pontos acima antes de qualquer refactor maior (para não partir o que já funciona, conforme a regra geral).

**Preciso da tua confirmação para avançar** para a Fase 2 (correção), ou se preferes que eu comece já pelos críticos (C1–C4) isoladamente antes de discutir o resto do plano.
