'use client';

import DocumentsOverview from '@/app/components/forms/OverviewForm';
import Navbar from '@/app/components/layout/sections/Navbar';

export default function NovaFaturaPage() {
  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <Navbar />
            <div className="py-3 border-top border-bottom border-2"></div>
      <DocumentsOverview />
    </div>
  );
}