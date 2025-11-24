import { z } from 'zod';

// Helpers devolvem instâncias para permitir encadeamento (min, email, regex)
const trimmed = () => z.string().trim();
const optTrimmed = () => z.string().trim().optional();

export const emitenteSchema = z.object({
  nomeEmpresa: trimmed().min(2),
  documento: trimmed().min(1),
  pais: trimmed().min(1),
  cidade: trimmed().min(1),
  bairro: trimmed().min(1),
  pessoaContato: optTrimmed(),
  email: trimmed().email(),
  telefone: trimmed().min(3)
});

export const destinatarioSchema = z.object({
  nomeCompleto: trimmed().min(2),
  documento: optTrimmed(),
  pais: optTrimmed(),
  cidade: optTrimmed(),
  bairro: optTrimmed(),
  email: trimmed().email(),
  telefone: trimmed().min(3)
});

const taxaSchema = z.object({
  nome: trimmed().min(1),
  valor: z.number().nonnegative(),
  tipo: z.enum(['percent', 'fixed'])
});

const itemSchema = z.object({
  id: z.number().int().nonnegative(),
  quantidade: z.number().positive(),
  descricao: trimmed().min(1),
  precoUnitario: z.number().nonnegative(),
  taxas: z.array(taxaSchema).default([]),
  totalItem: z.number().nonnegative().optional()
});

export const invoiceFormDataSchema = z.object({
  faturaNumero: trimmed().regex(/^(FTR)\/\d{4}\/\d{3}$/),
  dataFatura: trimmed(),
  dataVencimento: trimmed(),
  ordemCompra: optTrimmed(),
  termos: optTrimmed(),
  moeda: trimmed().min(1),
  metodoPagamento: optTrimmed(),
  emitente: emitenteSchema,
  destinatario: destinatarioSchema,
  desconto: z.number().nonnegative().default(0),
  tipoDesconto: z.enum(['fixed', 'percent']).default('fixed'),
  status: z.enum(['emitida', 'paga']).optional()
});

export const invoiceCreateSchema = z.object({
  formData: invoiceFormDataSchema,
  items: z.array(itemSchema).min(1),
  totais: z.object({
    subtotal: z.number().nonnegative(),
    totalTaxas: z.number().nonnegative(),
    totalFinal: z.number().nonnegative(),
    taxasDetalhadas: z.array(z.object({ nome: trimmed(), valor: z.number().nonnegative() })),
    desconto: z.number().nonnegative().default(0)
  }).optional(),
  logo: optTrimmed(),
  assinatura: optTrimmed(),
  htmlContent: optTrimmed()
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;

export function validateInvoicePayload(raw: unknown) {
  const parsed = invoiceCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
    return { ok: false as const, errors: issues };
  }
  return { ok: true as const, data: parsed.data };
}

// Cotação schemas (reuse base invoice concepts)
export const quotationFormDataSchema = invoiceFormDataSchema.extend({
  cotacaoNumero: trimmed().regex(/^(CTC)\/\d{4}\/\d{3}$/),
  validezCotacao: z.number().int().positive().max(365).default(15)
}).omit({ faturaNumero: true });

export const quotationCreateSchema = z.object({
  formData: quotationFormDataSchema,
  items: z.array(itemSchema).min(1),
  totais: z.object({
    subtotal: z.number().nonnegative(),
    totalTaxas: z.number().nonnegative(),
    totalFinal: z.number().nonnegative(),
    taxasDetalhadas: z.array(z.object({ nome: trimmed(), valor: z.number().nonnegative() })),
    desconto: z.number().nonnegative().default(0)
  }).optional(),
  logo: optTrimmed(),
  assinatura: optTrimmed(),
  htmlContent: optTrimmed()
});

export type QuotationCreateInput = z.infer<typeof quotationCreateSchema>;

export function validateQuotationPayload(raw: unknown) {
  const parsed = quotationCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
    return { ok: false as const, errors: issues };
  }
  return { ok: true as const, data: parsed.data };
}

// Recibo schemas
export const receiptFormDataSchema = z.object({
  reciboNumero: trimmed().regex(/^(RCB)\/\d{4}\/\d{3}$/),
  dataRecebimento: trimmed(),
  dataPagamento: optTrimmed(),
  valorRecebido: z.number().positive(),
  formaPagamento: optTrimmed(),
  referenciaPagamento: optTrimmed(),
  documentoAssociadoCustom: optTrimmed(),
  motivoPagamento: optTrimmed(),
  moeda: trimmed().min(1),
  ordemCompra: optTrimmed(),
  termos: optTrimmed(),
  emitente: emitenteSchema,
  destinatario: destinatarioSchema.partial().optional(),
  status: z.enum(['emitida', 'paga']).optional()
});

export const receiptCreateSchema = z.object({
  formData: receiptFormDataSchema,
  items: z.array(itemSchema).optional(),
  totais: z.object({
    subtotal: z.number().nonnegative(),
    totalTaxas: z.number().nonnegative(),
    totalFinal: z.number().nonnegative(),
    taxasDetalhadas: z.array(z.object({ nome: trimmed(), valor: z.number().nonnegative() })),
    desconto: z.number().nonnegative().default(0)
  }).optional(),
  logo: optTrimmed(),
  assinatura: optTrimmed(),
  htmlContent: optTrimmed()
});

export type ReceiptCreateInput = z.infer<typeof receiptCreateSchema>;

export function validateReceiptPayload(raw: unknown) {
  const parsed = receiptCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
    return { ok: false as const, errors: issues };
  }
  return { ok: true as const, data: parsed.data };
}
