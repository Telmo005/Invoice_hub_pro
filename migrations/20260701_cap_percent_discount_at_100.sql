-- Fix M1 (docs/auditoria-inicial.md): percent discount had no upper bound --
-- only `CHECK (desconto >= 0)` existed, so a 500% discount was accepted and
-- silently clamped to "free" by calcular_totais_documento's LEAST(), with no
-- validation error to flag the data-entry mistake. Application-level checks
-- already existed/were added (invoice/create, quotation/create), this adds a
-- DB-level backstop so the rule holds regardless of which code path writes
-- to these tables.
--
-- NOT VALID: enforces the constraint on all new inserts/updates immediately
-- without requiring a scan/failure over any pre-existing rows that might
-- already violate it. Existing rows can be checked/fixed and the constraint
-- validated later with VALIDATE CONSTRAINT, out of scope for this fix.

BEGIN;

ALTER TABLE cotacoes
    ADD CONSTRAINT chk_cotacoes_desconto_percent_max
    CHECK (tipo_desconto <> 'percent' OR desconto <= 100) NOT VALID;

ALTER TABLE faturas
    ADD CONSTRAINT chk_faturas_desconto_percent_max
    CHECK (tipo_desconto <> 'percent' OR desconto <= 100) NOT VALID;

COMMIT;
