-- Found 2026-07-04 while cleaning up a test document: deleting a row from
-- documentos_base cascades to itens_documento, whose AFTER DELETE trigger
-- (trigger_atualizar_totais -> trigger_calcular_totais) tries to re-upsert
-- totais_documento for the same documento_id. By the time that trigger
-- fires, the parent documentos_base row is already gone (part of the same
-- cascade), so the upsert violates totais_documento_documento_id_fkey and
-- the whole delete fails.
--
-- No document-delete feature exists in the app today, so this hasn't caused
-- a production incident yet -- but it's a landmine for whenever one is
-- added, and it also blocks any manual cleanup of documents-with-items via
-- a plain DELETE. Fix: skip the recalculation entirely if the parent
-- document no longer exists.

BEGIN;

CREATE OR REPLACE FUNCTION public.trigger_atualizar_totais()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_documento_id UUID;
BEGIN
    v_documento_id := COALESCE(NEW.documento_id, OLD.documento_id);

    IF NOT EXISTS (SELECT 1 FROM documentos_base WHERE id = v_documento_id) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    INSERT INTO totais_documento (documento_id, subtotal, total_desconto, total_taxas, total_final)
    SELECT
        v_documento_id,
        subtotal,
        total_desconto,
        total_taxas,
        total_final
    FROM calcular_totais_documento(v_documento_id)
    ON CONFLICT (documento_id)
    DO UPDATE SET
        subtotal = EXCLUDED.subtotal,
        total_desconto = EXCLUDED.total_desconto,
        total_taxas = EXCLUDED.total_taxas,
        total_final = EXCLUDED.total_final,
        created_at = NOW();

    RETURN COALESCE(NEW, OLD);
END;
$function$;

COMMIT;
