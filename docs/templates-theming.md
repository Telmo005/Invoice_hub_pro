# Contrato de tema dos templates de documento

Todos os templates de fatura/cotação/recibo (`src/app/templates/{invoice,quotation,receipt}/*.html`)
devem seguir este padrão para que a personalização de cor de destaque
(ver Fase 3 em `docs/auditoria-inicial.md`) funcione automaticamente,
sem precisar de código específico por template.

## Porquê

Antes deste contrato, cada template tinha as suas cores fixas espalhadas
por várias regras CSS. Adicionar personalização de cor exigia mapear
manualmente os seletores de cada template um a um — inviável com o número
de templates que este projeto vai ter (planeado chegar a ~20).

## O contrato

1. **Declarar as variáveis com os valores atuais do template como default**,
   logo no início do `<style>`:

   ```css
   :root {
     --accent-color: #2c3e50;    /* a cor "de marca" do template hoje */
     --accent-contrast: #ffffff; /* cor de texto sobre --accent-color */
   }
   ```

2. **Usar `var(--accent-color, <valor original>)` em vez do hex fixo**,
   nas regras que representam a cor de destaque do documento — tipicamente:
   título/nome da empresa, cabeçalho da tabela de itens, total final,
   e as bordas que separam essas secções. Manter sempre o fallback
   igual ao valor que já lá estava:

   ```css
   .meu-template .company-name {
     color: var(--accent-color, #2c3e50) !important;
   }
   .meu-template .items-table th {
     background-color: var(--accent-color, #2c3e50) !important;
     color: var(--accent-contrast, #fff) !important;
   }
   ```

3. **Não aplicar a variável a cores semânticas/decorativas** que não
   representam a marca do emissor — ex: um badge verde de "pago", uma
   caixa de aviso azul fixa, watermarks muito subtis. Essas ficam com o
   hex fixo, tal como antes.

4. Se o template não tiver nenhuma cor de destaque óbvia (design neutro/
   monocromático), aplicar a variável só ao título é aceitável — não é
   obrigatório inventar cor onde o design original não tinha nenhuma.

## Como a personalização funciona

`src/lib/document/applyAccentColor(html, templateId, color)`
(`src/lib/document/applyAccentColor.ts`) anexa um bloco `<style>` ao HTML
já renderizado, sobrepondo `--accent-color`/`--accent-contrast` em `:root`.
Como a variável é declarada de novo *depois* da declaração original no
mesmo documento, a cascata CSS garante que o valor novo vence — sem
precisar de conhecer os seletores de cada template.

Para **adicionar um template novo a este sistema**: só é preciso seguir o
contrato acima (passos 1-2) e adicionar o `id` do template (o mesmo usado
em `templateService.ts`) à lista `SUPPORTED_TEMPLATE_IDS` em
`applyAccentColor.ts`. Não é preciso escrever seletores novos nessa função.

## Exceção legada: `receipt-2`

`template-receipt-2.html` já tinha o seu próprio sistema de variáveis
antes deste contrato existir, com `--primary-color` (não `--accent-color`)
a controlar o título/total. Em vez de reescrever o template, a exceção
está isolada em `LEGACY_EXTRA_VARS` dentro de `applyAccentColor.ts`, que
sobrepõe as duas variáveis. Templates novos não devem replicar este
padrão — usem sempre `--accent-color` diretamente.
