// app/hooks/useErrorHandler.ts
import { useCallback, useState } from 'react';

interface ErrorState {
    hasError: boolean;
    message: string;
    code?: string;
    timestamp: Date;
}

interface UseErrorHandlerReturn {
    error: ErrorState | null;
    handleError: (error: unknown, context?: string) => void;
    clearError: () => void;
    wrapAsync: <T>(asyncFn: () => Promise<T>, context?: string) => Promise<T | null>;
}

export const useErrorHandler = (): UseErrorHandlerReturn => {
    const [error, setError] = useState<ErrorState | null>(null);

    const handleError = useCallback((error: unknown, context?: string) => {
        console.error(`💥 Erro no contexto [${context}]:`, error);

        let errorMessage = 'Ocorreu um erro inesperado';
        let errorCode = 'UNKNOWN_ERROR';

        if (error instanceof Error) {
            errorMessage = error.message;
            errorCode = error.name;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else if (error && typeof error === 'object' && 'message' in error) {
            errorMessage = String(error.message);
        }

        // Mapeamento de erros comuns para mensagens amigáveis
        const friendlyMessages: Record<string, string> = {
            'NetworkError': 'Problema de conexão. Verifique sua internet.',
            'Failed to fetch': 'Não foi possível conectar ao servidor.',
            'UNAUTHORIZED': 'Sessão expirada. Faça login novamente.',
            'DOCUMENT_ALREADY_EXISTS': 'Este documento já existe.',
            'VALIDATION_ERROR': 'Dados inválidos. Verifique as informações.',
        };

        const friendlyMessage = friendlyMessages[errorCode] || errorMessage;

        setError({
            hasError: true,
            message: friendlyMessage,
            code: errorCode,
            timestamp: new Date()
        });

        // Enviar para serviço de monitoramento (opcional)
        // trackError(error, context);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const wrapAsync = useCallback(async <T,>(
        asyncFn: () => Promise<T>,
        context?: string
    ): Promise<T | null> => {
        try {
            clearError();
            return await asyncFn();
        } catch (err) {
            handleError(err, context);
            return null;
        }
    }, [handleError, clearError]);

    return {
        error,
        handleError,
        clearError,
        wrapAsync
    };
};