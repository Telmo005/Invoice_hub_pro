-- Fix C1 (docs/auditoria-inicial.md): no table had Row Level Security.
-- Isolation between users depended entirely on every API route remembering to
-- filter by user_id. This adds a database-level backstop for every route that
-- queries through the authenticated user's session (supabaseServer()).
--
-- Routes that intentionally use the service-role client (supabaseAdmin) --
-- e.g. document/view/[id] and document/pdf/[id], which are public links sent
-- to clients without an Invoice Hub Pro account -- still bypass RLS by design.
-- Those are mitigated separately with rate limiting (see route changes).

BEGIN;

ALTER TABLE documentos_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxas_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE totais_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE emissores ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinatarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequencias_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxas_servico ENABLE ROW LEVEL SECURITY;

-- =============================================
-- documentos_base: direct user_id column
-- =============================================
CREATE POLICY documentos_base_select_own ON documentos_base
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY documentos_base_insert_own ON documentos_base
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY documentos_base_update_own ON documentos_base
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY documentos_base_delete_own ON documentos_base
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- cotacoes / faturas / recibos: PK = documentos_base.id, no own user_id column
-- =============================================
CREATE POLICY cotacoes_select_own ON cotacoes
    FOR SELECT USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = cotacoes.id AND db.user_id = auth.uid()));
CREATE POLICY cotacoes_insert_own ON cotacoes
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = cotacoes.id AND db.user_id = auth.uid()));
CREATE POLICY cotacoes_update_own ON cotacoes
    FOR UPDATE USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = cotacoes.id AND db.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = cotacoes.id AND db.user_id = auth.uid()));
CREATE POLICY cotacoes_delete_own ON cotacoes
    FOR DELETE USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = cotacoes.id AND db.user_id = auth.uid()));

CREATE POLICY faturas_select_own ON faturas
    FOR SELECT USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = faturas.id AND db.user_id = auth.uid()));
CREATE POLICY faturas_insert_own ON faturas
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = faturas.id AND db.user_id = auth.uid()));
CREATE POLICY faturas_update_own ON faturas
    FOR UPDATE USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = faturas.id AND db.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = faturas.id AND db.user_id = auth.uid()));
CREATE POLICY faturas_delete_own ON faturas
    FOR DELETE USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = faturas.id AND db.user_id = auth.uid()));

CREATE POLICY recibos_select_own ON recibos
    FOR SELECT USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = recibos.id AND db.user_id = auth.uid()));
CREATE POLICY recibos_insert_own ON recibos
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = recibos.id AND db.user_id = auth.uid()));
CREATE POLICY recibos_update_own ON recibos
    FOR UPDATE USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = recibos.id AND db.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = recibos.id AND db.user_id = auth.uid()));
CREATE POLICY recibos_delete_own ON recibos
    FOR DELETE USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = recibos.id AND db.user_id = auth.uid()));

-- =============================================
-- itens_documento: documento_id -> documentos_base
-- =============================================
CREATE POLICY itens_documento_select_own ON itens_documento
    FOR SELECT USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = itens_documento.documento_id AND db.user_id = auth.uid()));
CREATE POLICY itens_documento_insert_own ON itens_documento
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = itens_documento.documento_id AND db.user_id = auth.uid()));
CREATE POLICY itens_documento_update_own ON itens_documento
    FOR UPDATE USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = itens_documento.documento_id AND db.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = itens_documento.documento_id AND db.user_id = auth.uid()));
CREATE POLICY itens_documento_delete_own ON itens_documento
    FOR DELETE USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = itens_documento.documento_id AND db.user_id = auth.uid()));

-- =============================================
-- taxas_itens: item_id -> itens_documento -> documento_id -> documentos_base
-- =============================================
CREATE POLICY taxas_itens_select_own ON taxas_itens
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM itens_documento it JOIN documentos_base db ON db.id = it.documento_id
        WHERE it.id = taxas_itens.item_id AND db.user_id = auth.uid()
    ));
CREATE POLICY taxas_itens_insert_own ON taxas_itens
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM itens_documento it JOIN documentos_base db ON db.id = it.documento_id
        WHERE it.id = taxas_itens.item_id AND db.user_id = auth.uid()
    ));
CREATE POLICY taxas_itens_update_own ON taxas_itens
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM itens_documento it JOIN documentos_base db ON db.id = it.documento_id
        WHERE it.id = taxas_itens.item_id AND db.user_id = auth.uid()
    )) WITH CHECK (EXISTS (
        SELECT 1 FROM itens_documento it JOIN documentos_base db ON db.id = it.documento_id
        WHERE it.id = taxas_itens.item_id AND db.user_id = auth.uid()
    ));
CREATE POLICY taxas_itens_delete_own ON taxas_itens
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM itens_documento it JOIN documentos_base db ON db.id = it.documento_id
        WHERE it.id = taxas_itens.item_id AND db.user_id = auth.uid()
    ));

-- =============================================
-- totais_documento: documento_id -> documentos_base (written by triggers, invoker rights)
-- =============================================
CREATE POLICY totais_documento_select_own ON totais_documento
    FOR SELECT USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = totais_documento.documento_id AND db.user_id = auth.uid()));
CREATE POLICY totais_documento_insert_own ON totais_documento
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = totais_documento.documento_id AND db.user_id = auth.uid()));
CREATE POLICY totais_documento_update_own ON totais_documento
    FOR UPDATE USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = totais_documento.documento_id AND db.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = totais_documento.documento_id AND db.user_id = auth.uid()));
CREATE POLICY totais_documento_delete_own ON totais_documento
    FOR DELETE USING (EXISTS (SELECT 1 FROM documentos_base db WHERE db.id = totais_documento.documento_id AND db.user_id = auth.uid()));

-- =============================================
-- emissores / destinatarios / pagamentos: direct user_id column
-- =============================================
CREATE POLICY emissores_select_own ON emissores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY emissores_insert_own ON emissores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY emissores_update_own ON emissores FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY emissores_delete_own ON emissores FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY destinatarios_select_own ON destinatarios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY destinatarios_insert_own ON destinatarios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY destinatarios_update_own ON destinatarios FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY destinatarios_delete_own ON destinatarios FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY pagamentos_select_own ON pagamentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY pagamentos_insert_own ON pagamentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY pagamentos_update_own ON pagamentos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY pagamentos_delete_own ON pagamentos FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- mpesa_transactions: pagamento_id -> pagamentos.user_id
-- =============================================
CREATE POLICY mpesa_transactions_select_own ON mpesa_transactions
    FOR SELECT USING (EXISTS (SELECT 1 FROM pagamentos p WHERE p.id = mpesa_transactions.pagamento_id AND p.user_id = auth.uid()));
CREATE POLICY mpesa_transactions_insert_own ON mpesa_transactions
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM pagamentos p WHERE p.id = mpesa_transactions.pagamento_id AND p.user_id = auth.uid()));
CREATE POLICY mpesa_transactions_update_own ON mpesa_transactions
    FOR UPDATE USING (EXISTS (SELECT 1 FROM pagamentos p WHERE p.id = mpesa_transactions.pagamento_id AND p.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM pagamentos p WHERE p.id = mpesa_transactions.pagamento_id AND p.user_id = auth.uid()));

-- =============================================
-- sequencias_documentos: direct user_id column (numbering counters)
-- =============================================
CREATE POLICY sequencias_documentos_select_own ON sequencias_documentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sequencias_documentos_insert_own ON sequencias_documentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY sequencias_documentos_update_own ON sequencias_documentos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- system_logs: user_id nullable (system-level entries have no owner)
-- =============================================
CREATE POLICY system_logs_select_own ON system_logs
    FOR SELECT USING (user_id IS NOT NULL AND auth.uid() = user_id);
CREATE POLICY system_logs_insert_own_or_anonymous ON system_logs
    FOR INSERT WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- =============================================
-- taxas_servico: shared pricing reference data, readable by any authenticated
-- user, writable only via the service-role client (no INSERT/UPDATE/DELETE policy)
-- =============================================
CREATE POLICY taxas_servico_select_all ON taxas_servico
    FOR SELECT USING (true);

COMMIT;
