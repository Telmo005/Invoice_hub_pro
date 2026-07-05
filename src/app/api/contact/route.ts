// src/app/api/contact/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/services/email-service';
import { logger } from '@/lib/logger';
import { withApiGuard } from '@/lib/api/guard';
import { isEmail, isNonEmptyString } from '@/lib/validation';

// Formulário de contacto/suporte (2026-07-05): rota pública (sem auth --
// alguém com problemas para entrar na conta também precisa de contactar
// suporte), mas o destinatário do email é sempre fixo (ALERT_EMAIL) -- ao
// contrário do extinto /api/email/test (removido nesta sessão por permitir
// enviar para qualquer endereço), esta rota nunca pode ser usada como relay
// de spam para terceiros. Rate limit apertado por ser pública.

const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EMAIL_SERVICE_ERROR: 'EMAIL_SERVICE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

const MAX_MENSAGEM_LENGTH = 2000;
const MAX_NOME_LENGTH = 100;

export const POST = withApiGuard(async (request: NextRequest) => {
  try {
    let body: { nome?: string; email?: string; mensagem?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'JSON inválido' }
      }, { status: 400 });
    }

    const nome = body.nome?.trim();
    const email = body.email?.trim();
    const mensagem = body.mensagem?.trim();

    if (!isNonEmptyString(nome) || nome.length > MAX_NOME_LENGTH) {
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Nome é obrigatório' }
      }, { status: 400 });
    }
    if (!isEmail(email)) {
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Email inválido' }
      }, { status: 400 });
    }
    if (!isNonEmptyString(mensagem) || mensagem.length > MAX_MENSAGEM_LENGTH) {
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Mensagem é obrigatória' }
      }, { status: 400 });
    }

    const result = await emailService.sendContactMessage(nome, email as string, mensagem);

    if (!result.success) {
      await logger.logError(new Error(result.message), 'contact_message_failed', { nome, email });
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.EMAIL_SERVICE_ERROR, message: 'Falha ao enviar mensagem. Tenta novamente mais tarde.' }
      }, { status: 502 });
    }

    await logger.log({ action: 'audit_action_generic', level: 'audit', message: 'Mensagem de contacto enviada', details: { nome, email } });
    return NextResponse.json({ success: true, data: { message: 'Mensagem enviada com sucesso' } });
  } catch (error) {
    await logger.logError(error as Error, 'contact_unexpected');
    return NextResponse.json({
      success: false,
      error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Erro interno do servidor' }
    }, { status: 500 });
  }
}, { rate: { limit: 5, intervalMs: 60 * 60_000 }, csrf: true, auditAction: 'contact_message' });

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-csrf-token',
    },
  });
}
