/**
 * Tipos específicos para cotações
 */

/**
 * Dados principais do formulário da cotação
 */
export interface FormDataCotacao {
    emitente: Emitente;
    destinatario: Destinatario;
    cotacaoNumero: string;
    dataFatura: string;
    ordemCompra?: string;
    dataVencimento: string;
    termos: string;
    moeda: string;
    metodoPagamento: string;
    validezCotacao: number; // dias de validade
    dataExpiracao?: string; // data calculada de expiração
}

/**
 * Tipos para os itens da cotação (pode reutilizar ItemFatura se for igual)
 */
export interface ItemCotacao {
    id: number;
    quantidade: number;
    descricao: string;
    precoUnitario: number;
    taxas: TaxaItem[];
    totalItem: number;
}

/**
 * Totais consolidados da cotação (pode reutilizar TotaisFatura se for igual)
 */
export interface TotaisCotacao {
    subtotal: number;
    totalTaxas: number;
    totalFinal: number;
    taxasDetalhadas: {
        nome: string;
        valor: number;
    }[];
}

/**
 * Tipo principal que representa uma cotação completa
 */
export interface QuotationData {
    formData: FormDataCotacao;
    items: ItemCotacao[];
    totais: TotaisCotacao;
    logo?: string | null;
    assinatura?: string | null;
    tipoDocumento?: 'cotacao'; // para identificar o tipo
    htmlContent?: string;
}

/**
 * Tipo para o objeto armazenado no Map temporário
 */
export interface StoredQuotation {
    data: QuotationData;
    createdAt: number;
}

/**
 * Tipo para a resposta de criação de cotação
 */
export interface QuotationResponse {
    id: string;
    dataExpiracao: string;
}

/**
 * Tipo para parâmetros de busca de cotação
 */
export interface GetQuotationParams {
    id: string;
}

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

// =============================================
// TIPOS COMPARTILHADOS (exportados do invoice-types)
// =============================================

/**
 * Tipos relacionados a emissor (compartilhado)
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
 * Tipos relacionados ao destinatário (compartilhado)
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
 * Tipos para taxas aplicadas aos itens (compartilhado)
 */
export interface TaxaItem {
    nome: string;
    valor: number;
    tipo: 'percent' | 'fixed';
}

/**
 * Tipo para pessoa (compartilhado)
 */
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
 * Tipo unificado para documentos
 */
export type TipoDocumento = 'fatura' | 'cotacao';

/**
 * Tipo para documento genérico (pode ser fatura ou cotação)
 */
export type DocumentoData = InvoiceData | QuotationData;

/**
 * Tipo para resposta genérica de documento
 */
export interface DocumentoResponse {
    id: string;
    tipo: TipoDocumento;
    numero: string;
    dataExpiracao?: string;
}

// =============================================
// UTILITY TYPES
// =============================================

/**
 * Tipo para validação de cotação
 */
export interface QuotationValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Tipo para estatísticas de cotações
 */
export interface QuotationStats {
    total: number;
    ativas: number;
    expiradas: number;
    convertidas: number;
    valorTotal: number;
}

/**
 * Tipo para filtros de busca de cotações
 */
export interface QuotationFilters {
    status?: 'ativa' | 'expirada' | 'convertida' | 'cancelada';
    dataInicio?: string;
    dataFim?: string;
    emitente?: string;
    destinatario?: string;
}