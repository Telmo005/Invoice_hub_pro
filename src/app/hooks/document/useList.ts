import { useState, useEffect, useCallback } from 'react';

interface Document {
    id: string;
    numero: string;
    tipo: 'fatura' | 'cotacao';
    status: string;
    emitente: string;
    destinatario: string;
    data_emissao: string;
    data_vencimento: string;
    valor_total: number;
    moeda: string;
    itens_count: number;
    pagamento_status: string | null;
}

interface useListProps {
    tipo?: 'faturas' | 'cotacoes';
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
}

interface DocumentsResponse {
    documents: Document[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    stats: {
        pendingInvoicesCount: number;
        pendingQuotesCount: number;
        totalInvoices: number;
        totalQuotes: number;
    };
}

export function useList({
    tipo,
    status = 'todos',
    search = '',
    page = 1,
    limit = 10
}: useListProps = {}) {
    const [data, setData] = useState<DocumentsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDocuments = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                ...(tipo && { tipo }),
                status,
                search,
                page: page.toString(),
                limit: limit.toString()
            });

            const response = await fetch(`/api/document?${params}`);

            if (!response.ok) {
                throw new Error(`Erro: ${response.status}`);
            }

            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
            console.error('Erro ao buscar documentos:', err);
        } finally {
            setLoading(false);
        }
    }, [tipo, status, search, page, limit]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    const refetch = useCallback(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    // ⭐ NOVA FUNÇÃO: Remover documento localmente após delete
    const removeDocument = useCallback((documentId: string) => {
        setData(prevData => {
            if (!prevData) return prevData;
            
            return {
                ...prevData,
                documents: prevData.documents.filter(doc => doc.id !== documentId),
                pagination: {
                    ...prevData.pagination,
                    total: prevData.pagination.total - 1,
                    totalPages: Math.ceil((prevData.pagination.total - 1) / limit)
                }
            };
        });
    }, [limit]);

    return {
        documents: data?.documents || [],
        pagination: data?.pagination,
        stats: data?.stats,
        loading,
        error,
        refetch,
        removeDocument // ⭐ NOVA FUNÇÃO
    };
}