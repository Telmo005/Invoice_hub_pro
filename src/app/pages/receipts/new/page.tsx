// pages/receipts/new/page.tsx
'use client';

import NewInvoice from '@/app/components/forms/newDocumentWizzardForm';
import Navbar from '@/app/components/layout/sections/Navbar';

export default function NovaReciboPage() {
  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <Navbar />
      <div className="py-3 border-top border-bottom border-2"></div>
      <NewInvoice tipo="recibo" />
    </div>
  );
}
