// hooks/useToast.ts
'use client';
import { useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  details?: string;
  timeout?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', options?: { details?: string; timeout?: number }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, message, type, ...options };

      setToasts((prev) => [...prev, newToast]);

      // Auto-dismiss if timeout is provided
      if (options?.timeout) {
        setTimeout(() => {
          removeToast(id);
        }, options.timeout);
      }

      return id;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'info', options?: { details?: string; timeout?: number }) => {
      return addToast(message, type, options);
    },
    [addToast]
  );

  return {
    toasts,
    addToast,
    removeToast,
    toast,
    success: (message: string, options?: { details?: string; timeout?: number }) =>
      addToast(message, 'success', options),
    error: (message: string, options?: { details?: string; timeout?: number }) =>
      addToast(message, 'error', options),
    info: (message: string, options?: { details?: string; timeout?: number }) =>
      addToast(message, 'info', options),
    warning: (message: string, options?: { details?: string; timeout?: number }) =>
      addToast(message, 'warning', options)
  };
}