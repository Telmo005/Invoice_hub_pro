import { logger } from '@/lib/logger';

interface BaseBody {
  amount: any;
  customer_msisdn: any;
  transaction_reference: any;
  third_party_reference?: any;
  tipo_documento?: any;
  document_snapshot?: any;
  moeda?: any;
}

export interface ValidatedMpesaData {
  amount: number;
  customer_msisdn: string;
  transaction_reference: string;
  third_party_reference?: string;
  tipo_documento: 'fatura' | 'cotacao' | 'recibo';
  document_snapshot: any;
  moeda: string;
}

const allowedTipos = ['fatura','cotacao','recibo'] as const;

export async function validateMpesaBody(raw: BaseBody) : Promise<{ ok: true; data: ValidatedMpesaData } | { ok: false; error: any }> {
  const missing: string[] = [];
  if (raw.amount === undefined) missing.push('amount');
  if (!raw.customer_msisdn) missing.push('customer_msisdn');
  if (!raw.transaction_reference) missing.push('transaction_reference');
  if (missing.length) {
    return { ok: false, error: { code: 'MISSING_FIELDS', message: 'Campos obrigatórios em falta', details: { missingFields: missing } } };
  }

  if (typeof raw.amount !== 'number' || raw.amount <= 0) {
    return { ok: false, error: { code: 'MISSING_FIELDS', message: 'Amount inválido', details: { amount: raw.amount } } };
  }

  if (typeof raw.customer_msisdn !== 'string') {
    return { ok: false, error: { code: 'MISSING_FIELDS', message: 'customer_msisdn deve ser string' } };
  }

  const tipoRaw = String(raw.tipo_documento || '').toLowerCase().trim();
  const tipo_documento = allowedTipos.includes(tipoRaw as any) ? tipoRaw as typeof allowedTipos[number] : null;
  if (!tipo_documento) {
    return { ok: false, error: { code: 'MISSING_FIELDS', message: 'tipo_documento inválido ou ausente', details: { provided: raw.tipo_documento } } };
  }

  const snapshot = raw.document_snapshot || {};
  const numeroCampo = tipo_documento === 'fatura' ? 'faturaNumero' : tipo_documento === 'cotacao' ? 'cotacaoNumero' : 'reciboNumero';
  const docMissing: string[] = [];
  if (!snapshot[numeroCampo]) docMissing.push(numeroCampo);
  if (!snapshot.emitente?.nomeEmpresa) docMissing.push('emitente.nomeEmpresa');
  if (tipo_documento !== 'recibo' && !snapshot.destinatario?.nomeCompleto) docMissing.push('destinatario.nomeCompleto');
  if (tipo_documento === 'recibo' && (typeof snapshot.valorRecebido !== 'number' || snapshot.valorRecebido <= 0)) docMissing.push('valorRecebido');
  if ((tipo_documento === 'fatura' || tipo_documento === 'cotacao') && (!Array.isArray(snapshot.items) || snapshot.items.length === 0)) docMissing.push('items[]');
  if (docMissing.length) {
    await logger.log({ action: 'validation', level: 'warn', message: 'Documento inválido antes de pagamento MPesa', details: { tipo_documento, missingDocFields: docMissing } });
    return { ok: false, error: { code: 'MISSING_FIELDS', message: 'Campos obrigatórios do documento em falta', details: { missingDocFields: docMissing } } };
  }

  const moeda = typeof raw.moeda === 'string' && raw.moeda.trim() ? raw.moeda.trim() : 'MZN';

  return {
    ok: true,
    data: {
      amount: raw.amount,
      customer_msisdn: raw.customer_msisdn,
      transaction_reference: String(raw.transaction_reference),
      third_party_reference: raw.third_party_reference ? String(raw.third_party_reference) : undefined,
      tipo_documento,
      document_snapshot: snapshot,
      moeda
    }
  };
}
