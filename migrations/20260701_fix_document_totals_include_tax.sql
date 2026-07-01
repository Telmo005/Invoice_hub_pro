-- Fix C4 (docs/auditoria-inicial.md): calcular_totais_documento() computed
-- total_final = subtotal - total_desconto and never summed per-item taxes
-- (taxas_itens), even though the totais_documento.total_taxas column exists.
-- Meanwhile the client (useNewDocumentWizzardForm.ts) computes
-- totalFinal = subtotal + totalTaxas - desconto and DOES include tax. Result:
-- the persisted total (used for payment reconciliation, vw_pagamentos_detalhados)
-- could differ from the amount actually shown/charged whenever a document has
-- any tax line. This migration makes the DB match the client's formula.
--
-- Tax model (matches useNewDocumentWizzardForm.ts:267-270): additive per item,
-- computed on the item's own pre-discount base value (quantidade * preco_unitario),
-- not compounding, and not affected by desconto.

BEGIN;

-- Return type changes (added total_taxas), so the function must be dropped first.
DROP FUNCTION IF EXISTS calcular_totais_documento(UUID);

CREATE OR REPLACE FUNCTION calcular_totais_documento(p_documento_id UUID)
RETURNS TABLE(subtotal NUMERIC, total_desconto NUMERIC, total_taxas NUMERIC, total_final NUMERIC) AS $$
DECLARE
    v_subtotal NUMERIC := 0;
    v_total_taxas NUMERIC := 0;
    v_desconto NUMERIC := 0;
    v_tipo_desconto TEXT;
    v_valor_desconto NUMERIC;
BEGIN
    -- Subtotal dos itens
    SELECT COALESCE(SUM(total_item), 0) INTO v_subtotal
    FROM itens_documento
    WHERE documento_id = p_documento_id;

    -- Impostos: por item, sobre o valor base do próprio item (qtd * preco_unitario),
    -- aditivo entre taxas e itens, sem compor
    SELECT COALESCE(SUM(
        CASE ti.tipo
            WHEN 'percent' THEN id.total_item * ti.valor / 100
            ELSE ti.valor
        END
    ), 0) INTO v_total_taxas
    FROM itens_documento id
    JOIN taxas_itens ti ON ti.item_id = id.id
    WHERE id.documento_id = p_documento_id;

    -- Informações de desconto baseadas no tipo de documento
    SELECT
        CASE
            WHEN c.id IS NOT NULL THEN c.desconto
            WHEN f.id IS NOT NULL THEN f.desconto
            ELSE 0
        END,
        CASE
            WHEN c.id IS NOT NULL THEN c.tipo_desconto
            WHEN f.id IS NOT NULL THEN f.tipo_desconto
            ELSE 'fixed'
        END
    INTO v_valor_desconto, v_tipo_desconto
    FROM documentos_base db
    LEFT JOIN cotacoes c ON c.id = db.id
    LEFT JOIN faturas f ON f.id = db.id
    WHERE db.id = p_documento_id;

    IF v_tipo_desconto = 'percent' THEN
        v_desconto := (v_subtotal * v_valor_desconto / 100);
    ELSE
        v_desconto := v_valor_desconto;
    END IF;

    -- Garantir que desconto não seja maior que subtotal
    v_desconto := LEAST(v_desconto, v_subtotal);

    subtotal := v_subtotal;
    total_desconto := v_desconto;
    total_taxas := v_total_taxas;
    -- Mesma fórmula do cliente: subtotal + taxas - desconto, nunca negativo
    total_final := GREATEST(0, v_subtotal + v_total_taxas - v_desconto);

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_atualizar_totais()
RETURNS TRIGGER AS $$
DECLARE
    v_documento_id UUID;
BEGIN
    v_documento_id := COALESCE(NEW.documento_id, OLD.documento_id);

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
$$ LANGUAGE plpgsql;

-- taxas_itens has no trigger today. criar_documento_completo() inserts each
-- item, then that item's taxes -- so the itens_documento trigger above fires
-- BEFORE that item's own taxes exist, and nothing re-fires afterwards. Without
-- this trigger, the last item's taxes (and any later tax edit) never reach
-- totais_documento. Recompute totals whenever a tax row changes too.
CREATE OR REPLACE FUNCTION trigger_atualizar_totais_por_taxa()
RETURNS TRIGGER AS $$
DECLARE
    v_documento_id UUID;
BEGIN
    SELECT documento_id INTO v_documento_id
    FROM itens_documento
    WHERE id = COALESCE(NEW.item_id, OLD.item_id);

    IF v_documento_id IS NULL THEN
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calcular_totais_taxas ON taxas_itens;
CREATE TRIGGER trigger_calcular_totais_taxas
    AFTER INSERT OR UPDATE OR DELETE ON taxas_itens
    FOR EACH ROW EXECUTE FUNCTION trigger_atualizar_totais_por_taxa();

-- Backfill: recompute totals for every existing document so previously
-- persisted totals (which excluded tax) are corrected immediately.
INSERT INTO totais_documento (documento_id, subtotal, total_desconto, total_taxas, total_final)
SELECT db.id, t.subtotal, t.total_desconto, t.total_taxas, t.total_final
FROM documentos_base db
CROSS JOIN LATERAL calcular_totais_documento(db.id) t
ON CONFLICT (documento_id) DO UPDATE SET
    subtotal = EXCLUDED.subtotal,
    total_desconto = EXCLUDED.total_desconto,
    total_taxas = EXCLUDED.total_taxas,
    total_final = EXCLUDED.total_final,
    created_at = NOW();

COMMIT;
