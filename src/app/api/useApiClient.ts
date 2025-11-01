// app/api/useApiClient.ts
import { useState, useCallback } from 'react';

interface ApiClient {
    makeRequest: <T>(url: string, options?: RequestInit) => Promise<T>;
    loading: boolean;
    error: string | null;
    resetError: () => void;
}

export function useApiClient(): ApiClient {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resetError = useCallback(() => setError(null), []);

    const makeRequest = useCallback(async <T>(
        url: string,
        options: RequestInit = {}
    ): Promise<T> => {
        setLoading(true);
        setError(null);

        try {
            const defaultOptions: RequestInit = {
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            };

            const response = await fetch(url, {
                ...defaultOptions,
                ...options,
            });

            // Verificar se a resposta é JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                // Se não for JSON, verificar se a resposta está vazia (status 204, etc.)
                if (response.status === 204) {
                    return {} as T;
                }
                throw new Error('Resposta inválida do servidor');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Erro ${response.status}`);
            }

            return data;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro desconhecido';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        makeRequest,
        loading,
        error,
        resetError,
    };
}