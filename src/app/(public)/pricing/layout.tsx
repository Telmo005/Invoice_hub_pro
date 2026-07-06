import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Preços e Planos',
  description: 'Planos e preços do Invoice Hub Pro: pague por documento ou assine sem limites. Pagamentos via M-Pesa e PaySuite, em Meticais (MZN).',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Preços e Planos | Invoice Hub Pro',
    description: 'Planos e preços do Invoice Hub Pro: pague por documento ou assine sem limites.',
    url: '/pricing',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
