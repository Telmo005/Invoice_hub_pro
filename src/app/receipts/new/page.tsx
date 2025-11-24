"use client";
import Navbar from '@/app/components/layout/sections/Navbar';
import NewInvoice from '@/app/components/forms/newDocumentWizzardForm';

export default function NewReceiptPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="py-3 border-y border-gray-200"></div>
      <NewInvoice tipo="recibo" />
    </div>
  );
}