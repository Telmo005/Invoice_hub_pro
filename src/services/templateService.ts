import { Template, TemplateRenderState } from '@/types/template-types';
import { InvoiceData } from '@/types/invoice-types';
import { QuotationData } from '@/types/quotation-types';
import { TemplateCache } from '@/lib/cache/templateCache';
import { TemplateMetrics } from '@/lib/cache/monitoring/metrics';
import { generateDataHash } from '@/lib/hash';

// Tipo unificado para dados de documentos
export type DocumentData = InvoiceData | QuotationData;
export type DocumentType = 'invoice' | 'quotation' | 'receipt';

export interface RenderOptions {
  signal?: AbortSignal;
  useCache?: boolean;
  documentType?: DocumentType;
}

export interface TemplateNavigation {
  currentIndex: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Interface estendida localmente para evitar modificar o tipo original
interface TemplateWithBackend extends Template {
  backendId: string;
  supportedTypes?: DocumentType[];
}

export class TemplateService {
  private static instance: TemplateService;
  private templates: TemplateWithBackend[] = [];
  private cache: TemplateCache;
  private metrics: TemplateMetrics;
  private abortControllers: Map<string, AbortController> = new Map();

  private constructor() {
    this.cache = TemplateCache.getInstance();
    this.metrics = TemplateMetrics.getInstance();
    this.initializeTemplates();
  }

  static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  private initializeTemplates(): void {
    this.templates = [
      {
        id: 'template-1',
        name: "Elegante",
        description: "Sofisticado e profissional para clientes exigentes",
        thumbnail: "bg-gradient-to-br from-indigo-100 to-purple-100",
        templateType: 'detailed',
        imageUrl: '/invoice1.JPG',
        backendId: 'template-1',
        supportedTypes: ['invoice', 'quotation']
      },
      {
        id: 'template-2',
        name: "Essencial",
        description: "Apenas o essencial, sem distrações",
        premium: true,
        thumbnail: "bg-gradient-to-br from-blue-50 to-cyan-100",
        templateType: 'default',
        imageUrl: '/invoice2.JPG',
        backendId: 'template-2',
        supportedTypes: ['invoice', 'quotation']
      },
      {
        id: 'template-3',
        name: "Moderno",
        description: "Design contemporâneo com ênfase visual",
        thumbnail: "bg-gradient-to-br from-gray-50 to-gray-100",
        templateType: 'detailed',
        imageUrl: '/invoice3.JPG',
        backendId: 'template-3',
        supportedTypes: ['invoice', 'quotation']
      },
      {
        id: 'template-4',
        name: 'Executivo Navy & Ouro',
        description: 'Elegância corporativa em azul-marinho e dourado',
        thumbnail: 'bg-gradient-to-br from-slate-800 to-yellow-600',
        templateType: 'detailed',
        imageUrl: '/invoice4.jpg',
        backendId: 'template-4',
        supportedTypes: ['invoice', 'quotation']
      },
      {
        id: 'template-5',
        name: 'Minimalista Mono',
        description: 'Preto e branco, sem distrações, só o essencial',
        thumbnail: 'bg-gradient-to-br from-gray-100 to-gray-300',
        templateType: 'minimal',
        imageUrl: '/invoice5.jpg',
        backendId: 'template-5',
        supportedTypes: ['invoice', 'quotation']
      },
      {
        id: 'template-6',
        name: 'Editorial Serif',
        description: 'Layout de revista com tipografia serif refinada',
        thumbnail: 'bg-gradient-to-br from-amber-50 to-orange-100',
        templateType: 'detailed',
        imageUrl: '/invoice6.jpg',
        backendId: 'template-6',
        supportedTypes: ['invoice', 'quotation']
      },
      {
        id: 'template-7',
        name: 'Geométrico Bold',
        description: 'Formas geométricas e cores de alto contraste',
        premium: true,
        thumbnail: 'bg-gradient-to-br from-fuchsia-100 to-purple-200',
        templateType: 'detailed',
        imageUrl: '/invoice7.jpg',
        backendId: 'template-7',
        supportedTypes: ['invoice', 'quotation']
      },
      {
        id: 'template-8',
        name: 'Gradiente Suave',
        description: 'Visual moderno de produto digital, com gradiente suave',
        thumbnail: 'bg-gradient-to-br from-sky-100 to-indigo-100',
        templateType: 'default',
        imageUrl: '/invoice8.jpg',
        backendId: 'template-8',
        supportedTypes: ['invoice', 'quotation']
      },
      {
        id: 'template-9',
        name: 'Clássico Ledger',
        description: 'Livro-razão tradicional, sóbrio e confiável',
        thumbnail: 'bg-gradient-to-br from-yellow-50 to-amber-100',
        templateType: 'detailed',
        imageUrl: '/invoice9.jpg',
        backendId: 'template-9',
        supportedTypes: ['invoice', 'quotation']
      },
      {
        id: 'template-10',
        name: 'Tech Card Itemizado',
        description: 'Itens em cartões, visual de produto tecnológico',
        premium: true,
        thumbnail: 'bg-gradient-to-br from-indigo-100 to-blue-200',
        templateType: 'detailed',
        imageUrl: '/invoice10.jpg',
        backendId: 'template-10',
        supportedTypes: ['invoice', 'quotation']
      },
      {
        id: 'template-11',
        name: 'Luxo Dark & Dourado',
        description: 'Cabeçalho escuro com dourado, sensação premium',
        premium: true,
        thumbnail: 'bg-gradient-to-br from-neutral-800 to-yellow-700',
        templateType: 'detailed',
        imageUrl: '/invoice11.jpg',
        backendId: 'template-11',
        supportedTypes: ['invoice', 'quotation']
      },
      {
        id: 'template-12',
        name: 'Boutique Pastel',
        description: 'Tons pastel e cantos arredondados, acolhedor',
        thumbnail: 'bg-gradient-to-br from-pink-50 to-rose-100',
        templateType: 'default',
        imageUrl: '/invoice12.jpg',
        backendId: 'template-12',
        supportedTypes: ['invoice', 'quotation']
      },
      {
        id: 'template-13',
        name: 'Corporativo Sidebar',
        description: 'Barra lateral com identidade da marca',
        thumbnail: 'bg-gradient-to-br from-teal-100 to-cyan-200',
        templateType: 'detailed',
        imageUrl: '/invoice13.jpg',
        backendId: 'template-13',
        supportedTypes: ['invoice', 'quotation']
      },
      // Recibos - novos templates locais
      {
        id: 'receipt-1',
        name: 'Recibo Clássico',
        description: 'Recibo simples e elegante',
        thumbnail: 'bg-gradient-to-br from-yellow-50 to-orange-100',
        templateType: 'default',
        imageUrl: '/receipt1.JPG',
        backendId: 'template-receipt-1',
        supportedTypes: ['receipt']
      },
      {
        id: 'receipt-2',
        name: 'Recibo Premium',
        description: 'Recibo com estilo premium',
        thumbnail: 'bg-gradient-to-br from-indigo-50 to-purple-100',
        templateType: 'detailed',
        imageUrl: '/receipt2.JPG',
        backendId: 'template-receipt-2',
        supportedTypes: ['receipt']
      },
      {
        id: 'receipt-3',
        name: 'Térmico Moderno Mono',
        description: 'Talão 80mm monoespaçado, estilo caixa registadora',
        thumbnail: 'bg-gradient-to-br from-gray-100 to-gray-300',
        templateType: 'minimal',
        imageUrl: '/receipt3.jpg',
        backendId: 'template-receipt-3',
        supportedTypes: ['receipt']
      },
      {
        id: 'receipt-4',
        name: 'Térmico Boutique',
        description: 'Talão 80mm arredondado em tons pastel',
        thumbnail: 'bg-gradient-to-br from-pink-50 to-teal-100',
        templateType: 'default',
        imageUrl: '/receipt4.jpg',
        backendId: 'template-receipt-4',
        supportedTypes: ['receipt']
      },
      {
        id: 'receipt-5',
        name: 'Térmico Ledger Compacto',
        description: 'Talão 80mm denso, ideal para alto volume',
        thumbnail: 'bg-gradient-to-br from-stone-100 to-stone-300',
        templateType: 'minimal',
        imageUrl: '/receipt5.jpg',
        backendId: 'template-receipt-5',
        supportedTypes: ['receipt']
      },
      {
        id: 'receipt-6',
        name: 'Mini 58 Simples',
        description: 'Talão 58mm ultra-compacto para impressoras pequenas',
        thumbnail: 'bg-gradient-to-br from-gray-50 to-gray-200',
        templateType: 'minimal',
        imageUrl: '/receipt6.jpg',
        backendId: 'template-receipt-6',
        supportedTypes: ['receipt']
      },
      {
        id: 'receipt-7',
        name: 'Mini 58 Elegante',
        description: 'Talão 58mm com cabeçalho colorido',
        thumbnail: 'bg-gradient-to-br from-emerald-50 to-teal-100',
        templateType: 'default',
        imageUrl: '/receipt7.jpg',
        backendId: 'template-receipt-7',
        supportedTypes: ['receipt']
      },
      {
        id: 'receipt-8',
        name: 'Meia-Folha Profissional',
        description: 'Recibo A5 formal, tipo mini-fatura',
        thumbnail: 'bg-gradient-to-br from-blue-50 to-indigo-100',
        templateType: 'detailed',
        imageUrl: '/receipt8.jpg',
        backendId: 'template-receipt-8',
        supportedTypes: ['receipt']
      },
      {
        id: 'receipt-9',
        name: 'Meia-Folha Moderno',
        description: 'Recibo A5 com cabeçalho arredondado moderno',
        thumbnail: 'bg-gradient-to-br from-violet-100 to-purple-200',
        templateType: 'default',
        imageUrl: '/receipt9.jpg',
        backendId: 'template-receipt-9',
        supportedTypes: ['receipt']
      },
      {
        id: 'receipt-10',
        name: 'Recibo A4 Corporativo',
        description: 'Recibo A4 completo em navy e dourado',
        thumbnail: 'bg-gradient-to-br from-blue-100 to-yellow-100',
        templateType: 'detailed',
        imageUrl: '/receipt10.jpg',
        backendId: 'template-receipt-10',
        supportedTypes: ['receipt']
      },
      {
        id: 'receipt-11',
        name: 'Recibo A4 Premium com Assinatura',
        description: 'Moldura premium com selo e dupla assinatura',
        premium: true,
        thumbnail: 'bg-gradient-to-br from-amber-100 to-yellow-200',
        templateType: 'detailed',
        imageUrl: '/receipt11.jpg',
        backendId: 'template-receipt-11',
        supportedTypes: ['receipt']
      },
      {
        id: 'receipt-12',
        name: 'Recibo A4 Minimalista',
        description: 'Recibo A4 limpo, sem ornamentos',
        thumbnail: 'bg-gradient-to-br from-teal-50 to-emerald-100',
        templateType: 'minimal',
        imageUrl: '/receipt12.jpg',
        backendId: 'template-receipt-12',
        supportedTypes: ['receipt']
      }
    ];

    this.metrics.setActiveTemplates(this.templates.length);
  }

  /**
   * Método principal para renderizar templates - suporta ambos os tipos
   */
  async renderTemplate(
    templateId: string, 
    documentData: DocumentData,
    options: RenderOptions = {}
  ): Promise<TemplateRenderState> {
    const { signal, useCache = true, documentType = 'invoice' } = options;

    if (!documentData) {
      const docType = documentType === 'invoice' ? 'fatura' : (documentType === 'quotation' ? 'cotação' : 'recibo');
      return { html: '', isLoading: false, error: `Dados da ${docType} não fornecidos` };
    }

    // Cancelar requisição anterior para o mesmo template
    this.cancelPreviousRender(templateId);

    const template = this.getTemplateById(templateId);
    if (!template) {
      return { 
        html: '', 
        isLoading: false, 
        error: `Template não encontrado: ${templateId}` 
      };
    }

    // Verificar se o template suporta o tipo de documento
    if (!this.supportsDocumentType(templateId, documentType)) {
      const docType = documentType === 'invoice' ? 'faturas' : (documentType === 'quotation' ? 'cotações' : 'recibos');
      return {
        html: '',
        isLoading: false,
        error: `Template "${template.name}" não suporta ${docType}`
      };
    }

    const backendId = template.backendId;
    const dataHash = generateDataHash({ ...documentData, documentType });

    // Verificar cache primeiro
    if (useCache) {
      const cached = await this.cache.getRenderedTemplate(backendId, dataHash);
      if (cached) {
        this.metrics.trackCacheHit(templateId, 'render');
        return { html: cached, isLoading: false, error: null };
      }
      this.metrics.trackCacheMiss(templateId, 'render');
    }

    const trackRender = this.metrics.trackRenderStart(templateId);

    try {
      const controller = new AbortController();
      this.abortControllers.set(templateId, controller);
      
      // API call com tipo de documento
      const response = await fetch(`/api/templates/render?id=${backendId}&tipo=${documentType}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Request-ID': this.generateRequestId(),
          'X-Document-Type': documentType
        },
        body: JSON.stringify({ 
          documentData: {
            ...documentData,
            tipoDocumento: documentType
          }
        }),
        signal: signal || controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const html = await response.text();
      
      // Cache do resultado
      if (useCache) {
        await this.cache.setRenderedTemplate(backendId, dataHash, html);
      }

      trackRender();
      return { html, isLoading: false, error: null };

    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { html: '', isLoading: false, error: null };
      }

      this.metrics.trackRenderError(templateId, err.message);
      return {
        html: this.getErrorFallbackHtml(err.message, documentType),
        isLoading: false,
        error: err.message
      };
    } finally {
      this.abortControllers.delete(templateId);
    }
  }

  /**
   * Método específico para faturas (backward compatibility)
   */
  async renderInvoiceTemplate(
    templateId: string, 
    invoiceData: InvoiceData,
    options: Omit<RenderOptions, 'documentType'> = {}
  ): Promise<TemplateRenderState> {
    return this.renderTemplate(templateId, invoiceData, {
      ...options,
      documentType: 'invoice'
    });
  }

  /**
   * Método específico para cotações
   */
  async renderQuotationTemplate(
    templateId: string, 
    quotationData: QuotationData,
    options: Omit<RenderOptions, 'documentType'> = {}
  ): Promise<TemplateRenderState> {
    return this.renderTemplate(templateId, quotationData, {
      ...options,
      documentType: 'quotation'
    });
  }

  cancelPreviousRender(templateId: string): void {
    const controller = this.abortControllers.get(templateId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(templateId);
    }
  }

  async preloadTemplates(documentType?: DocumentType): Promise<void> {
    const templatesToPreload = documentType 
      ? this.templates.filter(t => !t.supportedTypes || t.supportedTypes.includes(documentType))
      : this.templates;

    const preloadPromises = templatesToPreload.map(async (template) => {
      const backendId = template.backendId;
      const type = documentType || (template.supportedTypes?.[0] || 'invoice');
      
      try {
        const response = await fetch(`/api/templates/render?id=${backendId}&tipo=${type}`, {
          method: 'HEAD',
          headers: { 
            'X-Preload': 'true',
            'X-Document-Type': type
          }
        });
        
        if (response.ok) {
          console.log(`Preloaded template: ${template.id} for ${type}`);
        }
      } catch (error) {
        console.warn(`Failed to preload template ${template.id}:`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
  }

  async warmupCache(documentType?: DocumentType): Promise<void> {
    const templatesToWarmup = documentType 
      ? this.templates.filter(t => !t.supportedTypes || t.supportedTypes.includes(documentType))
      : this.templates;

    const warmupPromises = templatesToWarmup.map(async (template) => {
      const backendId = template.backendId;
      const type = documentType || (template.supportedTypes?.[0] || 'invoice');
      
      try {
        const emptyData = type === 'invoice' 
          ? this.getEmptyInvoiceData()
          : this.getEmptyQuotationData();

        const response = await fetch(`/api/templates/render?id=${backendId}&tipo=${type}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Document-Type': type
          },
          body: JSON.stringify({ 
            documentData: {
              ...emptyData,
              tipoDocumento: type
            }
          }),
        });

        if (response.ok) {
          const html = await response.text();
          const dataHash = generateDataHash({ ...emptyData, documentType: type });
          await this.cache.setRenderedTemplate(backendId, dataHash, html);
        }
      } catch (error) {
        console.warn(`Failed to warmup cache for ${template.id}:`, error);
      }
    });

    await Promise.allSettled(warmupPromises);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getEmptyInvoiceData(): Partial<InvoiceData> {
    return {
      formData: {
        tipo: 'fatura',
        emitente: { 
          nomeEmpresa: '',
          documento: '',
          pais: '',
          cidade: '',
          bairro: '',
          email: '',
          telefone: ''
        },
        destinatario: { 
          nomeCompleto: '',
          documento: '',
          pais: '',
          cidade: '',
          bairro: '',
          email: '',
          telefone: ''
        },
        faturaNumero: '',
        dataFatura: '',
        dataVencimento: '',
        moeda: 'MZN',
        termos: '',
        desconto: 0,
        tipoDesconto: 'fixed'
      },
      items: [],
      totais: { 
        subtotal: 0, 
        totalTaxas: 0, 
        totalFinal: 0, 
        taxasDetalhadas: [],
        desconto: 0
      }
    };
  }

  private getEmptyReceiptData(): Partial<InvoiceData> {
    return {
      formData: {
        tipo: 'recibo' as any,
        emitente: { 
          nomeEmpresa: '',
          documento: '',
          pais: '',
          cidade: '',
          bairro: '',
          email: '',
          telefone: ''
        },
        destinatario: { 
          nomeCompleto: '',
          documento: '',
          pais: '',
          cidade: '',
          bairro: '',
          email: '',
          telefone: ''
        },
        reciboNumero: '',
        dataFatura: '',
        dataRecebimento: '',
        moeda: 'MZN',
        termos: '',
        desconto: 0,
        tipoDesconto: 'fixed',
        formaPagamento: ''
      },
      items: [],
      totais: { 
        subtotal: 0, 
        totalTaxas: 0, 
        totalFinal: 0, 
        taxasDetalhadas: [],
        desconto: 0
      }
    };
  }

  private getEmptyQuotationData(): Partial<QuotationData> {
    return {
      formData: {
        tipo: 'cotacao',
        emitente: { 
          nomeEmpresa: '',
          documento: '',
          pais: '',
          cidade: '',
          bairro: '',
          email: '',
          telefone: ''
        },
        destinatario: { 
          nomeCompleto: '',
          documento: '',
          pais: '',
          cidade: '',
          bairro: '',
          email: '',
          telefone: ''
        },
        cotacaoNumero: '',
        dataFatura: '',
        dataVencimento: '',
        moeda: 'MZN',
        metodoPagamento: '',
        termos: '',
        desconto: 0,
        tipoDesconto: 'fixed',
        validezCotacao: undefined
      },
      items: [],
      totais: { 
        subtotal: 0, 
        totalTaxas: 0, 
        totalFinal: 0, 
        taxasDetalhadas: [],
        desconto: 0
      }
    };
  }

  private getErrorFallbackHtml(error: string, documentType: DocumentType): string {
    const documentName = documentType === 'invoice' ? 'fatura' : (documentType === 'quotation' ? 'cotação' : 'recibo');
    return `
      <div class="p-4 text-red-500 text-center">
        <p>Erro ao carregar o template da ${documentName}:</p>
        <p class="text-sm">${error}</p>
        <p class="text-sm mt-2">Recarregue a página ou tente outro modelo.</p>
      </div>
    `;
  }

  // Métodos de consulta de templates
  getTemplates(documentType?: DocumentType): TemplateWithBackend[] {
    if (!documentType) {
      return this.templates;
    }
    return this.templates.filter(t => 
      !t.supportedTypes || t.supportedTypes.includes(documentType)
    );
  }

  getInvoiceTemplates(): TemplateWithBackend[] {
    return this.getTemplates('invoice');
  }

  getQuotationTemplates(): TemplateWithBackend[] {
    return this.getTemplates('quotation');
  }

  getTemplateById(id: string): TemplateWithBackend | undefined {
    return this.templates.find(t => t.id === id);
  }

  getTemplateIndex(id: string): number {
    return this.templates.findIndex(t => t.id === id);
  }

  getNextTemplate(currentId: string, documentType?: DocumentType): TemplateWithBackend {
    const filteredTemplates = documentType 
      ? this.getTemplates(documentType)
      : this.templates;
    
    const currentIndex = filteredTemplates.findIndex(t => t.id === currentId);
    const nextIndex = (currentIndex + 1) % filteredTemplates.length;
    return filteredTemplates[nextIndex];
  }

  getPreviousTemplate(currentId: string, documentType?: DocumentType): TemplateWithBackend {
    const filteredTemplates = documentType 
      ? this.getTemplates(documentType)
      : this.templates;
    
    const currentIndex = filteredTemplates.findIndex(t => t.id === currentId);
    const prevIndex = (currentIndex - 1 + filteredTemplates.length) % filteredTemplates.length;
    return filteredTemplates[prevIndex];
  }

  getNavigationState(currentId: string, documentType?: DocumentType): TemplateNavigation {
    const filteredTemplates = documentType 
      ? this.getTemplates(documentType)
      : this.templates;
    
    const currentIndex = filteredTemplates.findIndex(t => t.id === currentId);
    return {
      currentIndex,
      total: filteredTemplates.length,
      hasNext: currentIndex < filteredTemplates.length - 1,
      hasPrev: currentIndex > 0
    };
  }

  // Métodos para verificar suporte
  supportsDocumentType(templateId: string, documentType: DocumentType): boolean {
    const template = this.getTemplateById(templateId);
    return template ? (!template.supportedTypes || template.supportedTypes.includes(documentType)) : false;
  }

  getSupportedTypes(templateId: string): DocumentType[] {
    const template = this.getTemplateById(templateId);
    return template?.supportedTypes || ['invoice', 'quotation'];
  }
}