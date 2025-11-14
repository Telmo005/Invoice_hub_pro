# RESUMO DA CORREÇÃO: Campo Desconto Não Registrado

## 🎯 Raiz do Problema

A função `criar_fatura_completa` está recebendo os dados do desconto, mas **NÃO estava extraindo e usando** esses dados.

## 📊 Comparação: Antes vs Depois

### ANTES (❌ Bugado)

```plpgsql
-- Parâmetro recebe os dados, MAS NÃO EXTRAI desconto
CREATE OR REPLACE FUNCTION criar_fatura_completa(
    p_user_id UUID,
    p_emitente JSONB,
    p_destinatario JSONB,
    p_fatura JSONB,  -- ← Contém desconto, mas não é extraído
    p_itens JSONB[],
    p_tipo_documento TEXT DEFAULT 'fatura'
) RETURNS UUID AS $$
DECLARE
    -- ❌ Faltam estas linhas:
    -- v_desconto NUMERIC;
    -- v_tipo_desconto TEXT;
BEGIN
    -- ❌ Não extrai do p_fatura:
    -- v_desconto := (p_fatura->>'desconto')::NUMERIC;
    -- v_tipo_desconto := p_fatura->>'tipoDesconto';

    -- ❌ INSERT NÃO incluía desconto
    INSERT INTO faturas (
        user_id, emitente_id, destinatario_id, numero, 
        -- ... outros campos ...
        -- FALTA: desconto, tipo_desconto
    ) VALUES (
        p_user_id, v_emitente_id, v_destinatario_id, v_numero_documento,
        -- ... outros valores ...
        -- FALTA: v_desconto, v_tipo_desconto
    ) RETURNING id INTO v_fatura_id;

    -- ❌ INSERT TOTAIS NÃO calculava desconto
    INSERT INTO totais_fatura (fatura_id, subtotal, total_taxas, total_final)
    SELECT 
        v_fatura_id,
        -- ... calcula subtotal e taxas ...
        -- ❌ IGNORA desconto completamente
        SUBTOTAL + TOTAL_TAXAS as total_final  -- ← Deveria ser: SUBTOTAL + TAXAS - DESCONTO
```

### DEPOIS (✅ Corrigido)

```plpgsql
-- FUNÇÃO ATUALIZADA
CREATE OR REPLACE FUNCTION criar_fatura_completa(
    p_user_id UUID,
    p_emitente JSONB,
    p_destinatario JSONB,
    p_fatura JSONB,
    p_itens JSONB[],
    p_tipo_documento TEXT DEFAULT 'fatura'
) RETURNS UUID AS $$
DECLARE
    -- ✅ ADICIONADOS:
    v_desconto NUMERIC;
    v_tipo_desconto TEXT;
BEGIN
    -- ✅ EXTRAI DO JSON:
    v_desconto := COALESCE((p_fatura->>'desconto')::NUMERIC, 0);
    v_tipo_desconto := COALESCE(p_fatura->>'tipoDesconto', 'fixed');
    RAISE NOTICE 'Desconto recebido: %, Tipo: %', v_desconto, v_tipo_desconto;

    -- ✅ INSERT AGORA INCLUI DESCONTO:
    INSERT INTO faturas (
        user_id, emitente_id, destinatario_id, numero, 
        -- ... outros campos ...
        desconto, tipo_desconto  -- ← INCLUSOS!
    ) VALUES (
        p_user_id, v_emitente_id, v_destinatario_id, v_numero_documento,
        -- ... outros valores ...
        v_desconto, v_tipo_desconto  -- ← VALORES REGISTRADOS!
    ) RETURNING id INTO v_fatura_id;

    -- ✅ INSERT TOTAIS CALCULA DESCONTO:
    INSERT INTO totais_fatura (fatura_id, subtotal, total_taxas, desconto, total_final)
    SELECT 
        v_fatura_id,
        COALESCE(SUM(total_item), 0) as subtotal,
        COALESCE(SUM(taxas)) as total_taxas,
        -- ✅ CALCULA CORRETAMENTE:
        CASE 
            WHEN v_tipo_desconto = 'percent' THEN 
                (SUBTOTAL * v_desconto / 100)  -- Se percentual
            ELSE 
                v_desconto  -- Se valor fixo
        END as desconto_valor,
        -- ✅ TOTAL FINAL SUBTRAI DESCONTO:
        SUBTOTAL + TOTAL_TAXAS - desconto_valor as total_final
```

## 🔄 Fluxo de Dados Agora Funcional

```
Frontend/Formulário
    ↓
User input: desconto = 100, tipoDesconto = 'fixed'
    ↓
useNewDocumentWizzardForm Hook
    ↓
formData = { desconto: 100, tipoDesconto: 'fixed', ... }
    ↓
PaymentForm → POST /api/document/invoice/create
    ↓
API Route Handler (route.ts)
    ├─ Recebe: documentData.formData.desconto = 100
    ├─ Valida: desconto >= 0 ✓
    ├─ Monta: faturaData = { desconto: 100, tipoDesconto: 'fixed', ... }
    └─ Chama: supabase.rpc('criar_fatura_completa', { 
         p_fatura: faturaData,  ← Contém desconto!
         ...
      })
    ↓
Database Function (criar_fatura_completa)
    ├─ ✅ EXTRAI: v_desconto = 100
    ├─ ✅ EXTRAI: v_tipo_desconto = 'fixed'
    ├─ ✅ INSERT faturas (desconto, tipo_desconto)
    ├─ ✅ CALCULA desconto_valor = 100 (fixed) ou (subtotal * 100 / 100) = subtotal
    └─ ✅ INSERT totais_fatura (desconto, total_final)
    ↓
Database
    ├─ faturas.desconto = 100 ✓
    ├─ faturas.tipo_desconto = 'fixed' ✓
    ├─ totais_fatura.desconto = 100 ✓
    └─ totais_fatura.total_final = 900 (1000 - 100) ✓
```

## 📝 Mudanças Específicas

### 1. Declarações de Variáveis
```diff
DECLARE
    v_emitente_id UUID;
    v_destinatario_id UUID;
    v_fatura_id UUID;
    v_item JSONB;
    v_existing_emitter_id UUID;
    v_numero_documento TEXT;
    v_data_expiracao DATE;
+   v_desconto NUMERIC;
+   v_tipo_desconto TEXT;
```

### 2. Extração de Dados
```diff
+   -- 1. EXTRAIR DESCONTO E TIPO DESCONTO DO OBJETO p_fatura
+   v_desconto := COALESCE((p_fatura->>'desconto')::NUMERIC, 0);
+   v_tipo_desconto := COALESCE(p_fatura->>'tipoDesconto', 'fixed');
+   
+   RAISE NOTICE 'Desconto recebido: %, Tipo: %', v_desconto, v_tipo_desconto;
```

### 3. INSERT na Tabela Faturas
```diff
INSERT INTO faturas (
    user_id, emitente_id, destinatario_id, numero, tipo_documento,
    data_fatura, data_vencimento, ordem_compra, termos, moeda, 
    metodo_pagamento, logo_url, assinatura_base64, status,
    validez_dias, data_expiracao,
+   desconto, tipo_desconto,
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
+   v_desconto,
+   v_tipo_desconto,
    p_html_content,
    CASE WHEN p_html_content IS NOT NULL THEN NOW() ELSE NULL END
)
```

### 4. INSERT em Totais com Cálculo de Desconto
```diff
INSERT INTO totais_fatura (fatura_id, subtotal, total_taxas, desconto, total_final)
SELECT 
    v_fatura_id,
    COALESCE(SUM(total_item), 0) as subtotal,
    COALESCE(SUM(...)) as total_taxas,
+   CASE 
+       WHEN v_tipo_desconto = 'percent' THEN 
+           (COALESCE(SUM(total_item), 0) * v_desconto / 100)
+       ELSE 
+           v_desconto
+   END as desconto_valor,
    -- TOTAL FINAL COM DESCONTO:
-   SUBTOTAL + TOTAL_TAXAS as total_final
+   (SUBTOTAL + TOTAL_TAXAS) - desconto_valor as total_final
```

## ✅ Testes para Validar

```sql
-- Após aplicar a correção, execute:
SELECT 
    id,
    numero,
    tipo_documento,
    desconto,
    tipo_desconto,
    (SELECT subtotal FROM totais_fatura WHERE fatura_id = faturas.id) as subtotal,
    (SELECT total_taxas FROM totais_fatura WHERE fatura_id = faturas.id) as total_taxas,
    (SELECT desconto FROM totais_fatura WHERE fatura_id = faturas.id) as desconto_calc,
    (SELECT total_final FROM totais_fatura WHERE fatura_id = faturas.id) as total_final
FROM faturas
ORDER BY created_at DESC
LIMIT 5;
```

Resultado esperado: `total_final = subtotal + total_taxas - desconto_calc`

---

**Arquivo de correção:** `fix_desconto_db.sql`
**Status:** Pronto para aplicar ao banco de dados
