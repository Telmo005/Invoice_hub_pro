import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { TemplateRenderState, ZoomControls } from '@/types/template-types';
import { InvoiceData, TipoDocumento } from '@/types/invoice-types';
import { TemplateService, DocumentType } from '@/services/templateService';
import { useDebounce } from '@/app/hooks/panels/useDebounce';
import { useThrottle } from '@/app/hooks/panels/useThrottle';

interface UseTemplateManagerProps {
  invoiceData: InvoiceData;
  tipo: TipoDocumento; // 'fatura' ou 'cotacao' - NOVO PROP
  onHtmlRendered?: (html: string) => void;
  options?: {
    debounceMs?: number;
    useCache?: boolean;
    preload?: boolean;
    maxRetries?: number;
    timeoutMs?: number;
  };
}

interface RenderOptions {
  signal?: AbortSignal;
  useCache?: boolean;
  retryCount?: number;
}

// Constants for better maintainability
const DEFAULT_OPTIONS = {
  debounceMs: 300,
  useCache: true,
  preload: true,
  maxRetries: 3,
  timeoutMs: 30000,
} as const;

const ZOOM_CONFIG = {
  MIN: 20,
  MAX: 150,
  STEP: 10,
  DEFAULT: 100,
  THROTTLE_MS: 100,
} as const;

// Mapeamento de TipoDocumento para DocumentType do Service
const mapTipoToDocumentType = (tipo: TipoDocumento): DocumentType => {
  return tipo === 'cotacao' ? 'quotation' : 'invoice';
};

export const useTemplateManager = ({ 
  invoiceData, 
  tipo, // ← NOVO PARÂMETRO
  onHtmlRendered, 
  options = {} 
}: UseTemplateManagerProps) => {
  const {
    debounceMs = DEFAULT_OPTIONS.debounceMs,
    useCache = DEFAULT_OPTIONS.useCache,
    preload = DEFAULT_OPTIONS.preload,
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    timeoutMs = DEFAULT_OPTIONS.timeoutMs,
  } = options;

  // Converter TipoDocumento para DocumentType
  const documentType = useMemo(() => mapTipoToDocumentType(tipo), [tipo]);

  // Memoized service instance
  const templateService = useMemo(() => TemplateService.getInstance(), []);
  
  // Refs for cleanup and state tracking - CORRIGIDO
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef<Map<string, number>>(new Map());
  
  // State management
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    // Filtra templates pelo tipo especificado
    const templates = templateService.getTemplates(documentType);
    return templates[0]?.id || '';
  });
  
  const [renderState, setRenderState] = useState<TemplateRenderState>({
    html: '',
    isLoading: false,
    error: null
  });
  
  const [zoomLevel, setZoomLevel] = useState<number>(ZOOM_CONFIG.DEFAULT);

  // Memoized computations - FILTRANDO TEMPLATES POR TIPO
  const templates = useMemo(() => 
    templateService.getTemplates(documentType), 
    [templateService, documentType]
  );
  
  const selectedTemplate = useMemo(() => 
    templateService.getTemplateById(selectedTemplateId) || templates[0],
    [selectedTemplateId, templateService, templates]
  );

  const navigation = useMemo(() => {
    const currentIndex = templates.findIndex(t => t.id === selectedTemplateId);
    return {
      currentIndex,
      total: templates.length,
      hasNext: currentIndex < templates.length - 1,
      hasPrev: currentIndex > 0
    };
  }, [selectedTemplateId, templates]);

  const zoomControls: ZoomControls = useMemo(() => ({
    level: zoomLevel,
    min: ZOOM_CONFIG.MIN,
    max: ZOOM_CONFIG.MAX,
    step: ZOOM_CONFIG.STEP,
    default: ZOOM_CONFIG.DEFAULT
  }), [zoomLevel]);

  // Debounced data para evitar renders desnecessários
  const debouncedInvoiceData = useDebounce(invoiceData, debounceMs);

  // Safe state updates
  const safeSetRenderState = useCallback((updater: (prev: TemplateRenderState) => TemplateRenderState) => {
    if (isMountedRef.current) {
      setRenderState(updater);
    }
  }, []);

  // Enhanced template rendering with retry logic and timeout - CORRIGIDO
  const fetchRenderedTemplate = useCallback(async (
    templateId: string, 
    data: InvoiceData,
    options: RenderOptions = {}
  ): Promise<void> => {
    const { signal, useCache: cacheFlag = useCache, retryCount = 0 } = options;
    
    // Early validation
    if (!templateId || !data) {
      safeSetRenderState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Template ID or invoice data is missing'
      }));
      return;
    }

    // Reset retry count on new template or data change
    const cacheKey = `${templateId}-${documentType}-${JSON.stringify(data)}`;
    if (retryCount === 0) {
      retryCountRef.current.set(cacheKey, 0);
    }

    safeSetRenderState(prev => ({ ...prev, isLoading: true, error: null }));

    // DECLARE timeoutId AQUI - FORA DO TRY (CORREÇÃO)
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      const timeoutController = new AbortController();
      timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, timeoutMs);

      const combinedSignal = (() => {
        if (signal?.aborted) return signal;
        if (timeoutController.signal.aborted) return timeoutController.signal;
        
        const controller = new AbortController();
        signal?.addEventListener('abort', () => controller.abort());
        timeoutController.signal.addEventListener('abort', () => controller.abort());
        return controller.signal;
      })();

      // CHAMADA ATUALIZADA: Passando documentType para o TemplateService
      const result = await templateService.renderTemplate(templateId, data, {
        signal: combinedSignal,
        useCache: cacheFlag,
        documentType 
      });

      clearTimeout(timeoutId);
      timeoutId = null;

      // Clear retry count on success
      retryCountRef.current.delete(cacheKey);

      safeSetRenderState(prev => ({
        ...prev,
        ...result,
        isLoading: false
      }));

      if (result.html && !result.error && isMountedRef.current) {
        onHtmlRendered?.(result.html);
      }

    } catch (error: unknown) {
      // AGORA timeoutId ESTÁ DISPONÍVEL NO CATCH (CORREÇÃO)
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Handle specific error types
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // Silent abort, no state update needed
          return;
        }

        const currentRetries = retryCountRef.current.get(cacheKey) || 0;
        
        if (currentRetries < maxRetries && isMountedRef.current) {
          // Retry logic
          retryCountRef.current.set(cacheKey, currentRetries + 1);
          
          setTimeout(() => {
            if (isMountedRef.current) {
              fetchRenderedTemplate(templateId, data, {
                ...options,
                retryCount: currentRetries + 1
              });
            }
          }, Math.min(1000 * Math.pow(2, currentRetries), 10000));
          
          return;
        }

        safeSetRenderState(prev => ({
          ...prev,
          isLoading: false,
          error: `Render failed: ${error.message}`
        }));
      } else {
        safeSetRenderState(prev => ({
          ...prev,
          isLoading: false,
          error: 'An unknown error occurred during template rendering'
        }));
      }
    }
  }, [
    templateService, 
    useCache, 
    onHtmlRendered, 
    maxRetries, 
    timeoutMs, 
    safeSetRenderState,
    documentType 
  ]);

  // Effect para renderização automática com dados debounced
  useEffect(() => {
    if (selectedTemplateId && debouncedInvoiceData) {
      // Cancelar requisição anterior
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('New request initiated');
      }

      abortControllerRef.current = new AbortController();
      
      fetchRenderedTemplate(
        selectedTemplateId, 
        debouncedInvoiceData, 
        { signal: abortControllerRef.current.signal }
      );
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('Component unmounting or dependencies changed');
      }
    };
  }, [selectedTemplateId, debouncedInvoiceData, fetchRenderedTemplate]);

  // Preload de templates na montagem - ATUALIZADO para usar documentType
  useEffect(() => {
    if (preload) {
      templateService.preloadTemplates(documentType).catch((error: unknown) => {
        console.error('Template preload failed:', error);
      });
    }
  }, [preload, templateService, documentType]); // ← NOVA DEPENDÊNCIA

  // Template navigation handlers
  const handleTemplateChange = useCallback((direction: 'next' | 'prev') => {
    const currentIndex = templates.findIndex(t => t.id === selectedTemplateId);
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % templates.length
      : (currentIndex - 1 + templates.length) % templates.length;
    
    const newTemplate = templates[newIndex];
    
    if (newTemplate) {
      setSelectedTemplateId(newTemplate.id);
      setZoomLevel(ZOOM_CONFIG.DEFAULT);
    }
  }, [selectedTemplateId, templates]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    if (templates.some(template => template.id === templateId)) {
      setSelectedTemplateId(templateId);
      setZoomLevel(ZOOM_CONFIG.DEFAULT);
    } else {
      console.warn(`Template with ID ${templateId} not found for type: ${tipo}`);
    }
  }, [templates, tipo]); // ← NOVA DEPENDÊNCIA

  // Zoom handlers with throttling
  const throttledZoomIn = useThrottle(() => {
    setZoomLevel(prev => Math.min(prev + ZOOM_CONFIG.STEP, ZOOM_CONFIG.MAX));
  }, ZOOM_CONFIG.THROTTLE_MS);

  const throttledZoomOut = useThrottle(() => {
    setZoomLevel(prev => Math.max(prev - ZOOM_CONFIG.STEP, ZOOM_CONFIG.MIN));
  }, ZOOM_CONFIG.THROTTLE_MS);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(ZOOM_CONFIG.DEFAULT);
  }, []);

  // Computed values
  const isZoomInDisabled = zoomLevel >= ZOOM_CONFIG.MAX;
  const isZoomOutDisabled = zoomLevel <= ZOOM_CONFIG.MIN;

  // Cleanup effect
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('Component unmounting');
      }
      
      // Clear any pending retries
      // eslint-disable-next-line react-hooks/exhaustive-deps
      retryCountRef.current?.clear();
    };
  }, []);

  // Memoized return value for stable references
  return useMemo(() => ({
    // State
    selectedTemplateId,
    selectedTemplate,
    renderState,
    zoomLevel,
    templates,
    navigation,
    zoomControls,
    
    // Actions
    handleTemplateChange,
    handleTemplateSelect,
    handleZoomIn: throttledZoomIn,
    handleZoomOut: throttledZoomOut,
    handleZoomReset,
    
    // Computed
    isZoomInDisabled,
    isZoomOutDisabled,
    
    // Service methods
    fetchRenderedTemplate: (templateId: string) => 
      fetchRenderedTemplate(templateId, invoiceData)
  }), [
    selectedTemplateId,
    selectedTemplate,
    renderState,
    zoomLevel,
    templates,
    navigation,
    zoomControls,
    handleTemplateChange,
    handleTemplateSelect,
    throttledZoomIn,
    throttledZoomOut,
    handleZoomReset,
    isZoomInDisabled,
    isZoomOutDisabled,
    fetchRenderedTemplate,
    invoiceData
  ]);
};