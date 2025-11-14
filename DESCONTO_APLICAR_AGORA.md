# 🎯 PROBLEMA & SOLUÇÃO: Campo Desconto Não Registrado

## TL;DR (Resumo Executivo)

**Problema:** Quando você cria uma fatura/cotação com desconto, o valor do desconto não está sendo salvo na base de dados.

**Causa:** A função `criar_fatura_completa` no banco de dados **não estava extraindo** os campos `desconto` e `tipoDesconto` do objeto JSONB recebido.

**Solução:** Arquivo `fix_desconto_db.sql` contém a função corrigida que:
1. Extrai `desconto` e `tipoDesconto` do JSON
2. Registra esses valores na tabela `faturas`
3. Calcula e registra na tabela `totais_fatura`

---

## 📋 Arquivos Criados

### 1. `fix_desconto_db.sql`
- Contém a função SQL corrigida
- Execute no Supabase SQL Editor
- Substitui a função `criar_fatura_completa` anterior

### 2. `DESCONTO_FIX_INSTRUCTIONS.md`
- Instruções passo-a-passo de como aplicar
- Queries de verificação

### 3. `DESCONTO_ANALISE_DETALHADA.md`
- Comparação antes/depois
- Fluxo de dados completo
- Mudanças específicas de código

---

## 🚀 Como Aplicar (3 passos)

### Passo 1: Abrir Supabase SQL Editor
```
1. Acesse https://supabase.com/dashboard
2. Clique no seu projeto
3. Menu esquerdo → SQL Editor
4. Clique em "+ New Query"
```

### Passo 2: Copiar o SQL
- Abra o arquivo `fix_desconto_db.sql` neste projeto
- Copie TODO O CONTEÚDO

### Passo 3: Executar
- Cole no editor do Supabase
- Clique em "RUN" (botão azul)
- Verá a mensagem: "Função criar_fatura_completa atualizada com suporte a desconto!"

---

## ✅ Validação

Após aplicar, execute esta query para confirmar:

```sql
SELECT 
    id,
    numero,
    desconto,
    tipo_desconto,
    (SELECT total_final FROM totais_fatura WHERE fatura_id = faturas.id) as total_com_desconto
FROM faturas
WHERE desconto > 0
LIMIT 5;
```

Você deve ver:
- ✅ `desconto` com valor (ex: 100)
- ✅ `tipo_desconto` com tipo (ex: 'fixed' ou 'percent')
- ✅ `total_com_desconto` refletindo a subtração do desconto

---

## 🔍 O que foi modificado

### Na Função `criar_fatura_completa`:

1. **Adicionadas variáveis:**
   - `v_desconto NUMERIC`
   - `v_tipo_desconto TEXT`

2. **Adicionada extração:**
   ```plpgsql
   v_desconto := COALESCE((p_fatura->>'desconto')::NUMERIC, 0);
   v_tipo_desconto := COALESCE(p_fatura->>'tipoDesconto', 'fixed');
   ```

3. **INSERT em faturas agora inclui:**
   - `desconto, tipo_desconto` nos campos
   - `v_desconto, v_tipo_desconto` nos valores

4. **INSERT em totais_fatura agora:**
   - Calcula desconto aplicável (fixo ou percentual)
   - Subtrai do total_final

---

## 🎬 Próximas Ações (Opcional)

Depois que aplicar a correção:

1. **Testar com um documento novo** 
   - Crie uma fatura com desconto = 100
   - Verifique no banco que o valor foi registrado

2. **Atualizar documentos antigos** (se necessário)
   ```sql
   UPDATE faturas
   SET desconto = 0, tipo_desconto = 'fixed'
   WHERE desconto IS NULL;
   ```

3. **Verificar totais** 
   ```sql
   SELECT * FROM view_documentos_pagamentos 
   WHERE id = 'seu-documento-id';
   ```

---

## ❓ Dúvidas Frequentes

**P: Quanto tempo leva para aplicar?**
R: 2-3 minutos. A query executa em segundos.

**P: Vai afetar documentos já criados?**
R: Não. Apenas novos documentos usarão a função corrigida.

**P: Preciso reiniciar a aplicação?**
R: Não. A mudança é imediata no banco.

**P: E se der erro?**
R: O SQL é idempotente. Pode executar múltiplas vezes sem problema.

---

## 📞 Suporte

Se enfrentar problemas:
1. Verifique se copiou TODO o arquivo `fix_desconto_db.sql`
2. Certifique-se de estar no projeto correto do Supabase
3. Verifique a aba "Logs" do Supabase para erros específicos

---

**Status:** ✅ Pronto para aplicar
**Tempo de aplicação:** ~2-3 minutos
**Impacto:** Correção de bug que impede desconto ser registrado
