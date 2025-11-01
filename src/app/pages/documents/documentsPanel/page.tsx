'use client';

import DocumentsPanel from '@/app/components/documents/DocumentsPanel';
import Navbar from '@/app/components/sections/Navbar';

export default function NovaFaturaPage() {
  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <Navbar />
            <div className="py-3 border-top border-bottom border-2"></div>
      <DocumentsPanel />
    </div>
  );
}