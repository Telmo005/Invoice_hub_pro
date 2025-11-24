// types/invoice-types.ts
export type TipoDocumento = 'fatura' | 'cotacao' | 'recibo';

/**
 * Tipos relacionados a emissor de fatura/cotação
 */
export interface Emitente {
  nomeEmpresa: string;
  documento: string;
  pais: string;
  cidade: string;
  bairro: string;
  pessoaContato?: string;
  email: string;
  telefone: string;
}

/**
 * Tipos relacionados ao destinatário da fatura/cotação
 */
export interface Destinatario {
  nomeCompleto: string;
  documento?: string;
  pais?: string;
  cidade?: string;
  bairro?: string;
  email: string;
  telefone: string;
}

/**
 * Dados principais do formulário - UNIFICADO PARA FATURAS E COTAÇÕES
 */
export interface FormDataDocumento {
  // Campos comuns
  tipo: TipoDocumento;
  emitente: Emitente;
  destinatario: Destinatario;
  dataFatura: string;
  ordemCompra?: string;
  termos: string;
  moeda: string;
  
  // Campos de desconto - ADICIONADOS
  desconto: number;
  tipoDesconto: 'fixed' | 'percent';
  
  // Campos específicos de FATURA (opcionais para cotação)
  faturaNumero?: string;
  // Campos específicos de RECIBO (opcionais)
  reciboNumero?: string;
  valorRecebido?: number;
  referenciaRecebimento?: string;
  formaPagamento?: string;
  dataRecebimento?: string;
  dataVencimento?: string;
  metodoPagamento?: string;
  validezFatura?: string; 
  
  // Campos específicos de COTAÇÃO (opcionais para fatura)
  cotacaoNumero?: string;
  validezCotacao?: number; // dias de validade
  dataExpiracao?: string; // data calculada de expiração (YYYY-MM-DD)
}

/**
 * Tipos para os itens da fatura/cotação
 */
export interface ItemDocumento {
  id: number;
  quantidade: number;
  descricao: string;
  precoUnitario: number;
  taxas: TaxaItem[];
  totalItem: number;
}

export interface Pessoa {
  nomeEmpresa: string;
  documento: string;
  pais: string;
  cidade: string;
  bairro: string;
  email: string;
  telefone: string;
  pessoaContato?: string;
}

/**
 * Tipos para taxas aplicadas aos itens
 */
export interface TaxaItem {
  nome: string;
  valor: number;
  tipo: 'percent' | 'fixed';
}

/**
 * Totais consolidados da fatura/cotação - ATUALIZADO COM DESCONTO
 */
export interface TotaisDocumento {
  subtotal: number;
  totalTaxas: number;
  totalFinal: number;
  taxasDetalhadas: {
    nome: string;
    valor: number;
  }[];
  desconto: number; // ADICIONADO
}

/**
 * Tipo principal que representa um documento completo (fatura ou cotação)
 */
export interface DocumentoData {
  tipo: TipoDocumento; 
  formData: FormDataDocumento; 
  items: ItemDocumento[];
  totais: TotaisDocumento;
  logo?: string | null;
  assinatura?: string | null;
  htmlContent?: string;
}

// ALIASES PARA COMPATIBILIDADE COM CÓDIGO EXISTENTE
export type FormDataFatura = FormDataDocumento;
export type FormDataCotacao = FormDataDocumento;
export type ItemFatura = ItemDocumento;
export type ItemCotacao = ItemDocumento;
export type TotaisFatura = TotaisDocumento;
export type TotaisCotacao = TotaisDocumento;
export type InvoiceData = DocumentoData;
export type QuotationData = DocumentoData;

/**
 * Tipo para o objeto armazenado no Map temporário
 */
export interface StoredDocumento {
  data: DocumentoData;
  createdAt: number;
}

// ALIASES PARA COMPATIBILIDADE
export type StoredInvoice = StoredDocumento;
export type StoredQuotation = StoredDocumento;

/**
 * Tipo para a resposta de criação de documento
 */
export interface DocumentoResponse {
  id: string;
  tipo: TipoDocumento;
  numero: string;
  dataExpiracao?: string;
}

// ALIASES PARA COMPATIBILIDADE
export type InvoiceResponse = DocumentoResponse;
export type QuotationResponse = DocumentoResponse;

/**
 * Tipo para parâmetros de busca de documento
 */
export interface GetDocumentoParams {
  id: string;
}

// ALIASES PARA COMPATIBILIDADE
export type GetInvoiceParams = GetDocumentoParams;
export type GetQuotationParams = GetDocumentoParams;

/**
 * Tipo para atualização de status de cotação
 */
export interface UpdateQuotationStatus {
  id: string;
  status: 'ativa' | 'expirada' | 'convertida' | 'cancelada';
}

/**
 * Tipo para conversão de cotação para fatura
 */
export interface ConvertQuotationToInvoice {
  cotacaoId: string;
  faturaNumero: string;
  dataVencimento: string;
}

/**
 * Tipo para validação de documento
 */
export interface DocumentoValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ALIAS PARA COMPATIBILIDADE
export type QuotationValidation = DocumentoValidation;

/**
 * Tipo para estatísticas de documentos
 */
export interface DocumentoStats {
  total: number;
  ativas: number;
  expiradas: number;
  convertidas: number;
  valorTotal: number;
}

// ALIAS PARA COMPATIBILIDADE
export type QuotationStats = DocumentoStats;

/**
 * Tipo para filtros de busca de documentos
 */
export interface DocumentoFilters {
  tipo?: TipoDocumento;
  status?: 'ativa' | 'expirada' | 'convertida' | 'cancelada';
  dataInicio?: string;
  dataFim?: string;
  emitente?: string;
  destinatario?: string;
}

// ALIAS PARA COMPATIBILIDADE
export type QuotationFilters = DocumentoFilters;