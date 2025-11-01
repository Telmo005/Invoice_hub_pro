// app/hooks/document/useDocumentHtml.ts
import { useState, useCallback } from 'react';

interface UseDocumentHtmlReturn {
    documentHtml: string | null;
    isLoading: boolean;
    error: string | null;
    fetchDocumentHtml: (documentId: string) => Promise<void>;
    clearDocumentHtml: () => void;
}

export const useDocumentHtml = (): UseDocumentHtmlReturn => {
    const [documentHtml, setDocumentHtml] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDocumentHtml = useCallback(async (documentId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/document/html?id=${documentId}`);

            if (!response.ok) {
                throw new Error('Não foi possível carregar o documento');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error?.message || 'Erro ao carregar documento');
            }

            setDocumentHtml(data.data.html);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
            setDocumentHtml(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearDocumentHtml = useCallback(() => {
        setDocumentHtml(null);
        setError(null);
    }, []);

    return {
        documentHtml,
        isLoading,
        error,
        fetchDocumentHtml,
        clearDocumentHtml
    };
};