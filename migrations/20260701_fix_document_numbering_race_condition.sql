-- Fix C3 (docs/auditoria-inicial.md): gerar_numero_documento() used
-- SELECT COUNT(*) with no locking/sequence. Two concurrent document creations
-- for the same user could compute the identical next number; the only guard
-- was the UNIQUE(user_id, numero) constraint, which turned the race into an
-- unhandled exception for the losing request instead of preventing it.
--
-- sequencias_documentos already existed (user_id, tipo, prefixo) but had no
-- counter column. This adds one and uses it as an atomic per-(user_id, tipo)
-- reservation via INSERT ... ON CONFLICT DO UPDATE, which Postgres serializes
-- through the row lock -- concurrent callers block on each other instead of
-- reading the same stale count.

BEGIN;

ALTER TABLE sequencias_documentos ADD COLUMN IF NOT EXISTS contador INTEGER NOT NULL DEFAULT 0;

-- Backfill each user/tipo counter from the existing COUNT(*)-based numbering
-- so continuity is preserved for documents already created under the old scheme.
INSERT INTO sequencias_documentos (user_id, tipo, prefixo, contador)
SELECT db.user_id, 'cotacao', 'COT', COUNT(*)
FROM documentos_base db JOIN cotacoes c ON c.id = db.id
GROUP BY db.user_id
ON CONFLICT (user_id, tipo) DO UPDATE SET contador = GREATEST(sequencias_documentos.contador, EXCLUDED.contador);

INSERT INTO sequencias_documentos (user_id, tipo, prefixo, contador)
SELECT db.user_id, 'fatura', 'FTR', COUNT(*)
FROM documentos_base db JOIN faturas f ON f.id = db.id
GROUP BY db.user_id
ON CONFLICT (user_id, tipo) DO UPDATE SET contador = GREATEST(sequencias_documentos.contador, EXCLUDED.contador);

INSERT INTO sequencias_documentos (user_id, tipo, prefixo, contador)
SELECT db.user_id, 'recibo', 'REC', COUNT(*)
FROM documentos_base db JOIN recibos r ON r.id = db.id
GROUP BY db.user_id
ON CONFLICT (user_id, tipo) DO UPDATE SET contador = GREATEST(sequencias_documentos.contador, EXCLUDED.contador);

-- Atomic reservation: call this from criar_documento_completo(). The
-- INSERT .. ON CONFLICT DO UPDATE acquires the row lock on (user_id, tipo), so
-- concurrent callers serialize and each gets a distinct, strictly increasing
-- contador -- no more duplicate numbers under concurrency.
CREATE OR REPLACE FUNCTION reservar_numero_documento(
    p_user_id UUID,
    p_tipo_documento TEXT
) RETURNS TEXT AS $$
DECLARE
    v_prefixo TEXT;
    v_ano TEXT;
    v_contador INTEGER;
BEGIN
    v_ano := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    v_prefixo := CASE p_tipo_documento
        WHEN 'cotacao' THEN 'COT'
        WHEN 'fatura' THEN 'FTR'
        WHEN 'recibo' THEN 'REC'
        ELSE 'DOC'
    END;

    INSERT INTO sequencias_documentos (user_id, tipo, prefixo, contador, atualizado_em)
    VALUES (p_user_id, p_tipo_documento, v_prefixo, 1, NOW())
    ON CONFLICT (user_id, tipo) DO UPDATE
        SET contador = sequencias_documentos.contador + 1,
            atualizado_em = NOW()
    RETURNING contador INTO v_contador;

    RETURN v_prefixo || '/' || v_ano || '/' || LPAD(v_contador::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Non-reserving preview, kept for the "next number" UI hint endpoint
-- (GET /api/document/next-number). Best-effort only: does not lock or
-- increment, so the real number assigned at creation time may differ if
-- another document is created concurrently -- that's fine for a display hint,
-- but must never be treated as the authoritative number.
CREATE OR REPLACE FUNCTION previsualizar_proximo_numero_documento(
    p_user_id UUID,
    p_tipo_documento TEXT
) RETURNS TEXT AS $$
DECLARE
    v_prefixo TEXT;
    v_ano TEXT;
    v_contador INTEGER;
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

    RETURN v_prefixo || '/' || v_ano || '/' || LPAD(v_contador::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- criar_documento_completo(): use the atomic reservation instead of the racy
-- COUNT(*)-based gerar_numero_documento(). The duplicate check remains as
-- defense-in-depth for the case where a caller supplies an explicit
-- p_dados_especificos->>'numero' instead of letting the DB assign one.
CREATE OR REPLACE FUNCTION criar_documento_completo(
    p_user_id UUID,
    p_tipo_documento TEXT,
    p_emitente_id UUID,
    p_destinatario_id UUID,
    p_dados_especificos JSONB DEFAULT '{}',
    p_itens JSONB[] DEFAULT '{}',
    p_html_content TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_documento_id UUID;
    v_numero_documento TEXT;
    v_item JSONB;
    v_item_id UUID;
    v_taxa JSONB;
BEGIN
    -- Validar tipo de documento
    IF p_tipo_documento NOT IN ('cotacao', 'fatura', 'recibo') THEN
        RAISE EXCEPTION 'Tipo de documento inválido: %', p_tipo_documento;
    END IF;

    v_numero_documento := p_dados_especificos->>'numero';

    IF v_numero_documento IS NULL THEN
        -- Reserva atómica: sem condição de corrida (ver C3 no relatório de auditoria)
        v_numero_documento := reservar_numero_documento(p_user_id, p_tipo_documento);
    ELSE
        -- Número explícito fornecido pelo chamador: continuar a validar duplicidade
        PERFORM 1 FROM documentos_base
        WHERE user_id = p_user_id AND numero = v_numero_documento;

        IF FOUND THEN
            RAISE EXCEPTION 'Documento com número % já existe para o usuário', v_numero_documento;
        END IF;
    END IF;

    -- Inserir documento base
    INSERT INTO documentos_base (
        user_id, emitente_id, destinatario_id, numero, status,
        moeda, data_emissao, termos, ordem_compra, logo_url,
        assinatura_base64, html_content, html_generated_at
    ) VALUES (
        p_user_id, p_emitente_id, p_destinatario_id, v_numero_documento,
        COALESCE(p_dados_especificos->>'status', 'rascunho'),
        COALESCE(p_dados_especificos->>'moeda', 'BRL'),
        COALESCE((p_dados_especificos->>'data_emissao')::DATE, CURRENT_DATE),
        p_dados_especificos->>'termos',
        p_dados_especificos->>'ordem_compra',
        p_dados_especificos->>'logo_url',
        p_dados_especificos->>'assinatura_base64',
        p_html_content,
        CASE WHEN p_html_content IS NOT NULL THEN NOW() ELSE NULL END
    ) RETURNING id INTO v_documento_id;

    -- Inserir na tabela específica
    CASE p_tipo_documento
        WHEN 'cotacao' THEN
            INSERT INTO cotacoes (
                id, validez_dias, desconto, tipo_desconto
            ) VALUES (
                v_documento_id,
                COALESCE((p_dados_especificos->>'validez_dias')::INTEGER, 15),
                COALESCE((p_dados_especificos->>'desconto')::NUMERIC, 0),
                COALESCE(p_dados_especificos->>'tipo_desconto', 'fixed')
            );

        WHEN 'fatura' THEN
            INSERT INTO faturas (
                id, data_vencimento, desconto, tipo_desconto,
                documento_referencia, metodo_pagamento
            ) VALUES (
                v_documento_id,
                (p_dados_especificos->>'data_vencimento')::DATE,
                COALESCE((p_dados_especificos->>'desconto')::NUMERIC, 0),
                COALESCE(p_dados_especificos->>'tipo_desconto', 'fixed'),
                p_dados_especificos->>'documento_referencia',
                p_dados_especificos->>'metodo_pagamento'
            );

        WHEN 'recibo' THEN
            INSERT INTO recibos (
                id, tipo_recibo, valor_recebido, forma_pagamento,
                referencia_recebimento, motivo_pagamento, documento_referencia,
                data_recebimento, local_emissao
            ) VALUES (
                v_documento_id,
                p_dados_especificos->>'tipo_recibo',
                (p_dados_especificos->>'valor_recebido')::NUMERIC,
                p_dados_especificos->>'forma_pagamento',
                p_dados_especificos->>'referencia_recebimento',
                p_dados_especificos->>'motivo_pagamento',
                p_dados_especificos->>'documento_referencia',
                COALESCE((p_dados_especificos->>'data_recebimento')::DATE, CURRENT_DATE),
                p_dados_especificos->>'local_emissao'
            );
    END CASE;

    -- Processar itens
    IF p_tipo_documento = 'recibo' AND (p_itens IS NULL OR array_length(p_itens, 1) = 0) THEN
        -- Item sintetizado para recibos sem itens explícitos
        INSERT INTO itens_documento (
            documento_id, id_original, quantidade, descricao, preco_unitario
        ) VALUES (
            v_documento_id, 1, 1,
            COALESCE(p_dados_especificos->>'motivo_pagamento', 'Pagamento recebido'),
            COALESCE((p_dados_especificos->>'valor_recebido')::NUMERIC, 0)
        );
    ELSE
        -- Processar itens fornecidos
        FOREACH v_item IN ARRAY p_itens LOOP
            INSERT INTO itens_documento (
                documento_id, id_original, quantidade, descricao, preco_unitario
            ) VALUES (
                v_documento_id,
                (v_item->>'id_original')::INTEGER,
                (v_item->>'quantidade')::NUMERIC,
                v_item->>'descricao',
                (v_item->>'preco_unitario')::NUMERIC
            ) RETURNING id INTO v_item_id;

            -- Processar taxas do item, se existirem
            IF v_item ? 'taxas' THEN
                FOR v_taxa IN SELECT * FROM jsonb_array_elements(v_item->'taxas') LOOP
                    INSERT INTO taxas_itens (
                        item_id, nome, valor, tipo
                    ) VALUES (
                        v_item_id,
                        v_taxa->>'nome',
                        (v_taxa->>'valor')::NUMERIC,
                        v_taxa->>'tipo'
                    );
                END LOOP;
            END IF;
        END LOOP;
    END IF;

    -- Log do sistema
    INSERT INTO system_logs (
        user_id, level, action, resource_type, resource_id, message
    ) VALUES (
        p_user_id, 'info', 'create_document', p_tipo_documento, v_documento_id,
        'Documento ' || p_tipo_documento || ' criado: ' || v_numero_documento
    );

    RETURN v_documento_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
