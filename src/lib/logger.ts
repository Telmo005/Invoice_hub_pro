// lib/logger.ts - VERSÃO UNIVERSAL CORRIGIDA
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
  private logQueue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  private constructor() {}

  public static getInstance(): SystemLogger {
    if (!SystemLogger.instance) {
      SystemLogger.instance = new SystemLogger();
    }
    return SystemLogger.instance;
  }

  private async getRequestContext() {
    try {
      // ✅ CORREÇÃO: Verifica se está em ambiente server
      if (typeof window === 'undefined') {
        const headersList = await headers();
        return {
          ipAddress: headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown',
          userAgent: headersList.get('user-agent') || 'unknown',
          endpoint: headersList.get('next-url') || 'unknown',
          method: headersList.get('x-method') || 'GET'
        };
      } else {
        // Client-side context
        return {
          ipAddress: 'client',
          userAgent: navigator.userAgent || 'unknown',
          endpoint: window.location.pathname || 'unknown',
          method: 'GET'
        };
      }
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
    // 🔥 CRÍTICO: Não espera pelo log, adiciona na fila e retorna imediatamente
    this.addToQueue(logData);
  }

  // ✅ ADICIONA À FILA E RETORNA IMEDIATAMENTE
  private addToQueue(logData: LogData) {
    const logPromise = async () => {
      try {
        // ✅ CORREÇÃO: Importação dinâmica condicional
        let supabase;
        
        if (typeof window === 'undefined') {
          // Server-side
          const { supabaseServer } = await import('./supabase-server');
          supabase = await supabaseServer();
        } else {
          // Client-side
          const { default: supabaseClient } = await import('./supabase-client');
          supabase = supabaseClient();
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        const context = await this.getRequestContext();

        const level = logData.level || this.getDefaultLevel(logData.action);

        // Ignora debug em produção
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
          duration_ms: logData.durationMs,
          created_at: new Date().toISOString()
        };

        // 🔥 INSERÇÃO RÁPIDA - sem await se possível, ou com timeout
        const { error } = await Promise.race([
          supabase.from('system_logs').insert(logEntry),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Log timeout')), 2000) // 2s timeout
          )
        ]);

        if (error) {
          console.error('❌ [LOG ERROR]', error.message);
        }

      } catch (error) {
        // 🔥 SILENCIOSO - não quebra a aplicação
        console.error('💥 [LOG CRITICAL]', error);
      }
    };

    // Adiciona à fila e processa em background
    this.logQueue.push(logPromise);
    this.processQueue();
  }

  // ✅ PROCESSAMENTO EM BACKGROUND (mesmo código anterior)
  private async processQueue() {
    if (this.isProcessing || this.logQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Processa apenas os primeiros 10 logs para não sobrecarregar
      const batch = this.logQueue.splice(0, Math.min(10, this.logQueue.length));
      
      // 🔥 EXECUTA EM PARALELO mas não espera por todos
      Promise.allSettled(batch.map(logFn => logFn()))
        .then(results => {
          const failed = results.filter(r => r.status === 'rejected').length;
          if (failed > 0) {
            console.warn(`⚠️ [LOGS] ${failed} logs falharam silenciosamente`);
          }
        })
        .finally(() => {
          this.isProcessing = false;
          if (this.logQueue.length > 0) {
            setImmediate(() => this.processQueue());
          }
        });

    } catch (error) {
      this.isProcessing = false;
    }
  }

  private getDefaultLevel(action: LogAction): LogLevel {
    const levelMap: Record<LogAction, LogLevel> = {
      'document_create': 'audit', 'document_delete': 'audit',
      'payment_success': 'audit', 'payment_refund': 'audit', 'user_login': 'audit',
      'document_update': 'info', 'document_view': 'info', 'document_export': 'info',
      'document_download': 'info', 'payment_create': 'info', 'user_logout': 'info',
      'user_profile_update': 'info', 'api_call': 'info', 'payment_failed': 'warn',
      'error': 'error', 'system_alert': 'error'
    };
    return levelMap[action] || 'info';
  }

  // ✅ MÉTODOS DE CONVENIÊNCIA OTIMIZADOS (mesmo código anterior)
  async logDocumentCreation(documentType: string, documentId: string, documentData: any) {
    this.addToQueue({
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
    this.addToQueue({
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
    this.addToQueue({
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

export const logger = SystemLogger.getInstance();