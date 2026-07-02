-- Fase 4 bloco 4e: rastreia se já foi enviado o lembrete de renovação do
-- ciclo atual, para o cron diário não reenviar o mesmo email todos os dias
-- durante a janela de SUBSCRIPTION_REMINDER_DAYS_BEFORE. Reposto a NULL
-- sempre que a assinatura renova ou é marcada como vencida (novo ciclo).

BEGIN;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS lembrete_enviado_em TIMESTAMPTZ;

COMMIT;
