-- Migração PayGate -> Debito Pay: pagamentos.metodo ganhou 3 valores novos
-- ('mkesh', 'visa_mastercard', 'payfast') mas a constraint criada em
-- 20260702_add_subscriptions_and_paysuite_support.sql ainda só permite
-- ('mpesa', 'emola', 'credit_card', 'stripe', 'transferencia', 'multicaixa',
-- 'dinheiro', 'cheque') -- sem isto, qualquer INSERT com um destes métodos
-- falha com violação de CHECK depois de o pagamento já ter sido processado
-- (e cobrado) pela Debito Pay, deixando-o por registar.
--
-- 'credit_card' mantido na lista (não removido) para não invalidar linhas
-- históricas já gravadas com esse valor -- Postgres valida TODAS as linhas
-- existentes ao recriar a constraint sem NOT VALID.

BEGIN;

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
  CHECK (metodo IN (
    'mpesa', 'emola', 'mkesh', 'credit_card', 'visa_mastercard', 'payfast',
    'stripe', 'transferencia', 'multicaixa', 'dinheiro', 'cheque'
  ));

COMMIT;
