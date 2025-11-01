// components/ui/ToastNotification.tsx
'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/app/hooks/useToast';

export default function ToastNotification() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`p-4 rounded-md shadow-lg ${
            toast.type === 'error' 
              ? 'bg-red-100 text-red-800'
              : toast.type === 'success'
              ? 'bg-green-100 text-green-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          <div className="flex justify-between items-center">
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-4 text-lg font-semibold"
            >
              &times;
            </button>
          </div>
          {toast.details && (
            <details className="mt-2 text-sm">
              <summary>Detalhes</summary>
              <p>{toast.details}</p>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}