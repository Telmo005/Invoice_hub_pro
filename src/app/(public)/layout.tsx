import type { Metadata } from 'next';

// Sem `title` aqui de propósito: o default do root layout já é o título
// final desejado para a home. Definir aqui uma string voltaria a passar
// pelo template do root ("%s | Invoice Hub Pro") e duplicava o sufixo.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: {
    url: '/',
  },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
