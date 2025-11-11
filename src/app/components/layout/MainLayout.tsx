// components/layout/MainLayout.tsx
'use client';
import { ReactNode } from 'react';
import Head from 'next/head';
import Navbar from '@/app/components/layout/sections/Navbar';
import ToastNotification from '@/app/components/ui/ToastNotification';
import { useAuth } from '@/app/hooks/useAuth';
import 'bootstrap/dist/css/bootstrap.min.css';
import AuthProvider from '@/app/providers/AuthProvider'
import { GlobalErrorBoundary } from '@/app/components/layout/GlobalErrorBoundary';


interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export default function MainLayout({
  children,
  title = 'Invoice Generator',
  description = 'Generate and manage your invoices online'
}: MainLayoutProps) {

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=2" />
      </Head>

      <Navbar />

      <main>
        <GlobalErrorBoundary>
          <AuthProvider>
            {children}
          </AuthProvider>
        </GlobalErrorBoundary>
      </main>

      <ToastNotification />
    </>
  );
}