import { FormDataFatura, Emitente, Destinatario, ItemFatura, TotaisFatura } from '@/types/invoice-types';

export interface InvoiceDataPlain {
  formData: (FormDataFatura & {
    faturaNumero: string;
    dataFatura: string;
    dataVencimento: string;
    emitente: Emitente;
    destinatario: Destinatario;
    metodoPagamento?: string;
  });
  items: ItemFatura[];
  totais?: TotaisFatura;
  logo?: string | null;
  assinatura?: string | null;
  htmlContent?: string | null;
}

interface ValidationIssue { path: string; message: string }
interface ValidationOk { ok: true; data: InvoiceDataPlain }
interface ValidationFail { ok: false; errors: ValidationIssue[] }
export type ValidationResult = ValidationOk | ValidationFail;

const numeroRegex = /^(FTR)\/\d{4}\/\d{3}$/;

export function validateInvoicePayloadSimple(raw: any): ValidationResult {
  const errors: ValidationIssue[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: [{ path: '', message: 'Payload deve ser objeto' }] };
  }
  const formData = raw.formData;
  if (!formData || typeof formData !== 'object') {
    errors.push({ path: 'formData', message: 'formData é obrigatório' });
  }
  const items = raw.items;
  if (!Array.isArray(items) || items.length === 0) {
    errors.push({ path: 'items', message: 'items deve ter pelo menos 1 item' });
  }
  if (formData) {
    if (!formData.faturaNumero || typeof formData.faturaNumero !== 'string' || !numeroRegex.test(formData.faturaNumero)) {
      errors.push({ path: 'formData.faturaNumero', message: 'faturaNumero inválido. Formato FTR/AAAA/NNN' });
    }
    ['dataFatura','dataVencimento'].forEach(k => {
      if (!formData[k] || typeof formData[k] !== 'string') {
        errors.push({ path: `formData.${k}`, message: `${k} é obrigatório` });
      }
    });
    const emitente = formData.emitente;
    if (!emitente) errors.push({ path: 'formData.emitente', message: 'emitente é obrigatório' });
    else {
      ['nomeEmpresa','documento','email'].forEach(k => {
        if (!emitente[k] || typeof emitente[k] !== 'string') {
          errors.push({ path: `formData.emitente.${k}`, message: `${k} obrigatório` });
        }
      });
    }
    const destinatario = formData.destinatario;
    if (!destinatario) errors.push({ path: 'formData.destinatario', message: 'destinatario é obrigatório' });
    else if (!destinatario.nomeCompleto || typeof destinatario.nomeCompleto !== 'string') {
      errors.push({ path: 'formData.destinatario.nomeCompleto', message: 'nomeCompleto obrigatório' });
    }
    // Regras de desconto: apenas validar extremos para não bloquear UX
    if (formData.desconto != null && typeof formData.desconto === 'number') {
      if (formData.desconto < 0) errors.push({ path: 'formData.desconto', message: 'desconto não pode ser negativo' });
      if (formData.tipoDesconto === 'percent' && formData.desconto > 100) errors.push({ path: 'formData.desconto', message: 'percentual > 100' });
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: raw as InvoiceDataPlain };
}
