-- CRIAR FUNÇÃO CORRIGIDA QUE RECEBE E REGISTRA DESCONTO
CREATE OR REPLACE FUNCTION criar_fatura_completa(
    p_user_id UUID,
    p_emitente JSONB,
    p_destinatario JSONB,
    p_fatura JSONB,
    p_itens JSONB[],
    p_tipo_documento TEXT DEFAULT 'fatura',
    p_html_content TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_emitente_id UUID;
    v_destinatario_id UUID;
    v_fatura_id UUID;
    v_item JSONB;
    v_existing_emitter_id UUID;
    v_numero_documento TEXT;
    v_data_expiracao DATE;
    v_desconto NUMERIC;
    v_tipo_desconto TEXT;
BEGIN
    -- DEBUG: Log dos dados recebidos
    RAISE NOTICE 'Tipo de documento: %, Dados fatura: %', p_tipo_documento, p_fatura;

    -- 1. EXTRAIR DESCONTO E TIPO DESCONTO DO OBJETO p_fatura
    v_desconto := COALESCE((p_fatura->>'desconto')::NUMERIC, 0);
    v_tipo_desconto := COALESCE(p_fatura->>'tipoDesconto', 'fixed');
    
    RAISE NOTICE 'Desconto recebido: %, Tipo: %', v_desconto, v_tipo_desconto;

    -- 2. DETERMINAR NÚMERO DO DOCUMENTO BASEADO NO TIPO
    IF p_tipo_documento = 'cotacao' THEN
        v_numero_documento := p_fatura->>'cotacaoNumero';
    ELSE
        v_numero_documento := p_fatura->>'faturaNumero';
    END IF;

    RAISE NOTICE 'Número do documento: %', v_numero_documento;

    -- 3. CALCULAR DATA DE EXPIRAÇÃO PARA COTAÇÕES
    IF p_tipo_documento = 'cotacao' THEN
        v_data_expiracao := (p_fatura->>'dataFatura')::DATE + 
                           COALESCE((p_fatura->>'validezCotacao')::INTEGER, 15) * INTERVAL '1 day';
    ELSE
        v_data_expiracao := NULL;
    END IF;

    -- 4. BUSCAR OU CRIAR EMITENTE
    SELECT id INTO v_existing_emitter_id 
    FROM emissores 
    WHERE user_id = p_user_id 
      AND documento = p_emitente->>'documento'
    LIMIT 1;

    IF v_existing_emitter_id IS NOT NULL THEN
        UPDATE emissores SET
            nome_empresa = p_emitente->>'nomeEmpresa',
            pais = p_emitente->>'pais',
            cidade = p_emitente->>'cidade',
            bairro = p_emitente->>'bairro',
            pessoa_contato = p_emitente->>'pessoaContato',
            email = p_emitente->>'email',
            telefone = p_emitente->>'telefone',
            updated_at = NOW()
        WHERE id = v_existing_emitter_id
        RETURNING id INTO v_emitente_id;
    ELSE
        INSERT INTO emissores (
            user_id, nome_empresa, documento, pais, cidade, bairro, 
            pessoa_contato, email, telefone
        ) VALUES (
            p_user_id,
            p_emitente->>'nomeEmpresa',
            p_emitente->>'documento',
            p_emitente->>'pais',
            p_emitente->>'cidade',
            p_emitente->>'bairro',
            p_emitente->>'pessoaContato',
            p_emitente->>'email',
            p_emitente->>'telefone'
        ) RETURNING id INTO v_emitente_id;
    END IF;

    -- 5. BUSCAR OU CRIAR DESTINATÁRIO
    SELECT id INTO v_destinatario_id 
    FROM destinatarios 
    WHERE user_id = p_user_id 
      AND documento = p_destinatario->>'documento'
      AND nome_completo = p_destinatario->>'nomeCompleto'
    LIMIT 1;

    IF v_destinatario_id IS NULL THEN
        INSERT INTO destinatarios (
            user_id, nome_completo, documento, pais, cidade, bairro, email, telefone
        ) VALUES (
            p_user_id,
            p_destinatario->>'nomeCompleto',
            p_destinatario->>'documento',
            p_destinatario->>'pais',
            p_destinatario->>'cidade',
            p_destinatario->>'bairro',
            p_destinatario->>'email',
            p_destinatario->>'telefone'
        ) RETURNING id INTO v_destinatario_id;
    END IF;

    -- 6. VERIFICAR SE JÁ EXISTE DOCUMENTO COM ESTE NÚMERO E TIPO
    PERFORM 1 FROM faturas 
    WHERE user_id = p_user_id 
      AND numero = v_numero_documento
      AND tipo_documento = p_tipo_documento;
    
    IF FOUND THEN
        RAISE EXCEPTION 'Já existe um documento do tipo % com o número %', p_tipo_documento, v_numero_documento;
    END IF;

    -- 7. CRIAR FATURA/COTAÇÃO COM TODOS OS CAMPOS (INCLUINDO DESCONTO E HTML)
    INSERT INTO faturas (
        user_id, emitente_id, destinatario_id, numero, tipo_documento,
        data_fatura, data_vencimento, ordem_compra, termos, moeda, 
        metodo_pagamento, logo_url, assinatura_base64, status,
        validez_dias, data_expiracao,
        desconto, tipo_desconto,
        html_content, html_generated_at
    ) VALUES (
        p_user_id,
        v_emitente_id,
        v_destinatario_id,
        v_numero_documento,
        p_tipo_documento,
        (p_fatura->>'dataFatura')::DATE,
        (p_fatura->>'dataVencimento')::DATE,
        p_fatura->>'ordemCompra',
        p_fatura->>'termos',
        COALESCE(p_fatura->>'moeda', 'BRL'),
        p_fatura->>'metodoPagamento',
        p_fatura->>'logoUrl',
        p_fatura->>'assinaturaBase64',
        'emitida',
        CASE WHEN p_tipo_documento = 'cotacao' THEN (p_fatura->>'validezCotacao')::INTEGER ELSE NULL END,
        v_data_expiracao,
        v_desconto,
        v_tipo_desconto,
        p_html_content,
        CASE WHEN p_html_content IS NOT NULL THEN NOW() ELSE NULL END
    ) RETURNING id INTO v_fatura_id;

    RAISE NOTICE 'Documento criado: % do tipo: %, Desconto: %, Tipo: %', v_fatura_id, p_tipo_documento, v_desconto, v_tipo_desconto;

    -- 8. INSERIR ITENS
    FOREACH v_item IN ARRAY p_itens
    LOOP
        DECLARE
            v_item_id UUID;
            v_taxa JSONB;
        BEGIN
            INSERT INTO itens_fatura (
                fatura_id, id_original, quantidade, descricao, preco_unitario, total_item
            ) VALUES (
                v_fatura_id,
                (v_item->>'id')::INTEGER,
                (v_item->>'quantidade')::NUMERIC,
                v_item->>'descricao',
                (v_item->>'precoUnitario')::NUMERIC,
                (v_item->>'totalItem')::NUMERIC
            ) RETURNING id INTO v_item_id;

            -- INSERIR TAXAS
            FOR v_taxa IN SELECT * FROM jsonb_array_elements(v_item->'taxas')
            LOOP
                INSERT INTO taxas_itens (
                    item_id, nome, valor, tipo
                ) VALUES (
                    v_item_id,
                    v_taxa->>'nome',
                    (v_taxa->>'valor')::NUMERIC,
                    v_taxa->>'tipo'
                );
            END LOOP;
        END;
    END LOOP;

    -- 9. CALCULAR E INSERIR TOTAIS COM DESCONTO
    INSERT INTO totais_fatura (fatura_id, subtotal, total_taxas, desconto, total_final)
    SELECT 
        v_fatura_id,
        COALESCE(SUM(total_item), 0) as subtotal,
        COALESCE(SUM(
            (SELECT COALESCE(SUM(
                CASE WHEN ti.tipo = 'percent' THEN (if.preco_unitario * if.quantidade * ti.valor / 100)
                     ELSE ti.valor
                END
            ), 0) 
            FROM taxas_itens ti 
            WHERE ti.item_id = if.id)
        ), 0) as total_taxas,
        CASE 
            WHEN v_tipo_desconto = 'percent' THEN 
                (COALESCE(SUM(total_item), 0) * v_desconto / 100)
            ELSE 
                v_desconto
        END as desconto_valor,
        (COALESCE(SUM(total_item), 0) + 
         COALESCE(SUM(
            (SELECT COALESCE(SUM(
                CASE WHEN ti.tipo = 'percent' THEN (if.preco_unitario * if.quantidade * ti.valor / 100)
                     ELSE ti.valor
                END
            ), 0) 
            FROM taxas_itens ti 
            WHERE ti.item_id = if.id)
        ), 0)) - 
        CASE 
            WHEN v_tipo_desconto = 'percent' THEN 
                (COALESCE(SUM(total_item), 0) * v_desconto / 100)
            ELSE 
                v_desconto
        END as total_final
    FROM itens_fatura if
    WHERE if.fatura_id = v_fatura_id;

    RAISE NOTICE 'Processo concluído - Documento: %, Tipo: %', v_fatura_id, p_tipo_documento;

    RETURN v_fatura_id;
END;
$$ LANGUAGE plpgsql;

SELECT 'Função criar_fatura_completa atualizada com suporte a desconto!' as status;
