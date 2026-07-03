-- Fase 4 (docs/auditoria-inicial.md remediation plan): fundação para o
-- gateway de pagamentos PaySuite e o modelo de assinatura mensal (250 MT)
-- em paralelo com o pay-per-documento (10 MT) já existente. PaySuite é só
-- o processador de cobrança -- a lógica de recorrência é nossa.

BEGIN;

-- =============================================
-- SUBSCRIPTIONS: uma linha por utilizador representando o plano atual.
-- Ausência de linha = pay_per_documento por defeito (compatível com
-- utilizadores existentes antes desta funcionalidade existir).
-- =============================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  plano TEXT NOT NULL CHECK (plano IN ('mensal', 'pay_per_documento')) DEFAULT 'pay_per_documento',
  status TEXT NOT NULL CHECK (status IN ('ativa', 'pendente', 'vencida', 'cancelada')) DEFAULT 'pendente',
  valor_mensal NUMERIC NOT NULL DEFAULT 250,
  moeda TEXT NOT NULL DEFAULT 'MZN',
  data_inicio DATE,
  data_proxima_cobranca DATE,
  data_cancelamento DATE,
  bloqueado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_data_proxima_cobranca ON subscriptions(data_proxima_cobranca);

CREATE TRIGGER trigger_update_subscriptions
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_own ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY subscriptions_insert_own ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY subscriptions_update_own ON subscriptions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- PAGAMENTOS: alargar metodo para incluir emola/credit_card (M-Pesa, e-Mola
-- e Visa via PaySuite -- ver AskUserQuestion 2026-07-02, Mkesh não
-- documentado no PaySuite, fora de âmbito por agora), e distinguir qual
-- gateway processou cada pagamento durante a transição do M-Pesa direto
-- para o PaySuite.
-- =============================================
-- Descobre o nome real da constraint (não assumir a convenção de
-- nomeação automática do Postgres) para não falhar num ambiente onde o
-- nome difere do esperado.
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'pagamentos' AND att.attname = 'metodo' AND con.contype = 'c';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE pagamentos DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_metodo_check
  CHECK (metodo IN ('mpesa', 'emola', 'credit_card', 'stripe', 'transferencia', 'multicaixa', 'dinheiro', 'cheque'));

ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS gateway TEXT NOT NULL DEFAULT 'mpesa_direct'
  CHECK (gateway IN ('mpesa_direct', 'paysuite'));

-- tipo_documento passa a aceitar um pagamento sem documento associado
-- (renovação de assinatura mensal)
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'pagamentos' AND att.attname = 'tipo_documento' AND con.contype = 'c';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE pagamentos DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_tipo_documento_check
  CHECK (tipo_documento IN ('cotacao', 'fatura', 'recibo', 'assinatura'));

ALTER TABLE pagamentos ALTER COLUMN documento_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_gateway ON pagamentos(gateway);

COMMIT;
