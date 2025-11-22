This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Document Management Schema (Updated November 2025)

Recent database refactor unified document creation and simplified quotation expiration logic.

### Key Changes

- Replaced legacy RPC `criar_fatura_completa` with unified function `criar_documento_completo` for all tipos: `cotacao`, `fatura`, `recibo`.
- Table `cotacoes` no longer stores a physical `data_expiracao` column; expiration is now computed using `data_emissao + (validez_dias * INTERVAL '1 day')` via helper function `obter_data_expiracao_cotacao(p_cotacao_id UUID)`.
- Standardized discount fields: each specialized table (`cotacoes`, `faturas`) has `desconto` (NUMERIC) and `tipo_desconto` (`fixed|percent`). Logic enforced in `calcular_totais_documento`.
- Creation flow now requires pre-existing (or on-demand created) `emissores` and `destinatarios` records; API routes auto-create these if not found.
- New base table `documentos_base` holds common fields (numero, user_id, status, moeda, termos, ordem_compra, html_content, data_emissao).
- Totals are materialized/maintained in `totais_documento` via trigger `trigger_calcular_totais`.

### Updated API Routes

| Route | Purpose | Notes |
|-------|---------|-------|
| `POST /api/document/quotation/create` | Cria cotação | Usa `criar_documento_completo` (tipo `cotacao`), envia `validez_dias`, `desconto`, `tipo_desconto`.
| `POST /api/document/invoice/create` | Cria fatura | Migrado para nova função, mapping de desconto e vencimento em `dados_especificos`.
| `POST /api/document/receipt/create` | Cria recibo | Usa nova função; recibos sintetizam item se nenhum enviado.
| `POST /api/document/quotation/find` | Busca cotação | Consulta `documentos_base` + `cotacoes` + `totais_documento`; calcula expiração por RPC.

### Data Mapping Example (Cotação)

```jsonc
{
	"p_user_id": "<uuid>",
	"p_tipo_documento": "cotacao",
	"p_emitente_id": "<emissor_uuid>",
	"p_destinatario_id": "<destinatario_uuid>",
	"p_dados_especificos": {
		"numero": "COT/2025/001",
		"data_emissao": "2025-11-21",
		"moeda": "MT",
		"validez_dias": 15,
		"desconto": 0,
		"tipo_desconto": "fixed",
		"termos": "Pagamento em 15 dias"
	},
	"p_itens": [
		{ "id_original": 1, "quantidade": 2, "descricao": "Peça A", "preco_unitario": 100,
			"taxas": [ { "nome": "IVA", "valor": 17, "tipo": "percent" } ] }
	]
}
```

### Expiração de Cotação

Use RPC: `select obter_data_expiracao_cotacao('<cotacao_uuid>');`
Ou calcule manualmente: `data_emissao + validez_dias`.

### Migration Guidance

1. Remover chamadas antigas a `criar_fatura_completa` (todas as rotas migradas).
2. Ajustar front-end para não esperar coluna `data_expiracao` direta; usar resposta da rota `quotation/find`.
3. Garantir que geração de número delega à função `gerar_numero_documento` se não fornecido.
4. Verificar templates: substituir placeholders antigos por novos (`validez_dias`, `data_expiracao` calculada).

### Removed / Deprecated

- RPC `criar_fatura_completa` (substituída por `criar_documento_completo`).
- Coluna gerada `data_expiracao` em `cotacoes` (usar função de cálculo).
- Dependência direta de emitir/destinatário embutidos no RPC (agora IDs normalizados).

### Next Steps

- Update HTML templates for quotations to show validade e expiração calculada.
- Add brief automated test hitting creation + find endpoints.
- Document error codes returned pelas rotas.

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
