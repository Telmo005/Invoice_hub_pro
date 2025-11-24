// Preflight validation endpoint providing early, detailed feedback using Zod schemas.
import { NextRequest, NextResponse } from 'next/server';
import { withApiGuard } from '@/lib/api/guard';
import { logger } from '@/lib/logger';
import { invoiceCreateSchema, quotationCreateSchema, receiptCreateSchema } from '@/lib/validation/documentSchemas';

type Tipo = 'fatura' | 'cotacao' | 'recibo';

const schemas: Record<Tipo, any> = {
  fatura: invoiceCreateSchema,
  cotacao: quotationCreateSchema,
  recibo: receiptCreateSchema
};

interface ApiResponse { success: boolean; data?: any; errors?: Array<{ path: string; message: string }> }

export const POST = withApiGuard(async (req: NextRequest) => {
  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ success: false, errors: [{ path: '', message: 'JSON inválido' }] }, { status: 400 });
  }
  const tipo: Tipo | undefined = body?.tipo;
  const payload = body?.documentData;
  if (!tipo || !schemas[tipo]) {
    return NextResponse.json({ success: false, errors: [{ path: 'tipo', message: 'tipo inválido ou ausente' }] }, { status: 400 });
  }
  if (!payload) {
    return NextResponse.json({ success: false, errors: [{ path: 'documentData', message: 'documentData é obrigatório' }] }, { status: 400 });
  }
  const schema = schemas[tipo];
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }));
    await logger.log({ action: 'preflight_validation', level: 'warn', message: 'Falha na preflight', details: { tipo, issuesCount: issues.length } });
    return NextResponse.json({ success: false, errors: issues }, { status: 422 });
  }
  await logger.log({ action: 'preflight_validation', level: 'info', message: 'Preflight OK', details: { tipo } });
  return NextResponse.json({ success: true, data: { valid: true } }, { status: 200 });
}, { rate: { limit: 60 }, auditAction: 'preflight_validate' });
