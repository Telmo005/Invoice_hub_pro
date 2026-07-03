// src/app/hooks/payment/useSubscription.ts
import { useState, useCallback, useEffect } from 'react';

export type PlanoId = 'mensal' | 'pay_per_documento';
export type SubscriptionStatus = 'ativa' | 'pendente' | 'vencida' | 'cancelada' | null;

export interface SubscriptionData {
  plano: PlanoId;
  status: SubscriptionStatus;
  data_proxima_cobranca: string | null;
  bloqueado_em: string | null;
  precos: {
    mensal: { valor: number; moeda: string; label: string; descricao: string };
    pay_per_documento: { valor: number; moeda: string; label: string; descricao: string };
  };
}

// Fase 4 bloco 4e -- mesmo padrão de cache CSRF que usePayment.ts.
let cachedCsrfToken: string | null = null;
const fetchCsrfToken = async (): Promise<string> => {
  if (cachedCsrfToken) return cachedCsrfToken;
  const res = await fetch('/api/auth/csrf', { method: 'GET', credentials: 'include' });
  const data = await res.json();
  const received = data?.csrfToken || data?.token;
  if (typeof received === 'string' && received.length > 10) {
    cachedCsrfToken = received;
    return cachedCsrfToken;
  }
  throw new Error('Falha ao obter CSRF token');
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 100;

export const useSubscription = () => {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/subscriptions/me', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubscription(data.data);
      }
    } catch {
      setErrorMessage('Erro ao carregar estado da assinatura');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const subscribe = useCallback(async (method: 'mpesa' | 'emola' | 'credit_card') => {
    setIsSubscribing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setCheckoutUrl(null);

    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch('/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        credentials: 'include',
        body: JSON.stringify({ method })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Erro ao iniciar assinatura');
      }

      const { payment_id, checkout_url } = data.data;

      // Tentativa automática -- funciona em muitos navegadores mesmo depois
      // de um await, mas não é garantido. checkoutUrl fica sempre disponível
      // para um botão "Abrir pagamento" (link clicado diretamente, sempre
      // permitido) -- mesmo ajuste feito em usePayment.ts.
      setCheckoutUrl(checkout_url);
      try { window.open(checkout_url, '_blank', 'noopener,noreferrer'); } catch { /* ignore */ }

      setSuccessMessage('Se a aba de pagamento não abriu sozinha, use o botão abaixo. Aguardando confirmação do pagamento...');

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        const statusRes = await fetch(`/api/payments/status/${payment_id}`, { credentials: 'include' });
        const statusData = await statusRes.json();
        if (!statusRes.ok || !statusData.success) continue;

        if (statusData.data.status === 'pago') {
          setSuccessMessage('Assinatura ativada com sucesso!');
          setCheckoutUrl(null);
          await refetch();
          return;
        }
        if (statusData.data.status === 'falhado') {
          setErrorMessage('O pagamento não foi concluído ou foi recusado.');
          setCheckoutUrl(null);
          return;
        }
      }

      setSuccessMessage('O pagamento ainda está a ser processado. Vai receber um email assim que for confirmado.');
    } catch (error) {
      setCheckoutUrl(null);
      setErrorMessage(error instanceof Error ? error.message : 'Erro inesperado ao processar assinatura');
    } finally {
      setIsSubscribing(false);
    }
  }, [refetch]);

  return { subscription, isLoading, isSubscribing, errorMessage, successMessage, checkoutUrl, subscribe, refetch };
};
