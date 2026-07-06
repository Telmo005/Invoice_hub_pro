// Miniaturas leves para o seletor de templates (TemplateCard/TemplateSlider).
// Os cards não usam lazy-loading nem virtualização hoje -- todos montam de
// uma vez quando o seletor abre -- então um screenshot real por template
// pesaria a página. Em vez disso, geramos aqui um SVG abstrato inline (data
// URI, ~1-2KB, zero pedidos de rede) que reflete a paleta e o layout de cada
// design (cor de destaque, se tem sidebar, cabeçalho escuro, talão estreito,
// etc.) sem precisar de um render real.

type MockupVariant =
  | 'standard-gold'
  | 'mono-thin'
  | 'editorial'
  | 'diagonal-header'
  | 'gradient-header'
  | 'ledger-frame'
  | 'card-rows'
  | 'dark-header'
  | 'pastel-blocks'
  | 'sidebar'
  | 'thermal'
  | 'wide-receipt';

interface MockupConfig {
  variant: MockupVariant;
  accent: string;
  contrast?: string;
  bg?: string;
  /** Só para variant='thermal': controla o acabamento do talão estreito. */
  thermalStyle?: 'mono' | 'pastel' | 'dense' | 'color';
}

const W = 320;
const H = 240;

function frame(bg: string, inner: string): string {
  return `<rect width="${W}" height="${H}" fill="${bg}"/>${inner}`;
}

function buildInner(config: MockupConfig): string {
  const { variant, accent, contrast = '#ffffff', bg = '#ffffff' } = config;

  switch (variant) {
    case 'standard-gold':
      return frame(bg, `
        <rect x="0" y="0" width="${W}" height="64" fill="${accent}"/>
        <rect x="0" y="64" width="${W}" height="3" fill="#c9a227"/>
        <rect x="20" y="20" width="130" height="11" rx="2" fill="#c9a227"/>
        <rect x="20" y="40" width="80" height="6" rx="2" fill="${contrast}" opacity="0.7"/>
        <rect x="20" y="94" width="${W - 40}" height="8" rx="2" fill="#e2e8f0"/>
        <rect x="20" y="114" width="${W - 90}" height="6" rx="2" fill="#eef2f6"/>
        <rect x="20" y="130" width="${W - 120}" height="6" rx="2" fill="#eef2f6"/>
        <rect x="${W - 110}" y="176" width="90" height="26" rx="2" fill="none" stroke="#c9a227" stroke-width="2"/>
      `);
    case 'mono-thin':
      return frame(bg, `
        <rect x="20" y="24" width="130" height="10" rx="1" fill="#1f2937"/>
        <rect x="20" y="44" width="70" height="1.5" fill="${accent}"/>
        <rect x="20" y="70" width="${W - 40}" height="1" fill="#e5e7eb"/>
        <rect x="20" y="98" width="${W - 60}" height="6" rx="1" fill="#d1d5db"/>
        <rect x="20" y="114" width="${W - 100}" height="6" rx="1" fill="#e5e7eb"/>
        <rect x="20" y="130" width="${W - 130}" height="6" rx="1" fill="#e5e7eb"/>
        <rect x="20" y="180" width="${W - 40}" height="1" fill="${accent}"/>
        <rect x="${W - 100}" y="190" width="80" height="12" rx="1" fill="${accent}"/>
      `);
    case 'editorial':
      return frame(bg, `
        <rect x="60" y="26" width="200" height="12" rx="1" fill="#3f3f46"/>
        <rect x="100" y="46" width="120" height="5" rx="1" fill="#8a8a92" opacity="0.8"/>
        <rect x="20" y="70" width="${W - 40}" height="1" fill="#c9c2b3"/>
        <rect x="20" y="94" width="${W - 60}" height="6" rx="1" fill="#c9c2b3"/>
        <rect x="20" y="112" width="${W - 90}" height="6" rx="1" fill="#d8d2c4"/>
        <rect x="20" y="150" width="8" height="46" fill="${accent}"/>
        <rect x="38" y="156" width="${W - 90}" height="6" rx="1" fill="#8a8a92"/>
        <rect x="38" y="172" width="${W - 130}" height="6" rx="1" fill="#c9c2b3"/>
      `);
    case 'diagonal-header':
      return frame(bg, `
        <polygon points="0,0 ${W},0 ${W},50 0,90" fill="${accent}"/>
        <rect x="20" y="18" width="130" height="11" rx="2" fill="${contrast}"/>
        <rect x="20" y="106" width="${W - 40}" height="8" rx="2" fill="#eee6f5"/>
        <rect x="20" y="126" width="${W - 90}" height="6" rx="2" fill="#f2ecf9"/>
        <rect x="${W - 120}" y="176" width="100" height="30" rx="6" fill="${accent}"/>
        <rect x="${W - 104}" y="187" width="68" height="8" rx="2" fill="${contrast}"/>
      `);
    case 'gradient-header':
      return `
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${accent}"/>
            <stop offset="1" stop-color="${accent}" stop-opacity="0.55"/>
          </linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="#f8fafc"/>
        <rect x="0" y="0" width="${W}" height="72" rx="0" fill="url(#g)"/>
        <rect x="20" y="24" width="130" height="11" rx="3" fill="${contrast}"/>
        <rect x="20" y="96" width="${W - 40}" height="34" rx="8" fill="#ffffff" stroke="#e2e8f0"/>
        <rect x="20" y="142" width="${W - 40}" height="34" rx="8" fill="#ffffff" stroke="#e2e8f0"/>
        <rect x="${W - 110}" y="186" width="90" height="24" rx="8" fill="${accent}"/>
      `;
    case 'ledger-frame':
      return frame(bg, `
        <rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="#333333" stroke-width="3"/>
        <rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="none" stroke="#333333" stroke-width="1"/>
        <rect x="${W / 2 - 55}" y="30" width="110" height="16" rx="1" fill="none" stroke="${accent}" stroke-width="2"/>
        <rect x="${W / 2 - 40}" y="35" width="80" height="6" rx="1" fill="${accent}"/>
        <rect x="30" y="70" width="${W - 60}" height="1" fill="#333333"/>
        <rect x="30" y="90" width="${W - 60}" height="6" rx="1" fill="#5c5c5c"/>
        <rect x="30" y="106" width="${W - 60}" height="1" fill="#33333355"/>
        <rect x="30" y="120" width="${W - 60}" height="6" rx="1" fill="#5c5c5c"/>
        <rect x="30" y="136" width="${W - 60}" height="1" fill="#33333355"/>
        <rect x="${W - 130}" y="182" width="100" height="24" fill="none" stroke="${accent}" stroke-width="2"/>
      `);
    case 'card-rows':
      return frame('#f8fafc', `
        <rect x="20" y="20" width="130" height="11" rx="3" fill="${accent}"/>
        <rect x="20" y="52" width="${W - 40}" height="30" rx="10" fill="#ffffff" stroke="#e5e7eb"/>
        <rect x="20" y="90" width="${W - 40}" height="30" rx="10" fill="#ffffff" stroke="#e5e7eb"/>
        <rect x="20" y="128" width="${W - 40}" height="30" rx="10" fill="#ffffff" stroke="#e5e7eb"/>
        <rect x="32" y="63" width="60" height="8" rx="2" fill="#c7d2fe"/>
        <rect x="32" y="101" width="80" height="8" rx="2" fill="#c7d2fe"/>
        <rect x="32" y="139" width="50" height="8" rx="2" fill="#c7d2fe"/>
        <rect x="${W - 120}" y="176" width="100" height="26" rx="13" fill="${accent}"/>
      `);
    case 'dark-header':
      return frame('#fdfcf8', `
        <rect x="0" y="0" width="${W}" height="70" fill="#111111"/>
        <rect x="20" y="22" width="140" height="12" rx="2" fill="${accent}"/>
        <rect x="20" y="42" width="90" height="6" rx="2" fill="#888888"/>
        <rect x="20" y="96" width="${W - 40}" height="1" fill="${accent}" opacity="0.5"/>
        <rect x="20" y="112" width="${W - 90}" height="6" rx="1" fill="#e5e0d0"/>
        <rect x="20" y="128" width="${W - 120}" height="6" rx="1" fill="#e5e0d0"/>
        <rect x="${W - 116}" y="176" width="96" height="28" rx="2" fill="none" stroke="${accent}" stroke-width="2"/>
      `);
    case 'pastel-blocks':
      return frame(bg, `
        <rect x="20" y="20" width="150" height="34" rx="16" fill="${accent}" opacity="0.18"/>
        <rect x="34" y="30" width="100" height="10" rx="3" fill="${accent}"/>
        <rect x="20" y="72" width="${W - 40}" height="30" rx="14" fill="${accent}" opacity="0.14"/>
        <rect x="20" y="112" width="${W - 40}" height="30" rx="14" fill="${accent}" opacity="0.10"/>
        <rect x="${W - 120}" y="176" width="100" height="26" rx="13" fill="${accent}"/>
      `);
    case 'sidebar':
      return `
        <rect width="${W}" height="${H}" fill="#ffffff"/>
        <rect x="0" y="0" width="${W * 0.3}" height="${H}" fill="${accent}"/>
        <rect x="20" y="26" width="${W * 0.3 - 40}" height="10" rx="2" fill="${contrast}" opacity="0.95"/>
        <rect x="20" y="46" width="${W * 0.3 - 55}" height="6" rx="2" fill="${contrast}" opacity="0.6"/>
        <rect x="20" y="60" width="${W * 0.3 - 65}" height="6" rx="2" fill="${contrast}" opacity="0.6"/>
        <rect x="${W * 0.3 + 22}" y="28" width="${W * 0.7 - 44}" height="10" rx="2" fill="#94a3b8"/>
        <rect x="${W * 0.3 + 22}" y="52" width="${W * 0.55}" height="6" rx="2" fill="#cbd5e1"/>
        <rect x="${W * 0.3 + 22}" y="66" width="${W * 0.6}" height="6" rx="2" fill="#cbd5e1"/>
        <rect x="${W * 0.3 + 22}" y="92" width="${W * 0.7 - 44}" height="56" rx="4" fill="#f1f5f9"/>
        <rect x="${W * 0.3 + 22}" y="172" width="86" height="26" rx="4" fill="${accent}"/>
      `;
    case 'thermal': {
      const tx = 108, tw = 104;
      const style = config.thermalStyle || 'mono';
      const headerFill = style === 'mono' || style === 'dense' ? '#e5e7eb' : accent;
      const headerText = style === 'mono' || style === 'dense' ? '#374151' : contrast;
      const dashed = Array.from({ length: 5 }).map((_, i) =>
        `<rect x="${tx + 8}" y="${104 + i * 16}" width="${tw - 16}" height="3" fill="#d1d5db" stroke-dasharray="3,3"/>`
      ).join('');
      return `
        <rect width="${W}" height="${H}" fill="#f1f5f9"/>
        <rect x="${tx}" y="16" width="${tw}" height="${H - 32}" rx="${style === 'pastel' || style === 'color' ? 10 : 2}" fill="#ffffff" stroke="#e2e8f0"/>
        <rect x="${tx}" y="16" width="${tw}" height="30" rx="${style === 'pastel' || style === 'color' ? 10 : 2}" fill="${headerFill}"/>
        <rect x="${tx + 14}" y="27" width="${tw - 28}" height="8" rx="2" fill="${headerText}" opacity="0.9"/>
        ${dashed}
        <rect x="${tx + 8}" y="${H - 46}" width="${tw - 16}" height="10" rx="2" fill="${accent}"/>
      `;
    }
    case 'wide-receipt':
      return frame(bg, `
        <rect x="40" y="20" width="${W - 80}" height="42" rx="4" fill="${accent}"/>
        <rect x="56" y="34" width="120" height="10" rx="2" fill="${contrast}"/>
        <rect x="40" y="78" width="${W - 80}" height="1" fill="#e2e8f0"/>
        <rect x="40" y="96" width="${W - 100}" height="6" rx="1" fill="#cbd5e1"/>
        <rect x="40" y="112" width="${W - 130}" height="6" rx="1" fill="#e2e8f0"/>
        <rect x="40" y="128" width="${W - 150}" height="6" rx="1" fill="#e2e8f0"/>
        <rect x="${W - 140}" y="178" width="100" height="26" rx="4" fill="${accent}"/>
      `);
    default:
      return frame(bg, '');
  }
}

/** Devolve um data URI de SVG (leve, sem pedido de rede) para usar em `imageUrl`. */
export function templateMockup(config: MockupConfig): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${buildInner(config)}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
