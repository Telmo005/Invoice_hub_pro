import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Invoice Hub Pro | Faturas, Cotações e Recibos Profissionais';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 55%, #1e293b 100%)',
          padding: '80px',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 36 }}>
          <div style={{ width: 14, height: 14, borderRadius: 999, background: '#fbbf24', marginRight: 14 }} />
          <div style={{ fontSize: 26, letterSpacing: 6, color: '#cbd5e1' }}>DOCUMENTOS PROFISSIONAIS</div>
        </div>
        <div style={{ display: 'flex', fontSize: 80, fontWeight: 700, color: '#fbbf24' }}>
          Invoice Hub Pro
        </div>
        <div style={{ display: 'flex', fontSize: 38, color: '#e2e8f0', marginTop: 24 }}>
          Faturas, Cotações e Recibos Profissionais
        </div>
      </div>
    ),
    { ...size }
  );
}
