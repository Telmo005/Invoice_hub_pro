-- Migration: Allow pagamentos without documento_id initially and add new status for queue
ALTER TABLE pagamentos ALTER COLUMN documento_id DROP NOT NULL;

-- Adjust status constraint to include 'aguardando_documento'
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.constraint_name INTO constraint_name
  FROM information_schema.constraint_column_usage col
  JOIN information_schema.table_constraints con
    ON con.constraint_name = col.constraint_name
  WHERE col.table_name = 'pagamentos'
    AND col.column_name = 'status'
    AND con.constraint_type = 'CHECK'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE pagamentos DROP CONSTRAINT %I', constraint_name);
  END IF;
  
  EXECUTE 'ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_status_check_new CHECK (status IN (''pendente'',''processando'',''pago'',''falhado'',''cancelado'',''reembolsado'',''aguardando_documento''))';
END$$;

-- Helpful index for queued payments
CREATE INDEX IF NOT EXISTS idx_pagamentos_status_documento_null ON pagamentos(status) WHERE documento_id IS NULL;