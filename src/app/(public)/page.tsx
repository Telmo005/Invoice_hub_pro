'use client';
import dynamic from 'next/dynamic';
import { useAuth } from '@/app/hooks/useAuth';
import LoadingOverlay from '@/app/components/ui/LoadingOverlay';
import MainLayout from '@/app/components/layout/mainLayout';
import Footer from '@/app/components/layout/sections/Footer';

const HeroSection = dynamic(() => import('@/app/components/layout/sections/HeroSection'), {
  ssr: false,
  loading: () => <div className="min-h-[80vh] bg-gray-100 animate-pulse" />
});

export default function HomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingOverlay />;
  }

  return (
    <MainLayout>
      <HeroSection />
      <Footer />
    </MainLayout>
  );
}