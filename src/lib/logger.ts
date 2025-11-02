// lib/logger.ts - VERSÃO FUNCIONAL
import { headers } from 'next/headers';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'audit';
export type LogAction = 
  | 'document_create' | 'document_update' | 'document_delete' | 'document_view'
  | 'document_export' | 'document_download'
  | 'payment_create' | 'payment_success' | 'payment_failed' | 'payment_refund'
  | 'user_login' | 'user_logout' | 'user_profile_update'
  | 'api_call' | 'error' | 'system_alert';

export interface LogData {
  level?: LogLevel;
  action: LogAction;
  resourceType?: string;
  resourceId?: string;
  message: string;
  details?: any;
  durationMs?: number;
}

export class SystemLogger {
  private static instance: SystemLogger;

  private constructor() {}

  public static getInstance(): SystemLogger {
    if (!SystemLogger.instance) {
      SystemLogger.instance = new SystemLogger();
    }
    return SystemLogger.instance;
  }

  private async getRequestContext() {
    try {
      const headersList = headers();
      return {
        ipAddress: headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown',
        userAgent: headersList.get('user-agent') || 'unknown',
        endpoint: headersList.get('next-url') || 'unknown',
        method: headersList.get('x-method') || 'POST'
      };
    } catch (error) {
      return {
        ipAddress: 'unknown',
        userAgent: 'unknown',
        endpoint: 'unknown',
        method: 'unknown'
      };
    }
  }

  async log(logData: LogData) {
    try {
      console.log('🟡 [LOGGER] Iniciando log:', logData.action, logData.message);
      
      const { supabaseServer } = await import('@/lib/supabase-server');
      const supabase = await supabaseServer();
      
      // DEBUG: Verificar autenticação
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('🔍 [LOGGER] Usuário autenticado:', user?.id, 'Erro:', userError);

      const context = await this.getRequestContext();
      console.log('🌐 [LOGGER] Contexto:', context);

      // Determinar nível
      const level = logData.level || this.getDefaultLevel(logData.action);

      // Em produção, ignora logs de debug
      if (process.env.NODE_ENV === 'production' && level === 'debug') {
        return;
      }

      const logEntry = {
        user_id: user?.id || null,
        level,
        action: logData.action,
        resource_type: logData.resourceType,
        resource_id: logData.resourceId,
        message: logData.message.substring(0, 500),
        details: logData.details || {},
        ip_address: context.ipAddress,
        user_agent: context.userAgent?.substring(0, 200) || 'unknown',
        endpoint: context.endpoint?.substring(0, 100) || 'unknown',
        method: context.method,
        duration_ms: logData.durationMs
      };

      console.log('📝 [LOGGER] Tentando inserir log:', logEntry);

      // INSERÇÃO DIRETA - sem .single() para evitar erro quando não retorna dados
      const { data, error } = await supabase
        .from('system_logs')
        .insert(logEntry);

      if (error) {
        console.error('❌ [LOGGER] ERRO ao inserir log:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        
        // Fallback: log no console
        console.log('📝 [LOG FALLBACK]:', logData);
      } else {
        console.log('✅ [LOGGER] Log inserido com SUCESSO');
      }

    } catch (error) {
      console.error('💥 [LOGGER] Erro crítico no sistema de logging:', error);
      console.log('📝 [LOG FALLBACK]:', logData);
    }
  }

  private getDefaultLevel(action: LogAction): LogLevel {
    const levelMap: Record<LogAction, LogLevel> = {
      'document_create': 'audit',
      'document_delete': 'audit',
      'payment_success': 'audit',
      'payment_refund': 'audit',
      'user_login': 'audit',
      'document_update': 'info',
      'document_view': 'info',
      'document_export': 'info',
      'document_download': 'info',
      'payment_create': 'info',
      'user_logout': 'info',
      'user_profile_update': 'info',
      'api_call': 'info',
      'payment_failed': 'warn',
      'error': 'error',
      'system_alert': 'error'
    };
    return levelMap[action] || 'info';
  }

  // Métodos de conveniência
  async logDocumentCreation(documentType: string, documentId: string, documentData: any) {
    await this.log({
      action: 'document_create',
      resourceType: documentType,
      resourceId: documentId,
      message: `${documentType === 'fatura' ? 'Fatura' : 'Cotação'} criada: ${documentData.numero}`,
      details: {
        numero: documentData.numero,
        total: documentData.totais?.totalFinal,
        itensCount: documentData.items?.length,
        emitente: documentData.emitente?.nomeEmpresa?.substring(0, 50),
        destinatario: documentData.destinatario?.nomeCompleto?.substring(0, 50),
        validez: documentData.validez,
        dataVencimento: documentData.dataVencimento
      }
    });
  }

  async logApiCall(endpoint: string, method: string, durationMs: number, success: boolean, details?: any) {
    await this.log({
      action: 'api_call',
      level: success ? 'info' : 'error',
      message: `${method} ${endpoint} - ${success ? 'Sucesso' : 'Erro'} (${durationMs}ms)`,
      details: {
        endpoint,
        method,
        durationMs,
        success,
        ...details
      },
      durationMs
    });
  }

  async logError(error: Error, context: string, details?: any) {
    await this.log({
      action: 'error',
      level: 'error',
      message: `Erro em ${context}: ${error.message.substring(0, 200)}`,
      details: {
        errorMessage: error.message,
        errorStack: process.env.NODE_ENV === 'development' ? error.stack?.substring(0, 500) : undefined,
        context,
        ...details
      }
    });
  }
}

// Instância global do logger
export const logger = SystemLogger.getInstance();