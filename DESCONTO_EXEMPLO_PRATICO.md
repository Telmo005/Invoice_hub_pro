# 🔄 Exemplo Prático: Antes vs Depois

## Cenário de Teste

Você cria uma fatura com os seguintes dados:

```json
{
  "formData": {
    "faturaNumero": "FTR_0001",
    "desconto": 100,
    "tipoDesconto": "fixed",
    "emitente": { /* dados */ },
    "destinatario": { /* dados */ }
  },
  "items": [
    {
      "id": 1,
      "quantidade": 2,
      "descricao": "Produto A",
      "precoUnitario": 500,
      "totalItem": 1000,
      "taxas": []
    }
  ]
}
```

### Cálculo Manual:
- Subtotal: 1000 (2 × 500)
- Taxas: 0
- **Desconto: -100 (tipo: fixed)**
- **Total Final: 900 (1000 - 100)**

---

## ❌ ANTES (Com Bug)

### O que você envia:
```bash
POST /api/document/invoice/create
Content-Type: application/json

{
  "documentData": {
    "formData": {
      "faturaNumero": "FTR_0001",
      "desconto": 100,           ← ENVIADO
      "tipoDesconto": "fixed",   ← ENVIADO
      ...
    },
    "items": [...]
  }
}
```

### Resultado no Banco:

#### Tabela `faturas`:
```
┌─────┬──────────┬──────────┬────────────────┐
│ id  │ numero   │ desconto │ tipo_desconto  │
├─────┼──────────┼──────────┼────────────────┤
│ 123 │ FTR_0001 │ NULL     │ NULL           │  ❌ DESCONTO DESAPARECEU!
└─────┴──────────┴──────────┴────────────────┘
```

#### Tabela `totais_fatura`:
```
┌─────────┬──────────┬────────────┬──────────┬─────────────┐
│ fatura  │ subtotal │ total_taxa │ desconto │ total_final │
├─────────┼──────────┼────────────┼──────────┼─────────────┤
│ 123     │ 1000     │ 0          │ NULL     │ 1000        │  ❌ NÃO SUBTRAIU!
└─────────┴──────────┴────────────┴──────────┴─────────────┘
```

### Problema Visualizado:
```
Esperado:  Total = 1000 - 100 = 900 ✓
Recebido:  Total = 1000          ✗

Perda financeira: 100 por documento! 😞
```

---

## ✅ DEPOIS (Com Correção)

### O que você envia:
```bash
POST /api/document/invoice/create
Content-Type: application/json

{
  "documentData": {
    "formData": {
      "faturaNumero": "FTR_0001",
      "desconto": 100,           ← ENVIADO
      "tipoDesconto": "fixed",   ← ENVIADO
      ...
    },
    "items": [...]
  }
}
```

### Resultado no Banco:

#### Tabela `faturas`:
```
┌─────┬──────────┬──────────┬────────────────┐
│ id  │ numero   │ desconto │ tipo_desconto  │
├─────┼──────────┼──────────┼────────────────┤
│ 123 │ FTR_0001 │ 100      │ fixed          │  ✅ DESCONTO REGISTRADO!
└─────┴──────────┴──────────┴────────────────┘
```

#### Tabela `totais_fatura`:
```
┌─────────┬──────────┬────────────┬──────────┬─────────────┐
│ fatura  │ subtotal │ total_taxa │ desconto │ total_final │
├─────────┼──────────┼────────────┼──────────┼─────────────┤
│ 123     │ 1000     │ 0          │ 100      │ 900         │  ✅ CORRETO!
└─────────┴──────────┴────────────┴──────────┴─────────────┘
```

### Resultado Visualizado:
```
Esperado:  Total = 1000 - 100 = 900 ✓
Recebido:  Total = 900            ✓

Funcionando corretamente! 🎉
```

---

## 📊 Comparação de Fluxos

### ANTES (❌ Bugado)
```
JavaScript/Frontend
    ↓ formData = { desconto: 100, ... }
API Route (route.ts)
    ↓ Recebe e valida: ✓ desconto = 100
    ↓ Monta faturaData: ✓ { desconto: 100, ... }
Supabase RPC Call
    ↓ Envia p_fatura: ✓ { desconto: 100, ... }
criar_fatura_completa Function
    ↓ Recebe p_fatura
    ✗ NÃO EXTRAI desconto (variável não existe!)
    ✗ INSERT faturas SEM desconto
    ✗ INSERT totais_fatura SEM calcular desconto
Resultado: desconto = NULL ❌
```

### DEPOIS (✅ Corrigido)
```
JavaScript/Frontend
    ↓ formData = { desconto: 100, ... }
API Route (route.ts)
    ↓ Recebe e valida: ✓ desconto = 100
    ↓ Monta faturaData: ✓ { desconto: 100, ... }
Supabase RPC Call
    ↓ Envia p_fatura: ✓ { desconto: 100, ... }
criar_fatura_completa Function
    ↓ Recebe p_fatura
    ✓ EXTRAI: v_desconto = 100
    ✓ EXTRAI: v_tipo_desconto = 'fixed'
    ✓ INSERT faturas COM desconto = 100
    ✓ INSERT totais_fatura COM desconto calculado
    ✓ CALCULA: total_final = 1000 - 100 = 900
Resultado: desconto = 100 ✅, total_final = 900 ✅
```

---

## 🧪 Teste Pré vs Pós

### Antes de aplicar a correção:

```bash
# Criar fatura com desconto = 100
curl -X POST http://localhost:3000/api/document/invoice/create \
  -H "Content-Type: application/json" \
  -d '{
    "documentData": {
      "formData": {
        "faturaNumero": "FTR_TEST_001",
        "desconto": 100,
        "tipoDesconto": "fixed",
        ...
      }
    }
  }'

# Verificar no banco:
SELECT id, desconto, (SELECT total_final FROM totais_fatura 
                      WHERE fatura_id = faturas.id) as total
FROM faturas WHERE numero = 'FTR_TEST_001';

# RESULTADO ANTES (❌):
# id    | desconto | total
# ------+----------+-------
# 123   | NULL     | 1000   ← ERRADO! Desconto não foi registrado
```

### Depois de aplicar a correção:

```bash
# Mesmo teste, mesmos dados
curl -X POST http://localhost:3000/api/document/invoice/create \
  -H "Content-Type: application/json" \
  -d '{
    "documentData": {
      "formData": {
        "faturaNumero": "FTR_TEST_002",
        "desconto": 100,
        "tipoDesconto": "fixed",
        ...
      }
    }
  }'

# Verificar no banco:
SELECT id, desconto, (SELECT total_final FROM totais_fatura 
                      WHERE fatura_id = faturas.id) as total
FROM faturas WHERE numero = 'FTR_TEST_002';

# RESULTADO DEPOIS (✅):
# id    | desconto | total
# ------+----------+-------
# 456   | 100      | 900    ← CORRETO! Desconto foi registrado
```

---

## 💡 Casos de Teste

### Caso 1: Desconto Fixo
```
Subtotal: 1000
Desconto: 100 (fixed)
Taxas: 0
Total: 900 ✓
```

### Caso 2: Desconto Percentual
```
Subtotal: 1000
Desconto: 10% (percent)
Taxas: 0
Cálculo: 1000 * (10 / 100) = 100
Total: 900 ✓
```

### Caso 3: Desconto + Taxas
```
Subtotal: 1000
Desconto: 100 (fixed)
Taxas: 50
Cálculo: 1000 + 50 - 100 = 950
Total: 950 ✓
```

### Caso 4: Sem Desconto
```
Subtotal: 1000
Desconto: 0 (fixed)
Taxas: 0
Total: 1000 ✓
```

---

## 📈 Impacto

### Por Fatura:
- **Antes:** Desconto não registrado = Valor incorreto
- **Depois:** Desconto registrado = Valor correto

### Por 100 Faturas:
- **Antes:** 100 × erro = 10.000 MZN perdidos
- **Depois:** 100 × correto = Totalmente correto ✓

---

## ✅ Checklist Pós-Aplicação

- [ ] Apliquei a correção no Supabase
- [ ] Criei uma fatura com desconto_value = 100
- [ ] Verifiquei que `faturas.desconto = 100`
- [ ] Verifiquei que `totais_fatura.total_final = 900`
- [ ] Testei com desconto percentual
- [ ] Testei desconto + taxas juntos
- [ ] Tudo funcionando! 🎉

---

**Diferença em uma palavra:**

| Antes | Depois |
|-------|--------|
| ❌ Desconto desaparece | ✅ Desconto registrado |
| ❌ Total_final = 1000 | ✅ Total_final = 900 |
| ❌ Erro crítico | ✅ Funcionando 100% |
