// app/hooks/documents/useUpdate.ts
import { useCallback } from 'react';
import { useApiClient } from '@/app/api/useApiClient';

interface UpdateDocumentParams {
    numero?: string;
    emitente?: any;
    destinatario?: any;
    itens?: any[];
    dataFatura?: string;
    dataVencimento?: string;
    // ... outros campos atualizáveis
}

interface useUpdate {
    updateDocument: (id: string, params: UpdateDocumentParams) => Promise<any>;
    updating: boolean;
    error: string | null;
    resetError: () => void;
}

export function useUpdate(): useUpdate {
    const { makeRequest, loading: updating, error, resetError } = useApiClient();

    const updateDocument = useCallback(async (
        id: string,
        params: UpdateDocumentParams
    ): Promise<any> => {
        return makeRequest(`/api/document/${id}`, {
            method: 'PUT',
            body: JSON.stringify(params),
        });
    }, [makeRequest]);

    return {
        updateDocument,
        updating,
        error,
        resetError,
    };
}