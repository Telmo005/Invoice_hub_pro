'use client';

import { useCallback } from 'react';
import { useAuth } from '@/app/hooks/useAuth';

export const useSecurity = () => {
  const { user } = useAuth();

  // Logger seguro
  const secureLog = useCallback((level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const safeData = { ...data };

    // Redact informações sensíveis
    if (safeData.documentId) safeData.documentId = 'REDACTED';
    if (safeData.userId) safeData.userId = 'REDACTED';
    if (safeData.email) safeData.email = 'REDACTED';
    if (safeData.token) safeData.token = 'REDACTED';

    console.log(`[${level.toUpperCase()}] ${timestamp} - ${message}`, safeData);
  }, []);

  // Sanitização básica
  const sanitizeInput = useCallback((input: string): string => {
    if (typeof input !== 'string') return '';
    return input
      .replace(/[<>]/g, '') // Remove tags HTML
      .replace(/javascript:/gi, '') // Remove protocolos JS
      .replace(/on\w+=/gi, '') // Remove event handlers
      .substring(0, 255); // Limita comprimento
  }, []);

  // Verificação de permissões simples
  const hasPermission = useCallback((action: string, resource?: any): boolean => {
    if (!user) {
      secureLog('warn', 'Tentativa de acesso sem utilizador autenticado', { action });
      return false;
    }

    // Extrair roles do user_metadata do Supabase
    const userRoles = user.user_metadata?.roles || ['user'];
    const resourceOwner = resource?.user_id || resource?.owner_id;

    // Admin tem acesso total
    if (userRoles.includes('admin')) {
      return true;
    }

    // Dono do recurso pode editar/eliminar seus próprios recursos
    if (resourceOwner && resourceOwner === user.id) {
      return true;
    }

    // Permissões específicas por ação
    const actionPermissions: Record<string, string[]> = {
      'delete': ['admin', 'manager'],
      'create': ['admin', 'manager', 'user'],
      'view': ['admin', 'manager', 'user'],
      'edit': ['admin', 'manager'],
      'approve': ['admin', 'manager'],
    };

    const allowedRoles = actionPermissions[action] || [];
    const hasAccess = userRoles.some((role: string) => allowedRoles.includes(role));

    if (!hasAccess) {
      secureLog('warn', 'Tentativa de ação não autorizada', {
        userId: user.id,
        action,
        userRoles,
        allowedRoles
      });
    }

    return hasAccess;
  }, [user, secureLog]);

  // Headers seguros para API
  const getSecureHeaders = useCallback((): HeadersInit => {
    return {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    };
  }, []);

  return {
    // Funções principais
    sanitizeInput,
    hasPermission,
    getSecureHeaders,

    // Estado
    isAuthenticated: !!user,
    user: user ? {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || 'Utilizador',
      roles: user.user_metadata?.roles || ['user'],
    } : null,

    // Logger
    secureLog,
  };
};