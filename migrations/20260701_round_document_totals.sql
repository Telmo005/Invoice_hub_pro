-- Fix M5 (docs/auditoria-inicial.md): calcular_totais_documento() never
-- rounded monetary output -- NUMERIC values passed through at full precision
-- (e.g. percentage-based tax/discount math can produce many decimal places),
-- risking display/print inconsistency versus whatever rounding the client
-- applies (client already rounds to 2 decimals via toFixed(2)).

BEGIN;

CREATE OR REPLACE FUNCTION calcular_totais_documento(p_documento_id UUID)
RETURNS TABLE(subtotal NUMERIC, total_desconto NUMERIC, total_taxas NUMERIC, total_final NUMERIC) AS $$
DECLARE
    v_subtotal NUMERIC := 0;
    v_total_taxas NUMERIC := 0;
    v_desconto NUMERIC := 0;
    v_tipo_desconto TEXT;
    v_valor_desconto NUMERIC;
BEGIN
    SELECT COALESCE(SUM(total_item), 0) INTO v_subtotal
    FROM itens_documento
    WHERE documento_id = p_documento_id;

    SELECT COALESCE(SUM(
        CASE ti.tipo
            WHEN 'percent' THEN id.total_item * ti.valor / 100
            ELSE ti.valor
        END
    ), 0) INTO v_total_taxas
    FROM itens_documento id
    JOIN taxas_itens ti ON ti.item_id = id.id
    WHERE id.documento_id = p_documento_id;

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

    v_desconto := LEAST(v_desconto, v_subtotal);

    subtotal := ROUND(v_subtotal, 2);
    total_desconto := ROUND(v_desconto, 2);
    total_taxas := ROUND(v_total_taxas, 2);
    total_final := ROUND(GREATEST(0, v_subtotal + v_total_taxas - v_desconto), 2);

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMIT;
