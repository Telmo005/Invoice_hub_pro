// app/layout.tsx
import type { Metadata } from 'next'

import '@/styles/globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Inter } from 'next/font/google';
import  AuthProvider  from '@/app/providers/AuthProvider';


export const metadata: Metadata = {
  title: 'Invoice Hub PRO',
  description: 'Sistema profissional de gestão de faturas',
}

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}