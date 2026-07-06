// components/layout/MainLayout.tsx
'use client';
import { ReactNode } from 'react';
import Navbar from '@/app/components/layout/sections/Navbar';
import ToastNotification from '@/app/components/ui/ToastNotification';
import 'bootstrap/dist/css/bootstrap.min.css';
import AuthProvider from '@/app/providers/AuthProvider'
import { GlobalErrorBoundary } from '@/app/components/layout/GlobalErrorBoundary';


interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({
  children,
}: MainLayoutProps) {

  return (
    <>
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