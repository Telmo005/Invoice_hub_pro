'use client';

import { useCallback, useState } from 'react';
import { useSecurity } from '@/app/hooks/security/useSecurity';

/**
 * Interface para operações seguras de documentos
 */
interface SecureOperation {
  action: string;
  resourceId: string;
  timestamp: Date;
  status: 'pending' | 'success' | 'error';
  userId?: string;
}

/**
 * Hook completo para gestão segura de documentos integrado com Supabase
 */
export const useDocumentManager = () => {
  const {
    sanitizeInput,
    hasPermission,
    getSafeErrorMessage,
    requireAuth,
    getSecureHeaders,
    secureLog,
    isAuthenticated,
    user,
  } = useSecurity();

  const [operations, setOperations] = useState<SecureOperation[]>([]);

  // Registrar operação para auditoria
  const registerOperation = useCallback((action: string, resourceId: string, status: SecureOperation['status']) => {
    const operation: SecureOperation = {
      action,
      resourceId,
      timestamp: new Date(),
      status,
      userId: user?.id,
    };
    
    setOperations(prev => [...prev.slice(-99), operation]); // Manter últimas 100 operações
    
    secureLog('info', `Operação registrada: ${action}`, { 
      resourceId: 'REDACTED', 
      status,
      userId: user?.id,
      operationCount: operations.length + 1
    });
  }, [secureLog, operations.length, user]);

  // Verificar rate limiting
  const checkRateLimit = useCallback((action: string): boolean => {
    const now = Date.now();
    const lastMinuteOperations = operations.filter(
      op => op.timestamp.getTime() > now - 60000 && op.action === action
    );

    const limits: Record<string, number> = {
      'delete': 5,   // Máximo 5 eliminações por minuto
      'create': 10,  // Máximo 10 criações por minuto
      'update': 20,  // Máximo 20 atualizações por minuto
    };

    const limit = limits[action] || 10;
    const isLimited = lastMinuteOperations.length >= limit;

    if (isLimited) {
      secureLog('warn', 'Rate limit excedido', { 
        userId: user?.id,
        action, 
        attempts: lastMinuteOperations.length,
        limit 
      });
    }

    return !isLimited;
  }, [operations, secureLog, user]);

  // Operação segura de eliminação
  const secureDeleteDocument = useCallback(async (documentId: string, documentData?: any) => {
    secureLog('info', 'Iniciando eliminação segura de documento', { 
      documentId: 'REDACTED',
      userId: user?.id 
    });

    try {
      // 1. Verificar autenticação
      if (!requireAuth()) {
        throw new Error('NOT_AUTHENTICATED');
      }

      // 2. Verificar rate limiting
      if (!checkRateLimit('delete')) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      // 3. Validar permissões
      if (!hasPermission('delete', documentData)) {
        secureLog('warn', 'Tentativa de eliminação não autorizada', {
          documentId: 'REDACTED',
          userId: user?.id
        });
        throw new Error('UNAUTHORIZED');
      }

      // 4. Validar estado do documento
      if (documentData?.status !== 'rascunho') {
        secureLog('warn', 'Tentativa de eliminar documento não rascunho', {
          documentId: 'REDACTED',
          status: documentData?.status,
          userId: user?.id
        });
        throw new Error('INVALID_DOCUMENT_STATE');
      }

      registerOperation('delete', documentId, 'pending');

      // 5. Executar eliminação com headers seguros
      const response = await fetch(`/api/document/${documentId}`, {
        method: 'DELETE',
        headers: getSecureHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        secureLog('error', 'Erro na resposta da API de eliminação', {
          userId: user?.id,
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      registerOperation('delete', documentId, 'success');
      secureLog('info', 'Documento eliminado com sucesso', { 
        documentId: 'REDACTED',
        userId: user?.id 
      });

      return { success: true };

    } catch (error) {
      const safeError = getSafeErrorMessage(error);
      registerOperation('delete', documentId, 'error');
      
      secureLog('error', 'Falha na eliminação segura do documento', {
        error: safeError,
        documentId: 'REDACTED',
        userId: user?.id
      });

      return { 
        success: false, 
        error: safeError 
      };
    }
  }, [
    requireAuth, 
    checkRateLimit, 
    hasPermission, 
    registerOperation, 
    getSecureHeaders, 
    getSafeErrorMessage, 
    secureLog,
    user
  ]);

  // Operação segura de busca
  const secureFetchDocuments = useCallback(async (filters: any) => {
    secureLog('info', 'Iniciando busca segura de documentos', { 
      filterCount: Object.keys(filters).length,
      userId: user?.id 
    });

    try {
      // 1. Verificar autenticação
      if (!requireAuth()) {
        throw new Error('NOT_AUTHENTICATED');
      }

      // 2. Sanitizar filtros
      const safeFilters = {
        ...filters,
        search: filters.search ? sanitizeInput(filters.search) : undefined,
        status: filters.status ? sanitizeInput(filters.status) : undefined,
      };

      // 3. Verificar permissões de visualização
      if (!hasPermission('view')) {
        throw new Error('UNAUTHORIZED');
      }

      // 4. Construir query string segura
      const queryParams = new URLSearchParams();
      Object.entries(safeFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });

      const url = `/api/document?${queryParams.toString()}`;
      
      secureLog('info', 'Buscando documentos da API', { 
        url: '/api/document?[FILTERS]',
        filterCount: queryParams.toString().split('&').length,
        userId: user?.id
      });

      // 5. Executar busca com headers seguros
      const response = await fetch(url, {
        method: 'GET',
        headers: getSecureHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        secureLog('error', 'Erro na resposta da API de busca', {
          userId: user?.id,
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      secureLog('info', 'Busca de documentos concluída com sucesso', {
        documentCount: data.documents?.length || 0,
        userId: user?.id
      });

      return data;

    } catch (error) {
      const safeError = getSafeErrorMessage(error);
      
      secureLog('error', 'Falha na busca segura de documentos', {
        error: safeError,
        userId: user?.id
      });

      throw new Error(safeError);
    }
  }, [
    requireAuth, 
    sanitizeInput, 
    hasPermission, 
    getSecureHeaders, 
    getSafeErrorMessage, 
    secureLog,
    user
  ]);

  // Operação segura de criação
  const secureCreateDocument = useCallback(async (documentData: any) => {
    secureLog('info', 'Iniciando criação segura de documento', {
      userId: user?.id 
    });

    try {
      // 1. Verificar autenticação
      if (!requireAuth()) {
        throw new Error('NOT_AUTHENTICATED');
      }

      // 2. Verificar rate limiting
      if (!checkRateLimit('create')) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      // 3. Validar permissões
      if (!hasPermission('create')) {
        throw new Error('UNAUTHORIZED');
      }

      // 4. Sanitizar dados do documento
      const safeDocumentData = {
        ...documentData,
        destinatario: sanitizeInput(documentData.destinatario || ''),
        emitente: sanitizeInput(documentData.emitente || ''),
        numero: sanitizeInput(documentData.numero || ''),
        user_id: user?.id, // Incluir ID do usuário criador
      };

      registerOperation('create', 'new', 'pending');

      // 5. Executar criação com headers seguros
      const response = await fetch('/api/document', {
        method: 'POST',
        headers: getSecureHeaders(),
        body: JSON.stringify(safeDocumentData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        secureLog('error', 'Erro na resposta da API de criação', {
          userId: user?.id,
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const newDocument = await response.json();
      
      registerOperation('create', newDocument.id, 'success');
      secureLog('info', 'Documento criado com sucesso', { 
        documentId: 'REDACTED',
        type: newDocument.tipo,
        userId: user?.id 
      });

      return { success: true, document: newDocument };

    } catch (error) {
      const safeError = getSafeErrorMessage(error);
      registerOperation('create', 'new', 'error');
      
      secureLog('error', 'Falha na criação segura do documento', {
        error: safeError,
        userId: user?.id
      });

      return { 
        success: false, 
        error: safeError 
      };
    }
  }, [
    requireAuth, 
    checkRateLimit, 
    hasPermission, 
    sanitizeInput, 
    registerOperation, 
    getSecureHeaders, 
    getSafeErrorMessage, 
    secureLog,
    user
  ]);

  // Obter estatísticas de usuário
  const getUserStats = useCallback(() => {
    return {
      userId: user?.id,
      userEmail: user?.email,
      userRoles: user?.roles,
      operationCount: operations.length,
      recentOperations: operations.slice(-5),
    };
  }, [user, operations]);

  return {
    // Operações seguras
    secureDeleteDocument,
    secureFetchDocuments,
    secureCreateDocument,
    
    // Estado e utilitários
    operations,
    isAuthenticated,
    user,
    getUserStats,
    
    // Logger para uso externo
    secureLog,
  };
};