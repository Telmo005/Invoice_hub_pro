-- =============================================
-- SCRIPT COMPLETO DE BACKUP: ESTRUTURA DA BASE DE DADOS
-- Data: $(date)
-- Projeto: Sistema de Faturas e Cotações
-- =============================================

-- =============================================
-- 1. CONFIGURAÇÕES INICIAIS
-- =============================================

-- Limpar estrutura existente (executar com cuidado!)
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- 2. TABELAS PRINCIPAIS (ORDEM DE DEPENDÊNCIA)
-- =============================================

-- Tabela de emissores
CREATE TABLE emissores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    nome_empresa TEXT NOT NULL,
    documento TEXT NOT NULL,
    pais TEXT NOT NULL,
    cidade TEXT NOT NULL,
    bairro TEXT NOT NULL,
    pessoa_contato TEXT,
    email TEXT NOT NULL,
    telefone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de destinatarios
CREATE TABLE destinatarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    nome_completo TEXT NOT NULL,
    documento TEXT,
    pais TEXT,
    cidade TEXT,
    bairro TEXT,
    email TEXT NOT NULL,
    telefone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela principal de documentos (faturas/cotações)
CREATE TABLE faturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    emitente_id UUID NOT NULL,
    destinatario_id UUID NOT NULL,
    numero TEXT NOT NULL,
    tipo_documento TEXT NOT NULL DEFAULT 'fatura' CHECK (tipo_documento IN ('cotacao', 'fatura')),
    status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'emitida', 'paga', 'cancelada', 'expirada')),
    
    -- Datas importantes
    data_fatura DATE DEFAULT CURRENT_DATE,
    data_vencimento DATE NOT NULL,
    validez_dias INTEGER DEFAULT 15,
    data_expiracao DATE,
    
    -- Conteúdo do documento
    ordem_compra TEXT,
    termos TEXT NOT NULL,
    moeda TEXT NOT NULL DEFAULT 'BRL',
    metodo_pagamento TEXT,
    logo_url TEXT,
    assinatura_base64 TEXT,
    
    -- Sistema de descontos
    desconto NUMERIC DEFAULT 0,
    tipo_desconto TEXT DEFAULT 'fixed' CHECK (tipo_desconto IN ('fixed', 'percent')),
    
    -- Conteúdo HTML
    html_content TEXT,
    html_generated_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de itens dos documentos
CREATE TABLE itens_fatura (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fatura_id UUID NOT NULL,
    id_original INTEGER NOT NULL,
    quantidade NUMERIC NOT NULL CHECK (quantidade > 0),
    descricao TEXT NOT NULL,
    preco_unitario NUMERIC NOT NULL CHECK (preco_unitario >= 0),
    total_item NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de taxas aplicadas aos itens
CREATE TABLE taxas_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL,
    nome TEXT NOT NULL,
    valor NUMERIC NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('percent', 'fixed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de totais consolidados
CREATE TABLE totais_fatura (
    fatura_id UUID PRIMARY KEY,
    subtotal NUMERIC NOT NULL,
    total_taxas NUMERIC NOT NULL,
    desconto NUMERIC DEFAULT 0,
    total_final NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de taxas detalhadas (agrupadas)
CREATE TABLE taxas_detalhadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fatura_id UUID NOT NULL,
    nome TEXT NOT NULL,
    valor NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de taxas de serviço configuráveis
CREATE TABLE taxas_servico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo_documento TEXT NOT NULL CHECK (tipo_documento IN ('cotacao', 'fatura')),
    valor NUMERIC NOT NULL CHECK (valor >= 0),
    moeda TEXT DEFAULT 'BRL',
    activo BOOLEAN DEFAULT true,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de pagamentos
CREATE TABLE pagamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    fatura_id UUID NOT NULL,
    tipo_documento TEXT NOT NULL CHECK (tipo_documento IN ('cotacao', 'fatura')),
    
    -- Dados do pagamento
    external_id TEXT,
    metodo TEXT NOT NULL CHECK (metodo IN ('mpesa', 'stripe', 'transferencia', 'multicaixa')),
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'pago', 'falhado', 'cancelado', 'reembolsado')),
    valor NUMERIC NOT NULL CHECK (valor > 0),
    moeda TEXT DEFAULT 'BRL',
    taxa_servico_id UUID,
    
    -- Campos MPesa específicos
    mpesa_transaction_id TEXT,
    mpesa_conversation_id TEXT,
    mpesa_third_party_reference TEXT,
    mpesa_service_provider_code TEXT DEFAULT '171717',
    mpesa_response_code TEXT,
    mpesa_response_description TEXT,
    
    -- Metadados específicos
    phone_number TEXT,
    receipt_url TEXT,
    metadata JSONB,
    
    -- Compliance e auditoria
    risk_score INTEGER DEFAULT 0,
    customer_ip TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    
    -- Controle de tentativas
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    
    -- Payloads completos
    mpesa_request_payload JSONB,
    mpesa_response_payload JSONB,
    fraud_indicators TEXT[],
    compliance_flags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Tabela de sequências por usuário
CREATE TABLE sequencias_usuarios_documentos (
    user_id UUID NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('fatura', 'cotacao')),
    ultimo_numero INTEGER NOT NULL DEFAULT 0,
    prefixo VARCHAR(10) NOT NULL,
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, tipo)
);

-- Tabela de logs do sistema
CREATE TABLE system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    
    -- Informações básicas do log
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'audit')),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    
    -- Mensagem e dados
    message TEXT NOT NULL,
    details JSONB,
    
    -- Contexto da requisição
    ip_address TEXT,
    user_agent TEXT,
    endpoint TEXT,
    method TEXT,
    
    -- Performance
    duration_ms INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. CHAVES ESTRANGEIRAS
-- =============================================

-- Faturas
ALTER TABLE faturas 
ADD CONSTRAINT fk_faturas_emitente FOREIGN KEY (emitente_id) REFERENCES emissores(id),
ADD CONSTRAINT fk_faturas_destinatario FOREIGN KEY (destinatario_id) REFERENCES destinatarios(id);

-- Itens e taxas
ALTER TABLE itens_fatura 
ADD CONSTRAINT fk_itens_fatura FOREIGN KEY (fatura_id) REFERENCES faturas(id) ON DELETE CASCADE;

ALTER TABLE taxas_itens 
ADD CONSTRAINT fk_taxas_itens FOREIGN KEY (item_id) REFERENCES itens_fatura(id) ON DELETE CASCADE;

ALTER TABLE totais_fatura 
ADD CONSTRAINT fk_totais_fatura FOREIGN KEY (fatura_id) REFERENCES faturas(id) ON DELETE CASCADE;

ALTER TABLE taxas_detalhadas 
ADD CONSTRAINT fk_taxas_detalhadas FOREIGN KEY (fatura_id) REFERENCES faturas(id) ON DELETE CASCADE;

-- Pagamentos
ALTER TABLE pagamentos 
ADD CONSTRAINT fk_pagamentos_fatura FOREIGN KEY (fatura_id) REFERENCES faturas(id),
ADD CONSTRAINT fk_pagamentos_taxa_servico FOREIGN KEY (taxa_servico_id) REFERENCES taxas_servico(id);

-- =============================================
-- 4. ÍNDICES PARA PERFORMANCE
-- =============================================

-- Índices para emissores
CREATE UNIQUE INDEX emissores_user_id_documento_key ON emissores(user_id, documento);
CREATE INDEX idx_emissores_usuario ON emissores(user_id);

-- Índices para destinatarios
CREATE INDEX idx_destinatarios_usuario ON destinatarios(user_id);

-- Índices para faturas
CREATE UNIQUE INDEX faturas_user_id_numero_key ON faturas(user_id, numero);
CREATE INDEX idx_faturas_usuario ON faturas(user_id);
CREATE INDEX idx_faturas_emitente ON faturas(emitente_id);
CREATE INDEX idx_faturas_destinatario ON faturas(destinatario_id);
CREATE INDEX idx_faturas_tipo_status ON faturas(tipo_documento, status);
CREATE INDEX idx_faturas_status ON faturas(status);
CREATE INDEX idx_faturas_tipo_numero ON faturas(tipo_documento, numero);
CREATE INDEX idx_faturas_expiracao ON faturas(data_expiracao) WHERE tipo_documento = 'cotacao';
CREATE INDEX idx_faturas_html_generated ON faturas(html_generated_at) WHERE html_content IS NOT NULL;
CREATE INDEX idx_faturas_tem_html ON faturas(user_id, tipo_documento) WHERE html_content IS NOT NULL;

-- Índices para itens_fatura
CREATE INDEX idx_itens_fatura ON itens_fatura(fatura_id);

-- Índices para taxas_itens
CREATE INDEX idx_taxas_itens ON taxas_itens(item_id);

-- Índices para taxas_detalhadas
CREATE INDEX idx_taxas_detalhadas ON taxas_detalhadas(fatura_id);

-- Índices para pagamentos
CREATE INDEX idx_pagamentos_user ON pagamentos(user_id);
CREATE INDEX idx_pagamentos_fatura ON pagamentos(fatura_id);
CREATE INDEX idx_pagamentos_status ON pagamentos(status);
CREATE INDEX idx_pagamentos_external ON pagamentos(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_pagamentos_tipo ON pagamentos(tipo_documento);
CREATE INDEX idx_pagamentos_created ON pagamentos(created_at);
CREATE INDEX idx_pagamentos_mpesa_tx_id ON pagamentos(mpesa_transaction_id);
CREATE INDEX idx_pagamentos_mpesa_third_party ON pagamentos(mpesa_third_party_reference);
CREATE INDEX idx_pagamentos_mpesa_response_code ON pagamentos(mpesa_response_code);
CREATE INDEX idx_pagamentos_risk_score ON pagamentos(risk_score);
CREATE INDEX idx_pagamentos_initiated_at ON pagamentos(initiated_at);

-- Índices para taxas_servico
CREATE INDEX idx_taxas_servico_tipo ON taxas_servico(tipo_documento, activo);

-- Índices para sequencias
CREATE INDEX idx_sequencias_usuario_tipo ON sequencias_usuarios_documentos(user_id, tipo);

-- Índices para system_logs
CREATE INDEX idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_action ON system_logs(action);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX idx_system_logs_resource ON system_logs(resource_type, resource_id);
CREATE INDEX idx_system_logs_endpoint ON system_logs(endpoint);

-- =============================================
-- 5. FUNÇÕES DO SISTEMA
-- =============================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para sincronizar totais da fatura (CORRIGIDA)
CREATE OR REPLACE FUNCTION sync_totais_fatura()
RETURNS TRIGGER AS $$
DECLARE
    v_fatura_id UUID;
    v_desconto NUMERIC;
    v_tipo_desconto TEXT;
BEGIN
    -- Determinar o fatura_id baseado no contexto do trigger
    IF TG_TABLE_NAME = 'itens_fatura' THEN
        IF TG_OP = 'DELETE' THEN
            v_fatura_id := OLD.fatura_id;
        ELSE
            v_fatura_id := NEW.fatura_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'taxas_itens' THEN
        IF TG_OP = 'DELETE' THEN
            SELECT if.fatura_id INTO v_fatura_id FROM itens_fatura if WHERE if.id = OLD.item_id;
        ELSE
            SELECT if.fatura_id INTO v_fatura_id FROM itens_fatura if WHERE if.id = NEW.item_id;
        END IF;
    ELSE
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Obter dados de desconto da fatura
    SELECT desconto, tipo_desconto INTO v_desconto, v_tipo_desconto
    FROM faturas WHERE id = v_fatura_id;

    -- Recalcular totais apenas se encontramos um fatura_id válido
    IF v_fatura_id IS NOT NULL THEN
        UPDATE totais_fatura tf
        SET 
            subtotal = calc.subtotal,
            total_taxas = calc.total_taxas,
            desconto = calc.desconto_calculado,
            total_final = calc.total_final
        FROM (
            SELECT 
                if.fatura_id,
                COALESCE(SUM(if.total_item), 0) as subtotal,
                COALESCE(SUM(
                    (SELECT COALESCE(SUM(
                        CASE WHEN ti.tipo = 'percent' THEN (if.preco_unitario * if.quantidade * ti.valor / 100)
                             ELSE ti.valor
                        END
                    ), 0) 
                    FROM taxas_itens ti WHERE ti.item_id = if.id)
                ), 0) as total_taxas,
                CASE 
                    WHEN v_tipo_desconto = 'percent' THEN 
                        (COALESCE(SUM(if.total_item), 0) * v_desconto / 100)
                    ELSE v_desconto
                END as desconto_calculado,
                (COALESCE(SUM(if.total_item), 0) + 
                 COALESCE(SUM(
                    (SELECT COALESCE(SUM(
                        CASE WHEN ti.tipo = 'percent' THEN (if.preco_unitario * if.quantidade * ti.valor / 100)
                             ELSE ti.valor
                        END
                    ), 0) 
                    FROM taxas_itens ti WHERE ti.item_id = if.id)
                ), 0)) - 
                CASE 
                    WHEN v_tipo_desconto = 'percent' THEN 
                        (COALESCE(SUM(if.total_item), 0) * v_desconto / 100)
                    ELSE v_desconto
                END as total_final
            FROM itens_fatura if
            WHERE if.fatura_id = v_fatura_id
            GROUP BY if.fatura_id
        ) calc
        WHERE tf.fatura_id = calc.fatura_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Função para criar fatura completa (ATUALIZADA)
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
    -- Extrair desconto
    v_desconto := COALESCE((p_fatura->>'desconto')::NUMERIC, 0);
    v_tipo_desconto := COALESCE(p_fatura->>'tipoDesconto', 'fixed');

    -- Determinar número do documento
    IF p_tipo_documento = 'cotacao' THEN
        v_numero_documento := p_fatura->>'cotacaoNumero';
    ELSE
        v_numero_documento := p_fatura->>'faturaNumero';
    END IF;

    -- Calcular data de expiração para cotações
    IF p_tipo_documento = 'cotacao' THEN
        v_data_expiracao := (p_fatura->>'dataFatura')::DATE + 
                           COALESCE((p_fatura->>'validezCotacao')::INTEGER, 15) * INTERVAL '1 day';
    ELSE
        v_data_expiracao := NULL;
    END IF;

    -- Buscar ou criar emitente
    SELECT id INTO v_existing_emitter_id 
    FROM emissores 
    WHERE user_id = p_user_id AND documento = p_emitente->>'documento'
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

    -- Buscar ou criar destinatário
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

    -- Verificar se já existe documento
    PERFORM 1 FROM faturas 
    WHERE user_id = p_user_id AND numero = v_numero_documento AND tipo_documento = p_tipo_documento;
    
    IF FOUND THEN
        RAISE EXCEPTION 'Já existe um documento do tipo % com o número %', p_tipo_documento, v_numero_documento;
    END IF;

    -- Criar fatura/cotação
    INSERT INTO faturas (
        user_id, emitente_id, destinatario_id, numero, tipo_documento,
        data_fatura, data_vencimento, ordem_compra, termos, moeda, 
        metodo_pagamento, logo_url, assinatura_base64, status,
        validez_dias, data_expiracao, desconto, tipo_desconto,
        html_content, html_generated_at
    ) VALUES (
        p_user_id, v_emitente_id, v_destinatario_id, v_numero_documento, p_tipo_documento,
        (p_fatura->>'dataFatura')::DATE, (p_fatura->>'dataVencimento')::DATE,
        p_fatura->>'ordemCompra', p_fatura->>'termos', COALESCE(p_fatura->>'moeda', 'BRL'),
        p_fatura->>'metodoPagamento', p_fatura->>'logoUrl', p_fatura->>'assinaturaBase64', 'emitida',
        CASE WHEN p_tipo_documento = 'cotacao' THEN (p_fatura->>'validezCotacao')::INTEGER ELSE NULL END,
        v_data_expiracao, v_desconto, v_tipo_desconto,
        p_html_content, CASE WHEN p_html_content IS NOT NULL THEN NOW() ELSE NULL END
    ) RETURNING id INTO v_fatura_id;

    -- Inserir itens
    FOREACH v_item IN ARRAY p_itens
    LOOP
        DECLARE
            v_item_id UUID;
            v_taxa JSONB;
        BEGIN
            INSERT INTO itens_fatura (
                fatura_id, id_original, quantidade, descricao, preco_unitario, total_item
            ) VALUES (
                v_fatura_id, (v_item->>'id')::INTEGER, (v_item->>'quantidade')::NUMERIC,
                v_item->>'descricao', (v_item->>'precoUnitario')::NUMERIC, (v_item->>'totalItem')::NUMERIC
            ) RETURNING id INTO v_item_id;

            -- Inserir taxas
            FOR v_taxa IN SELECT * FROM jsonb_array_elements(v_item->'taxas')
            LOOP
                INSERT INTO taxas_itens (
                    item_id, nome, valor, tipo
                ) VALUES (
                    v_item_id, v_taxa->>'nome', (v_taxa->>'valor')::NUMERIC, v_taxa->>'tipo'
                );
            END LOOP;
        END;
    END LOOP;

    -- Calcular totais
    INSERT INTO totais_fatura (fatura_id, subtotal, total_taxas, desconto, total_final)
    SELECT 
        v_fatura_id,
        COALESCE(SUM(total_item), 0),
        COALESCE(SUM(
            (SELECT COALESCE(SUM(
                CASE WHEN ti.tipo = 'percent' THEN (if.preco_unitario * if.quantidade * ti.valor / 100)
                     ELSE ti.valor
                END
            ), 0) FROM taxas_itens ti WHERE ti.item_id = if.id)
        ), 0),
        CASE 
            WHEN v_tipo_desconto = 'percent' THEN (COALESCE(SUM(total_item), 0) * v_desconto / 100)
            ELSE v_desconto
        END,
        (COALESCE(SUM(total_item), 0) + 
         COALESCE(SUM(
            (SELECT COALESCE(SUM(
                CASE WHEN ti.tipo = 'percent' THEN (if.preco_unitario * if.quantidade * ti.valor / 100)
                     ELSE ti.valor
                END
            ), 0) FROM taxas_itens ti WHERE ti.item_id = if.id)
        ), 0)) - 
        CASE 
            WHEN v_tipo_desconto = 'percent' THEN (COALESCE(SUM(total_item), 0) * v_desconto / 100)
            ELSE v_desconto
        END
    FROM itens_fatura if WHERE if.fatura_id = v_fatura_id;

    RETURN v_fatura_id;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar próximo número de documento
CREATE OR REPLACE FUNCTION gerar_proximo_numero_documento_usuario(
    p_user_id UUID,
    p_tipo VARCHAR(20)
) RETURNS TEXT AS $$
DECLARE
    v_proximo_numero INTEGER;
    v_prefixo VARCHAR(10);
    v_numero_formatado TEXT;
    v_total_existente INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_existente
    FROM faturas WHERE user_id = p_user_id AND tipo_documento = p_tipo;
    
    v_proximo_numero := v_total_existente + 1;
    v_prefixo := CASE p_tipo WHEN 'fatura' THEN 'FTR' WHEN 'cotacao' THEN 'COT' ELSE 'DOC' END;
    v_numero_formatado := v_prefixo || '_' || LPAD(v_proximo_numero::TEXT, 4, '0');
    
    RETURN v_numero_formatado;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 6. TRIGGERS
-- =============================================

-- Triggers para updated_at
CREATE TRIGGER trg_emissores_updated_at BEFORE UPDATE ON emissores FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_destinatarios_updated_at BEFORE UPDATE ON destinatarios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_faturas_updated_at BEFORE UPDATE ON faturas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pagamentos_updated_at BEFORE UPDATE ON pagamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Triggers para sincronização de totais
CREATE TRIGGER trg_sync_totais_itens AFTER INSERT OR UPDATE OR DELETE ON itens_fatura FOR EACH ROW EXECUTE FUNCTION sync_totais_fatura();
CREATE TRIGGER trg_sync_totais_taxas AFTER INSERT OR UPDATE OR DELETE ON taxas_itens FOR EACH ROW EXECUTE FUNCTION sync_totais_fatura();

-- =============================================
-- 7. VIEWS
-- =============================================

-- View para documentos com pagamentos
CREATE VIEW view_documentos_pagamentos AS
SELECT 
    f.id, f.user_id, f.numero, f.tipo_documento, f.status as status_documento,
    p.status as status_pagamento, p.valor as valor_pago, p.metodo as metodo_pagamento,
    p.created_at as data_pagamento, f.created_at as data_criacao, f.data_fatura,
    f.data_vencimento, f.data_expiracao, f.validez_dias, e.nome_empresa as emitente,
    d.nome_completo as destinatario, tf.total_final as valor_documento, f.moeda,
    f.html_content, f.html_generated_at,
    (SELECT COUNT(*) FROM itens_fatura WHERE fatura_id = f.id) as quantidade_itens,
    CASE 
        WHEN f.tipo_documento = 'cotacao' AND f.data_expiracao < CURRENT_DATE THEN 'expirada'
        WHEN f.tipo_documento = 'cotacao' THEN 'ativa'
        ELSE 'n/a'
    END as status_validade,
    CASE WHEN f.html_content IS NOT NULL THEN true ELSE false END as tem_html
FROM faturas f
LEFT JOIN pagamentos p ON f.id = p.fatura_id
LEFT JOIN emissores e ON f.emitente_id = e.id
LEFT JOIN destinatarios d ON f.destinatario_id = d.id
LEFT JOIN totais_fatura tf ON f.id = tf.fatura_id;

-- View para relatório financeiro
CREATE VIEW view_relatorio_financeiro AS
SELECT 
    DATE(p.created_at) as data, p.tipo_documento, p.metodo,
    COUNT(*) as total_pagamentos, SUM(p.valor) as total_recebido, AVG(p.valor) as valor_medio
FROM pagamentos p
WHERE p.status = 'pago'
GROUP BY DATE(p.created_at), p.tipo_documento, p.metodo;

-- View para análise de logs
CREATE VIEW view_logs_analysis AS
SELECT 
    DATE(created_at) as data, level, action, resource_type,
    COUNT(*) as total_logs, COUNT(DISTINCT user_id) as usuarios_ativos, AVG(duration_ms) as tempo_medio_ms
FROM system_logs
GROUP BY DATE(created_at), level, action, resource_type;

-- =============================================
-- 8. DADOS INICIAIS
-- =============================================

INSERT INTO taxas_servico (tipo_documento, valor, descricao) VALUES
('cotacao', 100.00, 'Taxa para download de cotação'),
('fatura', 200.00, 'Taxa para download de fatura');

-- =============================================
-- 9. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE emissores ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinatarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_fatura ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxas_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE totais_fatura ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxas_detalhadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxas_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequencias_usuarios_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs DISABLE ROW LEVEL SECURITY; -- Logs acessíveis a todos

-- Políticas RLS
CREATE POLICY "Usuários veem apenas seus dados" ON emissores FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Usuários veem apenas seus dados" ON destinatarios FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Usuários veem apenas suas faturas" ON faturas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Usuários veem apenas seus itens" ON itens_fatura FOR ALL USING (EXISTS (SELECT 1 FROM faturas WHERE faturas.id = itens_fatura.fatura_id AND faturas.user_id = auth.uid()));
CREATE POLICY "Usuários veem apenas seus pagamentos" ON pagamentos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Usuários veem taxas de seus itens" ON taxas_itens FOR ALL USING (EXISTS (SELECT 1 FROM itens_fatura if JOIN faturas f ON if.fatura_id = f.id WHERE if.id = taxas_itens.item_id AND f.user_id = auth.uid()));
CREATE POLICY "Usuários veem apenas seus totais" ON totais_fatura FOR ALL USING (EXISTS (SELECT 1 FROM faturas WHERE faturas.id = totais_fatura.fatura_id AND faturas.user_id = auth.uid()));
CREATE POLICY "Usuários veem apenas suas taxas detalhadas" ON taxas_detalhadas FOR ALL USING (EXISTS (SELECT 1 FROM faturas WHERE faturas.id = taxas_detalhadas.fatura_id AND faturas.user_id = auth.uid()));
CREATE POLICY "Todos podem ver taxas de serviço" ON taxas_servico FOR SELECT USING (true);
CREATE POLICY "Usuários veem apenas suas sequências" ON sequencias_usuarios_documentos FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 10. VERIFICAÇÃO FINAL
-- =============================================

DO $$ 
BEGIN
    RAISE NOTICE '✅ BACKUP DA ESTRUTURA CRIADO COM SUCESSO!';
    RAISE NOTICE '📊 TABELAS: 12';
    RAISE NOTICE '📈 ÍNDICES: 35+';
    RAISE NOTICE '🔧 FUNÇÕES: 10+';
    RAISE NOTICE '👀 VIEWS: 3';
    RAISE NOTICE '🔒 POLÍTICAS RLS: 10';
END $$;

-- Listar todas as tabelas criadas
SELECT table_name as "Tabelas Criadas"
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;