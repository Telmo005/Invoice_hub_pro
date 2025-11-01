// app/hooks/useApiErrorHandler.ts
import { useErrorHandler } from './useErrorHandler';

export const useApiErrorHandler = () => {
    const { handleError, ...rest } = useErrorHandler();

    const handleApiError = useCallback((error: any, operation: string) => {
        if (error?.code === 'NETWORK_ERROR') {
            handleError('Verifique sua conexão com a internet e tente novamente.', operation);
        } else if (error?.status === 401) {
            handleError('Sua sessão expirou. Faça login novamente.', operation);
        } else if (error?.status === 403) {
            handleError('Você não tem permissão para esta ação.', operation);
        } else if (error?.status === 404) {
            handleError('Recurso não encontrado.', operation);
        } else if (error?.status >= 500) {
            handleError('Problema temporário no servidor. Tente novamente em alguns instantes.', operation);
        } else {
            handleError(error, operation);
        }
    }, [handleError]);

    return {
        ...rest,
        handleApiError
    };
};