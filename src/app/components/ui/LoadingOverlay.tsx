// components/ui/LoadingOverlay.tsx
'use client';
import { useEffect, useState } from 'react';
import LoadingSpinner from '@/app/components/ui/LoadingSpinner';

interface LoadingOverlayProps {
  delay?: number; // Delay in ms before showing the spinner (avoid flash for fast loads)
  fullScreen?: boolean;
}

export default function LoadingOverlay({ delay = 200, fullScreen = true }: LoadingOverlayProps) {
  const [show, setShow] = useState(delay <= 0);

  useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => setShow(true), delay);
      return () => clearTimeout(timer);
    }
  }, [delay]);

  if (!show) return null;

  return (
    <div className={cn(
      'flex items-center justify-center bg-white bg-opacity-80',
      fullScreen ? 'fixed inset-0 z-50' : 'absolute inset-0'
    )}>
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

// Utilitário para combinar classes (pode ser movido para lib/utils.ts)
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}