// app/hooks/document/useFind.ts
import { useState, useCallback } from 'react';
import { useApiClient } from '@/app/api/useApiClient';

interface UseDocumentCheck {
    checkDocumentExists: (numero: string, tipo: 'fatura' | 'cotacao') => Promise<boolean>;
    checkFaturaExists: (numero: string) => Promise<boolean>;
    checkCotacaoExists: (numero: string) => Promise<boolean>;
    checking: boolean;
    error: string | null;
    lastResult: boolean | null;
    resetError: () => void;
}

export function useDocumentCheck(): UseDocumentCheck {
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<boolean | null>(null);
    const { makeRequest } = useApiClient();

    const resetError = useCallback(() => {
        setError(null);
        setLastResult(null);
    }, []);

    const checkDocumentExists = useCallback(async (
        numero: string,
        tipo: 'fatura' | 'cotacao'
    ): Promise<boolean> => {
        setChecking(true);
        setError(null);
        setLastResult(null);

        try {
            const result = await makeRequest<{ exists: boolean }>('/api/document/find', {
                method: 'POST',
                body: JSON.stringify({ numero, tipo }),
            });

            setLastResult(result.exists);
            return result.exists;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao verificar documento';
            setError(message);
            setLastResult(false);
            throw err;
        } finally {
            setChecking(false);
        }
    }, [makeRequest]);

    const checkFaturaExists = useCallback(async (
        numero: string
    ): Promise<boolean> => {
        setChecking(true);
        setError(null);
        setLastResult(null);

        try {
            const result = await makeRequest<{ exists: boolean }>('/api/document/invoice/find', {
                method: 'POST',
                body: JSON.stringify({ numero }),
            });

            setLastResult(result.exists);
            return result.exists;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao verificar fatura';
            setError(message);
            setLastResult(false);
            throw err;
        } finally {
            setChecking(false);
        }
    }, [makeRequest]);

    const checkCotacaoExists = useCallback(async (
        numero: string
    ): Promise<boolean> => {
        setChecking(true);
        setError(null);
        setLastResult(null);

        try {
            const result = await makeRequest<{ exists: boolean }>('/api/document/quotation/find', {
                method: 'POST',
                body: JSON.stringify({ numero }),
            });

            setLastResult(result.exists);
            return result.exists;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao verificar cotação';
            setError(message);
            setLastResult(false);
            throw err;
        } finally {
            setChecking(false);
        }
    }, [makeRequest]);

    return {
        checkDocumentExists,
        checkFaturaExists,
        checkCotacaoExists,
        checking,
        error,
        lastResult,
        resetError,
    };
}