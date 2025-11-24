// src/app/api/email/send-document/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/services/email-service';
import { logger } from '@/lib/logger';
import { withApiGuard } from '@/lib/api/guard';
import { isEmail, isNonEmptyString, safeTrim } from '@/lib/validation';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

interface EmailRequest {
  documentId: string;
  documentNumber: string;
  documentType?: string;
  clientName?: string;
  clientEmail: string;
  date?: string;
  totalValue?: string;
  currency?: string;
}

const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EMAIL_SERVICE_ERROR: 'EMAIL_SERVICE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export const POST = withApiGuard(async (request: NextRequest) => {
  const startTime = Date.now();
  let emailData: EmailRequest | null = null;

  try {
    let body: EmailRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      await logger.logError(parseError as Error, 'parse_email_request_body', {
        endpoint: '/api/email/send-document',
        method: 'POST'
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'JSON inválido',
          details: 'O corpo da requisição deve ser um JSON válido'
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    emailData = body;
    const { documentId, documentNumber, documentType, clientEmail, clientName } = body;

    await logger.log({
      action: 'document_send',
      level: 'info',
      message: `Tentativa de envio de email para documento: ${documentNumber}`,
      details: {
        documentId,
        documentNumber,
        documentType,
        clientEmail,
        clientName: clientName || 'Cliente'
      }
    });

    const missingFields: string[] = [];
    if (!isNonEmptyString(documentId)) missingFields.push('documentId');
    if (!isNonEmptyString(documentNumber)) missingFields.push('documentNumber');
    if (!isNonEmptyString(clientEmail) || !isEmail(clientEmail)) missingFields.push('clientEmail');

    if (missingFields.length > 0) {
      await logger.log({
        action: 'email_validation_error',
        level: 'warn',
        message: 'Dados obrigatórios faltando para envio de email',
        details: {
          missingFields,
          documentNumber,
          clientEmail
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Dados obrigatórios faltando',
          details: { missingFields }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validação do tipo de documento
    const validDocumentType = documentType === 'cotacao' || documentType === 'fatura' ? documentType : 'fatura';

    const result = await emailService.sendDocumentLink({
      documentId: safeTrim(documentId)!,
      documentNumber: safeTrim(documentNumber)!,
      documentType: validDocumentType,
      clientName: safeTrim(clientName) || 'Cliente',
      clientEmail: safeTrim(clientEmail)!,
      date: body.date || new Date().toISOString(),
      totalValue: body.totalValue,
      currency: body.currency
    });

    if (result.success) {
      await logger.log({
        action: 'email_sent_success',
        level: 'info',
        message: `Email enviado com sucesso para: ${clientEmail}`,
        details: {
          documentId,
          documentNumber,
          clientEmail,
          message: result.message
        }
      });

      const successResponse: ApiResponse<{ message: string }> = {
        success: true,
        data: {
          message: result.message
        }
      };

      return NextResponse.json(successResponse);
    } else {
      await logger.log({
        action: 'email_service_error',
        level: 'error',
        message: `Erro no serviço de email: ${result.message}`,
        details: {
          documentId,
          documentNumber,
          clientEmail,
          serviceError: result.message
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.EMAIL_SERVICE_ERROR,
          message: result.message,
          details: 'Falha no envio do email'
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'send_email_unexpected', {
      durationMs: duration,
      endpoint: '/api/email/send-document',
      documentData: emailData ? {
        documentId: emailData.documentId,
        documentNumber: emailData.documentNumber,
        clientEmail: emailData.clientEmail
      } : null
    });

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      }
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  } finally {
    const duration = Date.now() - startTime;
    await logger.log({ action: 'document_send', level: 'debug', message: 'Finalizou envio email', details: { durationMs: duration, hasData: !!emailData } });
  }
// Removido csrf para evitar requisição adicional /api/auth/csrf durante criação/envio
}, { auth: true, rate: { limit: 20, intervalMs: 60_000 }, auditAction: 'email_send_document' });
