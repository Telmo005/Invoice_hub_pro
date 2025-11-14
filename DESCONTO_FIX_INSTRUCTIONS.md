# 🔧 CORREÇÃO: Campo Desconto não está sendo registrado

## ❌ PROBLEMA IDENTIFICADO

O campo `desconto` e `tipoDesconto` estão sendo preparados no lado do frontend/API, mas **a função `criar_fatura_completa` no banco de dados NÃO estava extraindo e registrando** esses valores.

### O que estava acontecendo:

1. ✅ Frontend envia: `{ desconto: 100, tipoDesconto: 'fixed', ... }`
2. ✅ API recebe e valida: `formData.desconto` e `formData.tipoDesconto`
3. ✅ API monta o objeto `faturaData` com os campos
4. ✅ API chama: `supabase.rpc('criar_fatura_completa', { p_fatura: faturaData, ... })`
5. ❌ **Função DB NÃO estava extraindo `desconto` do objeto `p_fatura`**
6. ❌ **Função DB NÃO estava passando desconto para INSERT na tabela `faturas`**
7. ❌ **Função DB NÃO estava registrando desconto na tabela `totais_fatura`**

## ✅ SOLUÇÃO

O arquivo `fix_desconto_db.sql` contém a função corrigida que:

1. **Extrai desconto do objeto JSONB:**
   ```plpgsql
   v_desconto := COALESCE((p_fatura->>'desconto')::NUMERIC, 0);
   v_tipo_desconto := COALESCE(p_fatura->>'tipoDesconto', 'fixed');
   ```

2. **Registra na tabela `faturas`:**
   ```plpgsql
   desconto, tipo_desconto,  -- NOVOS CAMPOS
   ```

3. **Calcula e registra na tabela `totais_fatura`:**
   ```plpgsql
   CASE 
       WHEN v_tipo_desconto = 'percent' THEN 
           (COALESCE(SUM(total_item), 0) * v_desconto / 100)
       ELSE 
           v_desconto
   END as desconto_valor,
   ```

## 🚀 COMO APLICAR

### Opção 1: Via Supabase SQL Editor (RECOMENDADO)

1. Acesse seu projeto no Supabase
2. Vá em **SQL Editor** > **New Query**
3. Cole o conteúdo de `fix_desconto_db.sql`
4. Clique em **RUN**
5. Pronto! A função foi atualizada

### Opção 2: Via CLI/Terminal

```bash
# Se tiver psql instalado localmente:
psql -h seu-db-host -U postgres -d postgres < fix_desconto_db.sql
```

## 📋 O que muda na prática

### Antes da correção:
```json
{
  "fatura_id": "123-abc",
  "desconto": null,           ← NÃO ERA REGISTRADO
  "tipo_desconto": null,      ← NÃO ERA REGISTRADO
  "subtotal": 1000,
  "total_final": 1000         ← DESCONTO NÃO APLICADO
}
```

### Depois da correção:
```json
{
  "fatura_id": "123-abc",
  "desconto": 100,            ← AGORA REGISTRADO
  "tipo_desconto": "fixed",   ← AGORA REGISTRADO
  "subtotal": 1000,
  "total_final": 900          ← DESCONTO APLICADO (1000 - 100)
}
```

## ✔️ VERIFICAÇÃO

Para verificar se funcionou, execute esta query no Supabase:

```sql
-- Verificar faturas com desconto registrado
SELECT 
    id,
    numero,
    tipo_documento,
    desconto,
    tipo_desconto,
    (SELECT total_final FROM totais_fatura WHERE fatura_id = faturas.id) as total_final,
    (SELECT desconto FROM totais_fatura WHERE fatura_id = faturas.id) as desconto_registrado,
    created_at
FROM faturas
WHERE desconto > 0
ORDER BY created_at DESC
LIMIT 10;
```

## 📊 Estrutura de Dados Agora Completa

### Tabela `faturas`:
- `desconto` NUMERIC (valor do desconto)
- `tipo_desconto` TEXT (fixed ou percent)

### Tabela `totais_fatura`:
- `desconto` NUMERIC (valor calculado do desconto)
- `total_final` NUMERIC (subtotal + taxas - desconto)

## 🔍 DEBUG

Se houver erros, verifique os logs no terminal/console onde a API foi chamada. A função agora gera mensagens RAISE NOTICE:

```
NOTICE: Desconto recebido: 100, Tipo: fixed
NOTICE: Documento criado: 123-abc..., Tipo: fatura, Desconto: 100, Tipo: fixed
```

---

**Status:** ✅ Pronto para aplicar
