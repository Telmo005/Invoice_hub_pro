-- 2026-07-05: campo "Documento Fiscal" estava limitado ao NUIT moçambicano,
-- mas a app serve utilizadores de vários países (validação genérica: só o
-- NUIT tem uma regra de formato real, e só quando o país é Moçambique --
-- ver isValidDocumentoFiscal em src/lib/validation.ts). Adiciona a coluna que
-- guarda QUAL tipo de documento o número representa (NUIT, NIF, VAT, TIN,
-- CPF, Outro), para emissores e destinatários.
--
-- Default 'Outro' para linhas existentes (não assumimos que um documento
-- estrangeiro já registado era um NUIT só porque a app não distinguia antes),
-- exceto quando o país já indicava Moçambique -- nesse caso o valor
-- historicamente já era tratado como NUIT, então o backfill marca-o como tal.

BEGIN;

ALTER TABLE emissores
  ADD COLUMN IF NOT EXISTS documento_tipo TEXT NOT NULL DEFAULT 'Outro'
  CHECK (documento_tipo IN ('NUIT', 'NIF', 'VAT', 'TIN', 'CPF', 'Outro'));

ALTER TABLE destinatarios
  ADD COLUMN IF NOT EXISTS documento_tipo TEXT NOT NULL DEFAULT 'Outro'
  CHECK (documento_tipo IN ('NUIT', 'NIF', 'VAT', 'TIN', 'CPF', 'Outro'));

UPDATE emissores
SET documento_tipo = 'NUIT'
WHERE lower(trim(pais)) IN ('moçambique', 'mocambique', 'mz', 'mozambique');

UPDATE destinatarios
SET documento_tipo = 'NUIT'
WHERE lower(trim(pais)) IN ('moçambique', 'mocambique', 'mz', 'mozambique');

COMMIT;
