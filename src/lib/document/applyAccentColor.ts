const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

// Fase 3 (docs/auditoria-inicial.md): personalização de cor de destaque para
// alinhar o documento à marca do emissor. Contrato documentado em
// docs/templates-theming.md -- todos os templates (existentes e futuros)
// devem definir `--accent-color`/`--accent-contrast` em :root e usar
// var(--accent-color, <cor original>) nas regras de título/tabela/bordas.
// Isto é o que torna a personalização automática para qualquer template novo
// que siga o padrão, sem precisar de mapear seletores um a um aqui.
const SUPPORTED_TEMPLATE_IDS = new Set([
  'template-1',
  'template-2',
  'template-3',
  'receipt-1',
  'receipt-2'
]);

// Exceção legada: template-receipt-2 já existia com um sistema de variáveis
// próprio antes deste contrato, onde `--primary-color` (não `--accent-color`)
// é que controla o título/total. Sobrepor as duas garante que o template
// fica coerente ao personalizar, sem precisar de reescrever o CSS dele.
const LEGACY_EXTRA_VARS: Record<string, (color: string) => string> = {
  'receipt-2': (color) => `--primary-color: ${color};`
};

function buildOverrideStyleBlock(templateId: string, color: string): string {
  const extra = LEGACY_EXTRA_VARS[templateId]?.(color) ?? '';
  return `
<style>
:root {
  --accent-color: ${color};
  --accent-contrast: #ffffff;
  ${extra}
}
</style>`;
}

/**
 * Aplica uma cor de destaque personalizada ao HTML já renderizado de um
 * documento, anexando um bloco <style> que sobrepõe as CSS custom
 * properties do template (ver docs/templates-theming.md). Devolve o HTML
 * original sem alterações se o template não for suportado ou a cor não for
 * um hex válido (#RRGGBB) -- nunca interpola um valor não validado no HTML,
 * já que este resultado flui para o htmlContent guardado e é depois servido
 * tal e qual por document/view e document/pdf.
 */
export function applyAccentColor(html: string, templateId: string, color?: string | null): string {
  if (!html || !color) return html;
  if (!SUPPORTED_TEMPLATE_IDS.has(templateId)) return html;
  if (!HEX_COLOR_REGEX.test(color)) return html;
  return html + buildOverrideStyleBlock(templateId, color);
}
