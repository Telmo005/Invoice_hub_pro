// types/invoice-types.ts
export type TipoDocumento = 'fatura' | 'cotacao';

/**
 * Tipos relacionados a emissor de fatura
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
 * Tipos relacionados ao destinatário da fatura
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
 * Dados principais do formulário - AGORA PARA FATURAS E COTAÇÕES
 */
export interface FormDataFatura {
  // Campos comuns
  tipo: TipoDocumento; // ← ADICIONADO - CRÍTICO!
  emitente: Emitente;
  destinatario: Destinatario;
  dataFatura: string;
  ordemCompra?: string;
  termos: string;
  moeda: string;
  
  // Campos específicos de FATURA (opcionais para cotação)
  faturaNumero?: string;
  dataVencimento?: string;
  metodoPagamento?: string;
  validezFatura?: string; // ← NOVO CAMPO ADICIONADO
  
  // Campos específicos de COTAÇÃO (opcionais para fatura)
  cotacaoNumero?: string;
  validezCotacao?: string; // ← ATUALIZADO: mudado de number para string
}

/**
 * Tipos para os itens da fatura
 */
export interface ItemFatura {
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
 * Totais consolidados da fatura
 */
export interface TotaisFatura {
  subtotal: number;
  totalTaxas: number;
  totalFinal: number;
  taxasDetalhadas: {
    nome: string;
    valor: number;
  }[];
}

/**
 * Tipo principal que representa uma fatura/cotação completa
 */
export interface InvoiceData {
  tipo: TipoDocumento; // ← ADICIONADO - CRÍTICO!
  formData: FormDataFatura; // ← AGORA SUPORTA AMBOS!
  items: ItemFatura[];
  totais: TotaisFatura;
  logo?: string | null;
  assinatura?: string | null;
  htmlContent?: string;
}

/**
 * Tipo para o objeto armazenado no Map temporário
 */
export interface StoredInvoice {
  data: InvoiceData;
  createdAt: number;
}

/**
 * Tipo para a resposta de criação de fatura
 */
export interface InvoiceResponse {
  id: string;
}

/**
 * Tipo para parâmetros de busca de fatura
 */
export interface GetInvoiceParams {
  id: string;
}