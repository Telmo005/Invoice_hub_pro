-- Fix: sequencias_documentos.contador pode ficar dessincronizado do numero
-- real mais alto em documentos_base (ex.: um documento criado com numero
-- explicito, por fora de reservar_numero_documento -- ver a regressao
-- descrita em src/lib/document/buildDadosEspecificos.ts, corrigida em
-- 2026-07-04). Quando isso acontece, reservar_numero_documento devolve um
-- numero que ja existe, e criar_documento_completo falha com
-- "duplicate key value violates unique constraint documentos_base_user_id_numero_key"
-- -- DEPOIS do cliente ja ter pago (confirmado em producao, 2026-07-11,
-- utilizador b6f73194-7089-47a3-9c13-678560780d37, tipo 'cotacao':
-- contador=4 mas ja existiam 5 documentos, o mais alto sendo COT/2026/005).
--
-- Esta migracao faz duas coisas:
--   1. Corrige o drift atual: eleva contador para o maior numero real usado,
--      para qualquer (user_id, tipo) onde isso ainda nao bate.
--   2. Torna reservar_numero_documento auto-corretiva: mesmo que o contador
--      volte a dessincronizar no futuro (ex.: outro numero inserido por
--      fora desta funcao), ela nunca mais devolve um numero que ja existe
--      em documentos_base -- confere e avanca até achar um livre, dentro da
--      mesma reserva atomica (a row lock em sequencias_documentos já
--      serializa chamadas concorrentes, então o loop não reintroduz a
--      condição de corrida que a migração anterior corrigiu).

BEGIN;

-- 1. Corrige o drift existente (idempotente -- só sobe, nunca desce).
UPDATE sequencias_documentos s
SET contador = maior.numero_max,
    atualizado_em = NOW()
FROM (
    SELECT
        db.user_id,
        CASE
            WHEN db.id IN (SELECT id FROM cotacoes) THEN 'cotacao'
            WHEN db.id IN (SELECT id FROM faturas) THEN 'fatura'
            WHEN db.id IN (SELECT id FROM recibos) THEN 'recibo'
        END AS tipo,
        MAX((regexp_match(db.numero, '(\d+)$'))[1]::int) AS numero_max
    FROM documentos_base db
    GROUP BY 1, 2
) maior
WHERE s.user_id = maior.user_id
  AND s.tipo = maior.tipo
  AND maior.numero_max > s.contador;

-- 2. reservar_numero_documento auto-corretiva.
CREATE OR REPLACE FUNCTION reservar_numero_documento(
    p_user_id UUID,
    p_tipo_documento TEXT
) RETURNS TEXT AS $$
DECLARE
    v_prefixo TEXT;
    v_ano TEXT;
    v_contador INTEGER;
    v_numero TEXT;
BEGIN
    v_ano := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    v_prefixo := CASE p_tipo_documento
        WHEN 'cotacao' THEN 'COT'
        WHEN 'fatura' THEN 'FTR'
        WHEN 'recibo' THEN 'REC'
        ELSE 'DOC'
    END;

    LOOP
        INSERT INTO sequencias_documentos (user_id, tipo, prefixo, contador, atualizado_em)
        VALUES (p_user_id, p_tipo_documento, v_prefixo, 1, NOW())
        ON CONFLICT (user_id, tipo) DO UPDATE
            SET contador = sequencias_documentos.contador + 1,
                atualizado_em = NOW()
        RETURNING contador INTO v_contador;

        v_numero := v_prefixo || '/' || v_ano || '/' || LPAD(v_contador::TEXT, 3, '0');

        -- Defesa em profundidade: confirma que este numero nao esta em uso
        -- antes de devolve-lo. Se colidir (drift do contador, numero
        -- inserido por fora desta funcao, etc.), avanca e tenta o proximo
        -- em vez de devolver um numero que vai falhar no INSERT em
        -- documentos_base -- e nunca depois do cliente ja ter pago.
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM documentos_base WHERE user_id = p_user_id AND numero = v_numero
        );
    END LOOP;

    RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- 3. previsualizar_proximo_numero_documento: mesma defesa (best-effort --
-- nao bloqueia nem incrementa, só evita sugerir um numero ja usado).
CREATE OR REPLACE FUNCTION previsualizar_proximo_numero_documento(
    p_user_id UUID,
    p_tipo_documento TEXT
) RETURNS TEXT AS $$
DECLARE
    v_prefixo TEXT;
    v_ano TEXT;
    v_contador INTEGER;
    v_numero TEXT;
BEGIN
    v_ano := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    v_prefixo := CASE p_tipo_documento
        WHEN 'cotacao' THEN 'COT'
        WHEN 'fatura' THEN 'FTR'
        WHEN 'recibo' THEN 'REC'
        ELSE 'DOC'
    END;

    SELECT contador INTO v_contador
    FROM sequencias_documentos
    WHERE user_id = p_user_id AND tipo = p_tipo_documento;

    v_contador := COALESCE(v_contador, 0) + 1;
    v_numero := v_prefixo || '/' || v_ano || '/' || LPAD(v_contador::TEXT, 3, '0');

    WHILE EXISTS (SELECT 1 FROM documentos_base WHERE user_id = p_user_id AND numero = v_numero) LOOP
        v_contador := v_contador + 1;
        v_numero := v_prefixo || '/' || v_ano || '/' || LPAD(v_contador::TEXT, 3, '0');
    END LOOP;

    RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

COMMIT;
