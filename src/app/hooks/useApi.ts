// hooks/useApi.ts
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface ApiConfig {
    baseURL?: string;
    timeout?: number;
    retries?: number;
}

interface ApiError {
    message: string;
    status?: number;
    code?: string;
}

interface ApiState<T> {
    data: T | null;
    loading: boolean;
    error: ApiError | null;
}

interface ApiResponse<T> {
    data: T;
    message?: string;
    success: boolean;
}

class ApiError extends Error {
    constructor(
        message: string,
        public status?: number,
        public code?: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export const useApi = (config: ApiConfig = {}) => {
    const { baseURL = '/api', timeout = 30000, retries = 1 } = config;
    const router = useRouter();
    const abortControllers = useRef(new Map<string, AbortController>());

    // Função principal de requisição
    const request = useCallback(async <T>(
        endpoint: string,
        options: RequestInit = {},
        requestId?: string
    ): Promise<T> => {
        const url = endpoint.startsWith('http') ? endpoint : `${baseURL}${endpoint}`;
        const controller = new AbortController();
        const id = requestId || endpoint;

        // Cancelar requisição anterior com mesmo ID
        if (abortControllers.current.has(id)) {
            abortControllers.current.get(id)?.abort();
        }
        abortControllers.current.set(id, controller);

        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // Tratamento de erros HTTP
                if (response.status === 401) {
                    // Redirecionar para login se não autorizado
                    router.push('/login');
                    throw new ApiError('Não autorizado', 401);
                }

                if (response.status === 403) {
                    throw new ApiError('Acesso negado', 403);
                }

                if (response.status === 404) {
                    throw new ApiError('Recurso não encontrado', 404);
                }

                const errorData = await response.json().catch(() => ({}));
                throw new ApiError(
                    errorData.message || 'Erro na requisição',
                    response.status,
                    errorData.code
                );
            }

            const data: ApiResponse<T> = await response.json();

            if (!data.success) {
                throw new ApiError(data.message || 'Operação falhou');
            }

            return data.data;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }

            if (error.name === 'AbortError') {
                throw new ApiError('Requisição cancelada por timeout', 408);
            }

            throw new ApiError('Erro de conexão');
        } finally {
            clearTimeout(timeoutId);
            abortControllers.current.delete(id);
        }
    }, [baseURL, timeout, router]);

    // GET request
    const get = useCallback(<T>(
        endpoint: string,
        requestId?: string
    ): Promise<T> => {
        return request<T>(endpoint, { method: 'GET' }, requestId);
    }, [request]);

    // POST request
    const post = useCallback(<T>(
        endpoint: string,
        data?: any,
        requestId?: string
    ): Promise<T> => {
        return request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        }, requestId);
    }, [request]);

    // PUT request
    const put = useCallback(<T>(
        endpoint: string,
        data?: any,
        requestId?: string
    ): Promise<T> => {
        return request<T>(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        }, requestId);
    }, [request]);

    // DELETE request
    const del = useCallback(<T>(
        endpoint: string,
        requestId?: string
    ): Promise<T> => {
        return request<T>(endpoint, { method: 'DELETE' }, requestId);
    }, [request]);

    // Cancelar requisição específica
    const cancelRequest = useCallback((requestId: string) => {
        if (abortControllers.current.has(requestId)) {
            abortControllers.current.get(requestId)?.abort();
            abortControllers.current.delete(requestId);
        }
    }, []);

    // Cancelar todas as requisições
    const cancelAllRequests = useCallback(() => {
        abortControllers.current.forEach(controller => controller.abort());
        abortControllers.current.clear();
    }, []);

    return {
        request,
        get,
        post,
        put,
        delete: del,
        cancelRequest,
        cancelAllRequests,
    };
};

// Hook para estado de API com cache
export const useApiState = <T>(initialData: T | null = null) => {
    const [state, setState] = useState<ApiState<T>>({
        data: initialData,
        loading: false,
        error: null,
    });

    const setLoading = useCallback((loading: boolean) => {
        setState(prev => ({ ...prev, loading, error: loading ? null : prev.error }));
    }, []);

    const setData = useCallback((data: T | null) => {
        setState({ data, loading: false, error: null });
    }, []);

    const setError = useCallback((error: ApiError | null) => {
        setState(prev => ({ ...prev, error, loading: false }));
    }, []);

    const updateData = useCallback((updater: (current: T | null) => T | null) => {
        setState(prev => ({
            ...prev,
            data: updater(prev.data)
        }));
    }, []);

    return {
        ...state,
        setLoading,
        setData,
        setError,
        updateData,
    };
};