import { Emitente, Destinatario, ItemFatura, TotaisFatura } from '@/types/invoice-types';

export interface ReceiptDataPlain {
  formData: {
    reciboNumero: string;
    dataRecebimento: string;
    valorRecebido: number;
    formaPagamento?: string;
    referenciaPagamento?: string;
    documentoAssociadoCustom?: string;
    motivoPagamento?: string;
    moeda?: string;
    ordemCompra?: string;
    termos?: string;
    emitente: Emitente;
    destinatario?: Destinatario;
    status?: 'emitida' | 'paga';
  };
  items?: ItemFatura[];
  totais?: TotaisFatura;
  logo?: string | null;
  assinatura?: string | null;
  htmlContent?: string | null;
}

interface ValidationIssue { path: string; message: string }
interface ValidationOk { ok: true; data: ReceiptDataPlain }
interface ValidationFail { ok: false; errors: ValidationIssue[] }
export type ValidationResult = ValidationOk | ValidationFail;

const numeroRegex = /^(RCB)\/\d{4}\/\d{3}$/;

export function validateReceiptPayloadSimple(raw: any): ValidationResult {
  const errors: ValidationIssue[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: [{ path: '', message: 'Payload deve ser objeto' }] };
  }
  const formData = raw.formData;
  if (!formData || typeof formData !== 'object') {
    errors.push({ path: 'formData', message: 'formData é obrigatório' });
  }
  if (formData) {
    if (!formData.reciboNumero || typeof formData.reciboNumero !== 'string' || !numeroRegex.test(formData.reciboNumero)) {
      errors.push({ path: 'formData.reciboNumero', message: 'reciboNumero inválido. Formato RCB/AAAA/NNN' });
    }
    if (!formData.dataRecebimento || typeof formData.dataRecebimento !== 'string') {
      errors.push({ path: 'formData.dataRecebimento', message: 'dataRecebimento é obrigatória' });
    }
    if (typeof formData.valorRecebido !== 'number' || formData.valorRecebido <= 0) {
      errors.push({ path: 'formData.valorRecebido', message: 'valorRecebido deve ser número > 0' });
    }
    const emitente = formData.emitente;
    if (!emitente) errors.push({ path: 'formData.emitente', message: 'emitente é obrigatório' });
    else {
      ['nomeEmpresa','documento','email'].forEach(k => {
        if (!emitente[k] || typeof emitente[k] !== 'string') {
          errors.push({ path: `formData.emitente.${k}`, message: `${k} obrigatório` });
        }
      });
    }
    const dest = formData.destinatario;
    if (dest && (!dest.nomeCompleto || typeof dest.nomeCompleto !== 'string')) {
      errors.push({ path: 'formData.destinatario.nomeCompleto', message: 'nomeCompleto obrigatório' });
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: raw as ReceiptDataPlain };
}
