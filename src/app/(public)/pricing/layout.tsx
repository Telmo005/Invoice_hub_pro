import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Preços e Planos',
  description: 'Planos e preços do Invoice Hub Pro: pague por documento ou assine sem limites. Pagamentos via M-Pesa e PaySuite, em Meticais (MZN).',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Preços e Planos | Invoice Hub Pro',
    description: 'Planos e preços do Invoice Hub Pro: pague por documento ou assine sem limites.',
    url: '/pricing',
    // Definir o próprio openGraph aqui substitui por completo o objeto herdado
    // da raiz (não faz merge campo a campo), por isso a imagem gerada por
    // src/app/opengraph-image.tsx tem de ser referenciada outra vez.
    images: ['/opengraph-image'],
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
