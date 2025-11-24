import { headers } from 'next/headers';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'audit';
export type LogAction = 
  | 'document_create' | 'document_update' | 'document_delete' | 'document_view' | 'mpesa_payment_processing'
  | 'document_export' | 'document_download' | 'email_sent_success' | 'email_service_error' | 'mpesa_payment_success'
  | 'payment_create' | 'payment_success' | 'payment_failed' | 'payment_refund' | 'document_send' | 'health_check_diagnostic'
  | 'user_login' | 'user_logout' | 'user_profile_update' | 'email_send_attempt' | 'email_validation_error'
  | 'api_call' | 'error' | 'system_alert' | 'mpesa_payment_error' | 'mpesa_health_check' | 'health_check'
  | 'number_generate' | 'validation' | 'mpesa_payment_tipo_documento_normalized'
  | 'payment_stage' | 'template_render_error' | 'security_event' | 'audit_action_generic' | 'api_error_detailed';

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
          method: headersList.get('x-method') || 'GET',
          requestId: headersList.get('x-request-id') || 'unknown'
        };
      } else {
        return {
          ipAddress: 'client',
          userAgent: navigator.userAgent || 'unknown',
          endpoint: window.location.pathname || 'unknown',
          method: 'GET',
          requestId: (window as any).__REQUEST_ID__ || 'client'
        };
      }
    } catch (_error) {
      return {
        ipAddress: 'unknown',
        userAgent: 'unknown',
        endpoint: 'unknown',
        method: 'unknown',
        requestId: 'unknown'
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

        // Adaptar dinamicamente caso coluna request_id não exista ainda
        const baseEntry: any = {
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

        // Tentativa de verificar metadados de tabela para request_id somente em ambiente server
        let canUseRequestId = true;
        try {
          if (typeof window === 'undefined') {
            const meta = await supabase.from('system_logs').select('request_id').limit(1);
            if (meta.error && /request_id/.test(meta.error.message)) {
              canUseRequestId = false;
            }
          }
        } catch { canUseRequestId = false; }

        if (canUseRequestId) {
            baseEntry.request_id = context.requestId;
        }

        const insertOperation = supabase.from('system_logs').insert(baseEntry);
        
        const result = await Promise.race([
          insertOperation,
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Log timeout')), 2000)
          )
        ]);

        if (result && 'error' in result && result.error) {
          console.error('Log insertion error:', result.error.message);
        }

      } catch (_error) {
        if (_error instanceof Error && _error.message !== 'Log timeout') {
          console.error('Critical log error:', _error);
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

    } catch (_error) {
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
      , 'number_generate': 'info',
      'validation': 'warn',
      'mpesa_payment_tipo_documento_normalized': 'warn',
      'payment_stage': 'info',
      'template_render_error': 'error',
      'security_event': 'warn',
      'audit_action_generic': 'audit',
      'api_error_detailed': 'error'
    };
    return levelMap[action] || 'info';
  }

  async logDocumentCreation(documentType: string, documentId: string, documentData: any) {
    const typeLabelMap: Record<string, string> = {
      'fatura': 'Fatura',
      'cotacao': 'Cotação',
      'recibo': 'Recibo'
    };
    const label = typeLabelMap[documentType] || documentType;
    this.addToQueue({
      action: 'document_create',
      resourceType: documentType,
      resourceId: documentId,
      message: `${label} criada: ${documentData.numero}`,
      details: {
        numero: documentData.numero,
        total: documentData.totais?.totalFinal,
        itensCount: documentData.items?.length,
        emitente: documentData.emitente?.nomeEmpresa?.substring(0, 50),
        destinatario: documentData.destinatario?.nomeCompleto?.substring(0, 50),
        validez: documentData.validez,
        dataVencimento: documentData.dataVencimento,
        valorRecebido: documentData.valorRecebido
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

  async logPaymentLifecycle(stage: 'initiated' | 'validated' | 'processing' | 'success' | 'failed' | 'refunded', paymentId: string | undefined, details?: any) {
    const actionMap: Record<typeof stage, LogAction> = {
      initiated: 'payment_create',
      validated: 'payment_stage',
      processing: 'mpesa_payment_processing',
      success: 'payment_success',
      failed: 'payment_failed',
      refunded: 'payment_refund'
    } as const;
    const action = actionMap[stage];
    this.addToQueue({
      action,
      message: `Pagamento ${stage}${paymentId ? ' - ' + paymentId : ''}`.substring(0, 120),
      resourceType: 'payment',
      resourceId: paymentId,
      details: { stage, ...details }
    });
  }

  async logTemplateRenderIssue(template: string, error: Error, context?: string, details?: any) {
    this.addToQueue({
      action: 'template_render_error',
      level: 'error',
      message: `Falha ao renderizar template ${template}: ${error.message.substring(0,120)}`,
      resourceType: 'template',
      resourceId: template,
      details: { errorMessage: error.message, context, ...details }
    });
  }

  async logSecurityEvent(eventType: string, severity: 'low' | 'medium' | 'high', details?: any) {
    this.addToQueue({
      action: 'security_event',
      level: severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info',
      message: `Evento de segurança (${severity}): ${eventType}`.substring(0,140),
      resourceType: 'security',
      details: { eventType, severity, ...details }
    });
  }

  async logAuditAction(actionName: string, userId?: string, details?: any) {
    this.addToQueue({
      action: 'audit_action_generic',
      level: 'audit',
      message: `Ação auditada: ${actionName}`.substring(0,140),
      resourceType: 'audit',
      resourceId: userId,
      details: { actionName, userId, ...details }
    });
  }

  async logApiError(endpoint: string, method: string, error: Error, details?: any) {
    this.addToQueue({
      action: 'api_error_detailed',
      level: 'error',
      message: `Erro API ${method} ${endpoint}: ${error.message.substring(0,120)}`,
      resourceType: 'api',
      details: { endpoint, method, errorMessage: error.message, stack: process.env.NODE_ENV==='development'? error.stack?.substring(0,300): undefined, ...details }
    });
  }
}

export const logger = SystemLogger.getInstance();