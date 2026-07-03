import { z } from 'zod';
import { isMozambiquePais, isValidNuit } from '@/lib/validation';

// Helpers devolvem instâncias para permitir encadeamento (min, email, regex)
const trimmed = () => z.string().trim();
// .nullish() (não .optional()) -- campos opcionais no formulário do wizard
// (pessoaContato, logo, assinatura, etc.) chegam como `null` quando não
// preenchidos, não `undefined`. .optional() sozinho rejeita null com
// "Expected string, received null", o que reprovava a validação em
// praticamente todos os documentos reais (assinatura é sempre null --
// não há UI para a preencher -- e logo é null sempre que não há upload).
const optTrimmed = () => z.string().trim().nullish().transform(v => v ?? undefined);

// NUIT (9 dígitos) só é exigido quando país = Moçambique (ver A5 em
// docs/auditoria-inicial.md); emitentes/destinatários estrangeiros mantêm
// apenas a verificação de "não vazio" já feita pelo .min(1). Recebe uma
// função em vez de um schema genérico para não perder o tipo de saída
// completo (um genérico com constraint estreita faz o TS colapsar o output
// do superRefine para a própria constraint).
function checkNuit(val: { documento?: string; pais?: string }, ctx: z.RefinementCtx) {
  if (isMozambiquePais(val.pais) && val.documento && !isValidNuit(val.documento)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['documento'],
      message: 'NUIT inválido: deve ter 9 dígitos'
    });
  }
}

const emitenteBaseSchema = z.object({
  nomeEmpresa: trimmed().min(2),
  documento: trimmed().min(1),
  pais: trimmed().min(1),
  cidade: trimmed().min(1),
  bairro: trimmed().min(1),
  pessoaContato: optTrimmed(),
  email: trimmed().email(),
  telefone: trimmed().min(3)
});

const destinatarioBaseSchema = z.object({
  nomeCompleto: trimmed().min(2),
  documento: optTrimmed(),
  pais: optTrimmed(),
  cidade: optTrimmed(),
  bairro: optTrimmed(),
  email: trimmed().email(),
  telefone: trimmed().min(3)
});

export const emitenteSchema = emitenteBaseSchema.superRefine(checkNuit);
export const destinatarioSchema = destinatarioBaseSchema.superRefine(checkNuit);
// Versão parcial (usada em recibos, onde o destinatário é opcional) --
// aplica-se .partial() ao schema base antes de acrescentar a verificação de NUIT.
const destinatarioPartialSchema = destinatarioBaseSchema.partial().superRefine(checkNuit);

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
  // Prefixo real gerado pela BD é 'COT' (ver gerar_numero_documento em
  // database.sql), não 'CTC' -- corrigido (ver A4 em docs/auditoria-inicial.md)
  cotacaoNumero: trimmed().regex(/^(COT)\/\d{4}\/\d{3}$/),
  // O wizard guarda isto como string (é o valor de um <input>, usado com
  // .trim() no formulário) -- z.coerce aceita '15' tal como 15.
  validezCotacao: z.coerce.number().int().positive().max(365).default(15)
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
  // Prefixo real gerado pela BD é 'REC' (ver gerar_numero_documento em
  // database.sql), não 'RCB' -- corrigido (ver A4 em docs/auditoria-inicial.md)
  reciboNumero: trimmed().regex(/^(REC)\/\d{4}\/\d{3}$/),
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
  destinatario: destinatarioPartialSchema.optional(),
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
