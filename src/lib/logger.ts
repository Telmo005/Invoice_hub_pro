import { headers } from 'next/headers';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'audit';
export type LogAction = 
  | 'document_create' | 'document_update' | 'document_delete' | 'document_view' | 'mpesa_payment_processing'
  | 'document_export' | 'document_download' | 'email_sent_success' | 'email_service_error' | 'mpesa_payment_success'
  | 'payment_create' | 'payment_success' | 'payment_failed' | 'payment_refund' | 'document_send' | 'health_check_diagnostic'
  | 'user_login' | 'user_logout' | 'user_profile_update' | 'email_send_attempt' | 'email_validation_error'
  | 'api_call' | 'error' | 'system_alert' | 'mpesa_payment_error' | 'mpesa_health_check' |'health_check';

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
      if (typeof window === 'undefined') {
        const headersList = await headers();
        return {
          ipAddress: headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown',
          userAgent: headersList.get('user-agent') || 'unknown',
          endpoint: headersList.get('next-url') || 'unknown',
          method: headersList.get('x-method') || 'GET'
        };
      } else {
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
    this.addToQueue(logData);
  }

  private addToQueue(logData: LogData) {
    const logPromise = async () => {
      try {
        let supabase;
        
        if (typeof window === 'undefined') {
          const { supabaseServer } = await import('./supabase-server');
          supabase = await supabaseServer();
        } else {
          const { default: supabaseClient } = await import('./supabase-client');
          supabase = supabaseClient();
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        const context = await this.getRequestContext();

        const level = logData.level || this.getDefaultLevel(logData.action);

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

        const insertOperation = supabase.from('system_logs').insert(logEntry);
        
        const result = await Promise.race([
          insertOperation,
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Log timeout')), 2000)
          )
        ]);

        if (result && 'error' in result && result.error) {
          console.error('Log insertion error:', result.error.message);
        }

      } catch (error) {
        if (error instanceof Error && error.message !== 'Log timeout') {
          console.error('Critical log error:', error);
        }
      }
    };

    this.logQueue.push(logPromise);
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing || this.logQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batch = this.logQueue.splice(0, Math.min(10, this.logQueue.length));
      
      Promise.allSettled(batch.map(logFn => logFn()))
        .then(results => {
          const failed = results.filter(r => r.status === 'rejected').length;
          if (failed > 0) {
            console.warn(`${failed} logs failed silently`);
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
      'document_create': 'audit',
      'document_update': 'info',
      'document_delete': 'audit',
      'document_view': 'info',
      'mpesa_payment_processing': 'info',
      'document_export': 'info',
      'document_download': 'info',
      'email_sent_success': 'info',
      'email_service_error': 'error',
      'mpesa_payment_success': 'audit',
      'payment_create': 'info',
      'payment_success': 'audit',
      'payment_failed': 'warn',
      'payment_refund': 'audit',
      'document_send': 'info',
      'health_check_diagnostic': 'info',
      'user_login': 'audit',
      'user_logout': 'info',
      'user_profile_update': 'info',
      'email_send_attempt': 'info',
      'email_validation_error': 'warn',
      'api_call': 'info',
      'error': 'error',
      'system_alert': 'error',
      'mpesa_payment_error': 'error',
      'mpesa_health_check': 'info',
      'health_check': 'info'
    };
    return levelMap[action] || 'info';
  }

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