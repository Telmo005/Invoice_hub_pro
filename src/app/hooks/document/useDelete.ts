// app/hooks/useDelete.ts
import { useState } from 'react';

// Cache simples em memória para token CSRF (mesmo padrão de useCrudEmissores.ts)
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

export function useDelete() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteDocument = async (documentId: string) => {
    try {
      setIsDeleting(true);
      setError(null);

      console.log('Iniciando delete para documento:', documentId);

      const csrfToken = await fetchCsrfToken();
      const response = await fetch(`/api/document/delete/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
      });

      console.log('Resposta da API:', response.status, response.statusText);

      if (!response.ok) {
        // Tentar ler a resposta como texto primeiro para debug
        const responseText = await response.text();
        console.log('Resposta de erro:', responseText);

        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          throw new Error(`Erro ${response.status}: ${responseText.substring(0, 100)}`);
        }

        // A API devolve error como objeto { code, message }, não string --
        // antes disto, o utilizador via literalmente "[object Object]".
        const message = typeof errorData.error === 'string'
          ? errorData.error
          : errorData.error?.message;
        throw new Error(message || `Erro ${response.status} ao eliminar documento`);
      }

      const result = await response.json();
      console.log('Delete bem sucedido:', result);
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Erro no hook de delete:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deleteDocument,
    isDeleting,
    error,
    clearError: () => setError(null)
  };
}