// app/layout.tsx
import type { Metadata } from 'next'

import '@/styles/globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
// Removido import duplicado de bootstrap para evitar carga redundante
import { Inter } from 'next/font/google';
import AuthProvider from '@/app/providers/AuthProvider';


const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://invoice-hub-pro.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Invoice Hub Pro | Faturas, Cotações e Recibos Profissionais',
    template: '%s | Invoice Hub Pro',
  },
  description: 'Crie faturas, cotações e recibos profissionais em minutos, com modelos premium. Feito para pequenas empresas em Moçambique.',
  keywords: ['faturas online', 'gerar fatura', 'cotações', 'recibos', 'software de faturação', 'Moçambique', 'M-Pesa', 'gestão de faturas'],
  robots: { index: true, follow: true },
  verification: {
    google: '7ROyJ_3XX1JASj6c3TEPmRg9hwrewUB_KvgDRAKgsVc',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_MZ',
    siteName: 'Invoice Hub Pro',
    title: 'Invoice Hub Pro | Faturas, Cotações e Recibos Profissionais',
    description: 'Crie faturas, cotações e recibos profissionais em minutos, com modelos premium..',
    url: baseUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Invoice Hub Pro | Faturas, Cotações e Recibos Profissionais',
    description: 'Crie faturas, cotações e recibos profissionais em minutos, com modelos premium.',
  },
}

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body className={inter.className}>
        <AuthProvider>
          <main role="main" className="min-h-screen">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}