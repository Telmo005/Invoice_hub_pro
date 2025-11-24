// Fallback manual validator for quotation creation removing Zod dependency.
import { Emitente, Destinatario, ItemFatura, TotaisFatura, FormDataFatura } from '@/types/invoice-types';

export interface QuotationDataPlain {
  formData: (FormDataFatura & {
    cotacaoNumero: string;
    dataFatura: string;
    dataVencimento: string;
    validezCotacao?: string | number;
    emitente: Emitente;
    destinatario: Destinatario;
  });
  items: ItemFatura[];
  totais?: TotaisFatura;
  logo?: string | null;
  assinatura?: string | null;
  htmlContent?: string | null;
}

interface ValidationIssue { path: string; message: string }
interface ValidationOk { ok: true; data: QuotationDataPlain }
interface ValidationFail { ok: false; errors: ValidationIssue[] }
export type ValidationResult = ValidationOk | ValidationFail;

const numeroRegex = /^(CTC)\/\d{4}\/\d{3}$/; // alinhado ao schema original

export function validateQuotationPayloadSimple(raw: any): ValidationResult {
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
    errors.push({ path: 'items', message: 'Informe ao menos 1 item' });
  }
  if (formData) {
    if (!formData.cotacaoNumero || typeof formData.cotacaoNumero !== 'string' || !numeroRegex.test(formData.cotacaoNumero)) {
      errors.push({ path: 'formData.cotacaoNumero', message: 'cotacaoNumero inválido. Formato esperado CTC/AAAA/NNN' });
    }
    ['dataFatura','dataVencimento'].forEach(k => {
      if (!formData[k] || typeof formData[k] !== 'string') {
        errors.push({ path: `formData.${k}`, message: `${k} é obrigatório` });
      }
    });
    // emitente/destinatario campos principais
    const emitente = formData.emitente;
    if (!emitente) errors.push({ path: 'formData.emitente', message: 'emitente é obrigatório' });
    else {
      ['nomeEmpresa','documento','email'].forEach(k => {
        if (!emitente[k] || typeof emitente[k] !== 'string') {
          errors.push({ path: `formData.emitente.${k}` , message: `${k} obrigatório` });
        }
      });
    }
    const destinatario = formData.destinatario;
    if (!destinatario) errors.push({ path: 'formData.destinatario', message: 'destinatario é obrigatório' });
    else if (!destinatario.nomeCompleto || typeof destinatario.nomeCompleto !== 'string') {
      errors.push({ path: 'formData.destinatario.nomeCompleto', message: 'nomeCompleto obrigatório' });
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: raw as QuotationDataPlain };
}
