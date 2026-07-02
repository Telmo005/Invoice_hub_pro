const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

// Fase 3 (docs/auditoria-inicial.md): personalização de cor de destaque
// (título, cabeçalho da tabela, bordas) para alinhar o documento à marca do
// emissor. Só o "template-1" (fatura e cotação partilham a mesma estrutura
// CSS, classe .t1-isolated) é suportado para já -- os outros 6 templates têm
// estruturas/cores diferentes e precisam de ser mapeados individualmente
// antes de serem adicionados aqui.
const SUPPORTED_TEMPLATE_IDS = new Set(['template-1']);

function buildAccentStyleBlock(color: string): string {
  return `
<style>
.t1-isolated .company-name,
.t1-isolated .invoice-title,
.t1-isolated .section-title,
.t1-isolated .grand-total,
.t1-isolated aside h1 {
  color: ${color} !important;
}
.t1-isolated .invoice-header,
.t1-isolated .grand-total {
  border-color: ${color} !important;
}
.t1-isolated .items-table th {
  background-color: ${color} !important;
}
</style>`;
}

/**
 * Aplica uma cor de destaque personalizada ao HTML já renderizado de um
 * documento, anexando um bloco <style> que sobrepõe as regras do template
 * (mesma especificidade + !important, mas posição posterior no HTML vence).
 * Devolve o HTML original sem alterações se o template não for suportado ou
 * a cor não for um hex válido (#RRGGBB) -- nunca interpola um valor não
 * validado no HTML.
 */
export function applyAccentColor(html: string, templateId: string, color?: string | null): string {
  if (!html || !color) return html;
  if (!SUPPORTED_TEMPLATE_IDS.has(templateId)) return html;
  if (!HEX_COLOR_REGEX.test(color)) return html;
  return html + buildAccentStyleBlock(color);
}
