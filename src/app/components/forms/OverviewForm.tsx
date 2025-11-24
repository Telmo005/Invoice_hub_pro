'use client';
import { useRouter } from 'next/navigation';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  FiFileText,
  FiSearch,
  FiEye,
  FiFilter,
  FiActivity,
  FiChevronDown,
  FiChevronUp,
  FiAlertCircle,
  FiTrash2,
  
  FiCheck,
  FiArrowRight,
  FiArrowLeft,
  FiLoader,
  FiMinus,
  FiPlus,
  FiDownload,
  FiExternalLink
} from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import { Roboto } from 'next/font/google';
import { useList } from '@/app/hooks/document/useList';
import { useDelete } from '@/app/hooks/document/useDelete';
import { useDocumentManager } from '@/app/hooks/document/useDocumentManager';
import { FaInfoCircle, FaSpinner } from 'react-icons/fa';

// Font configuration
const roboto = Roboto({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  variable: '--font-roboto',
});

type DocumentType = 'faturas' | 'cotacoes' | 'recibos';
type DocumentStatus = 'rascunho' | 'emitida' | 'paga' | 'cancelada' | 'expirada' | 'todos';

interface OverviewDocument {
  id: string;
  numero: string;
  tipo: 'fatura' | 'cotacao' | 'recibo';
  status: string;
  emitente: string;
  destinatario: string;
  data_emissao: string;
  data_vencimento: string;
  valor_total: number;
  moeda: string;
  itens_count: number;
  pagamento_status: string | null;
}

// Configuração de status
const statusConfig = {
  rascunho: { color: 'text-gray-600', bg: 'bg-gray-50', text: 'Rascunho' },
  emitida: { color: 'text-blue-600', bg: 'bg-blue-50', text: 'Emitida' },
  paga: { color: 'text-green-600', bg: 'bg-green-50', text: 'Paga' },
  cancelada: { color: 'text-red-600', bg: 'bg-red-50', text: 'Cancelada' },
  expirada: { color: 'text-orange-600', bg: 'bg-orange-50', text: 'Expirada' },
  pendente: { color: 'text-yellow-600', bg: 'bg-yellow-50', text: 'Pendente' },
  aguardando_documento: { color: 'text-purple-700', bg: 'bg-purple-100', text: 'Fila (Aguardando)' },
  pago: { color: 'text-green-600', bg: 'bg-green-50', text: 'Pago' },
  falhado: { color: 'text-red-700', bg: 'bg-red-100', text: 'Falhou' },
  todos: { color: 'text-gray-600', bg: 'bg-gray-50', text: 'Todos' },
};

const formatCurrency = (amount: number, currency: string): string =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: currency }).format(amount);

const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

// ✅ Hook para buscar HTML do documento
const useDocumentHtml = () => {
  const [documentHtml, setDocumentHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocumentHtml = useCallback(async (documentId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/document/html?id=${documentId}`);

      if (!response.ok) {
        throw new Error('Não foi possível carregar o documento');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Erro ao carregar documento');
      }

      setDocumentHtml(data.data.html);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setDocumentHtml(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearDocumentHtml = useCallback(() => {
    setDocumentHtml(null);
    setError(null);
  }, []);

  return {
    documentHtml,
    isLoading,
    error,
    fetchDocumentHtml,
    clearDocumentHtml
  };
};

// ✅ Template PDF otimizado
const getPdfTemplate = (htmlContent: string, documentData: any, documentNumber?: string): string => {
  const documentType = documentData?.tipo === 'fatura'
    ? 'Fatura'
    : documentData?.tipo === 'cotacao'
      ? 'Cotação'
      : 'Recibo';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${documentType} ${documentNumber || documentData?.numero}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
      font-family: 'Arial', 'Helvetica', sans-serif;
    }
    
    body { 
      background: white !important;
      color: #000 !important;
      line-height: 1.4;
      padding: 5mm;
      margin: 0 !important;
    }
    
    @media print {
      @page {
        margin: 5mm !important;
        size: A4;
        margin-header: 0 !important;
        margin-footer: 0 !important;
        marks: none !important;
      }
      
      body { 
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
      }
      
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      .header, .footer, #header, #footer, .print-header, .print-footer {
        display: none !important;
      }
      /* Manter cabeçalhos específicos de templates */
      .receipt-header, .invoice-header, .quotation-header { display: block !important; }
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: avoid;
    }
    
    th, td {
      padding: 8px 12px;
      border: 1px solid #ddd;
    }
    
    .no-break {
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  ${htmlContent}
  
  <script>
    setTimeout(() => window.print(), 500);
    window.onbeforeunload = () => "PDF gerado com sucesso? Pode fechar esta janela.";
  </script>
</body>
</html>`;
};

// ✅ Componente de Preview Modal Melhorado
interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentData: OverviewDocument | null;
  documentHtml: string | null;
  isLoading: boolean;
  error: string | null;
  onDownload: (documentNumber?: string) => void;
  isGeneratingPdf: boolean;
}

const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  documentData,
  documentHtml,
  isLoading,
  error,
  onDownload,
  isGeneratingPdf
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isReusing, setIsReusing] = useState<boolean>(false);

  const handleZoomIn = () => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10));
  const handleZoomOut = () => setZoom((z) => Math.max(0.3, Math.round((z - 0.1) * 10) / 10));
  const handleZoomReset = () => setZoom(1);

  useEffect(() => {
    if (!documentHtml || !contentRef.current) return;

    const root = contentRef.current;
    const selectors = ['.t1-isolated', '.invoice-template-isolated', '.t3-isolated'];

    selectors.forEach((sel) => {
      root.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        // Override template enforced styles with inline important rules
        el.style.setProperty('background', 'transparent', 'important');
        el.style.setProperty('box-shadow', 'none', 'important');
        el.style.setProperty('width', 'auto', 'important');
        el.style.setProperty('max-width', '100%', 'important');
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('min-width', '0', 'important');
        el.style.setProperty('min-height', '0', 'important');
        el.style.setProperty('padding', '0', 'important');
        el.style.setProperty('margin', '0 auto', 'important');
        el.style.setProperty('transform', 'none', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
      });
    });

    // Also make sure inner containers don't force large paddings
    root.querySelectorAll<HTMLElement>('.invoice-container, .invoice, .invoice-container').forEach((c) => {
      c.style.setProperty('padding', '0', 'important');
      c.style.setProperty('box-shadow', 'none', 'important');
      c.style.setProperty('max-width', '100%', 'important');
    });
  }, [documentHtml]);

  if (!isOpen) return null;
  // Definir tipo do documento para o header do modal
  const documentType = documentData?.tipo === 'fatura'
    ? 'Fatura'
    : documentData?.tipo === 'cotacao'
      ? 'Cotação'
      : 'Recibo';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-xl"
      >
        {/* Header do Modal */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${documentData?.tipo === 'fatura'
              ? 'bg-blue-50 text-blue-600'
              : documentData?.tipo === 'cotacao'
                ? 'bg-purple-50 text-purple-600'
                : 'bg-green-50 text-green-600'}`}>
              <FiFileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-800">
                {documentType} - {documentData?.numero}
              </h3>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <span>Cliente: {documentData?.destinatario}</span>
                <span>•</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[(documentData?.status as keyof typeof statusConfig) || 'todos'].color
                  } ${statusConfig[(documentData?.status as keyof typeof statusConfig) || 'todos'].bg
                  }`}>
                  {statusConfig[(documentData?.status as keyof typeof statusConfig) || 'todos'].text}
                </span>

              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 sm:mt-0">
            {/* Botões de Ação */}
            <button
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              onClick={() => onDownload(documentData?.numero)}
              disabled={isGeneratingPdf || !documentHtml}
              title="Download PDF"
            >
              {isGeneratingPdf ? (
                <FaSpinner className="animate-spin h-4 w-4" />
              ) : (
                <FiDownload className="h-4 w-4" />
              )}
              <span className="hidden md:inline">{isGeneratingPdf ? 'Gerando PDF...' : 'Download'}</span>
            </button>
            {/* Reutilizar dados */}
            {documentData && (
              <button
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-md font-medium text-sm transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                title="Reutilizar dados deste documento"
                disabled={isReusing}
                onClick={async () => {
                  setIsReusing(true);
                  try {
                    const resp = await fetch(`/api/document/detail/${documentData.id}`);
                    if (!resp.ok) throw new Error('Falha ao obter dados do documento');
                    const json = await resp.json();
                    if (json?.success && json.data?.invoiceData) {
                      sessionStorage.setItem('clonedInvoiceData', JSON.stringify(json.data.invoiceData));
                      const tipo = json.data.invoiceData.tipo;
                      if (tipo === 'fatura') window.location.href = '/invoices/new';
                      else if (tipo === 'cotacao') window.location.href = '/quotations/new';
                      else if (tipo === 'recibo') window.location.href = '/receipts/new';
                      return; // mantém overlay até navegação
                    }
                  } catch (_e) {
                    setIsReusing(false);
                  }
                }}
              >
                {isReusing ? (
                  <>
                    <FaSpinner className="animate-spin h-4 w-4" />
                    <span className="hidden md:inline">A preparar...</span>
                  </>
                ) : (
                  <>
                    <FiExternalLink className="h-4 w-4" />
                    <span className="hidden md:inline">Reutilizar</span>
                  </>
                )}
              </button>
            )}

            {/* Zoom controls */}
            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={handleZoomOut}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                aria-label="Diminuir zoom"
                title="Diminuir zoom"
              >
                <FiMinus className="h-4 w-4 text-gray-700" />
              </button>
              <button
                onClick={handleZoomReset}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm hidden sm:inline"
                aria-label="Reset zoom"
                title="Resetar zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                aria-label="Aumentar zoom"
                title="Aumentar zoom"
              >
                <FiPlus className="h-4 w-4 text-gray-700" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors ml-2"
              aria-label="Fechar pré-visualização"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Conteúdo do Documento */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FiLoader className="animate-spin text-blue-500 text-2xl mb-3 mx-auto" />
                <p className="text-gray-600 font-medium">A carregar documento...</p>
                <p className="text-gray-500 text-sm mt-1">Por favor aguarde</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center max-w-md">
                <FiAlertCircle className="text-red-500 text-3xl mb-3 mx-auto" />
                <p className="text-red-600 font-medium mb-2">Erro ao carregar documento</p>
                <p className="text-gray-600 text-sm mb-4">{error}</p>
                <button
                  onClick={() => documentData && onDownload(documentData.numero)}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm"
                >
                  Tentar Download Direto
                </button>
              </div>
            </div>
          )}

          {documentHtml && !isLoading && (
            <div className="mx-auto max-w-4xl">
              <div ref={contentRef} className="overflow-auto w-full" style={{ width: `${100 / (zoom || 1)}%` }}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="origin-top-left"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                >
                  <div dangerouslySetInnerHTML={{ __html: documentHtml }} />
                </motion.div>
              </div>
            </div>
          )}
        </div>

        {/* Footer do Modal */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-sm text-gray-500">
          <div className="flex items-center gap-4">
            <span>Valor: {documentData && formatCurrency(documentData.valor_total, documentData.moeda)}</span>
            <span>Vencimento: {documentData && formatDate(documentData.data_vencimento)}</span>
          </div>
          <div className="flex items-center gap-2">
            <FiExternalLink className="h-4 w-4" />
            <span>Pré-visualização do Documento</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Componentes memoizados
const StatusBadge = React.memo(({ status }: { status: string }) => {
  const config = statusConfig[(status as keyof typeof statusConfig) || 'todos'];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bg}`}>
      {config.text}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

const StatCard = React.memo(({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="bg-white p-4 rounded-lg border border-gray-200 h-full shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 truncate">{title}</p>
        <p className="text-lg font-bold text-gray-800 truncate">{value}</p>
      </div>
    </div>
  </motion.div>
));
StatCard.displayName = 'StatCard';

const QuickActionButton = React.memo(({ title, subtitle, icon, color, onClick }: { title: string; subtitle: string; icon: React.ReactNode; color: string; onClick?: () => void }) => (
  <motion.button
    whileHover={{ scale: 1.02, y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="w-full p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-all text-left bg-white h-full hover:border-blue-200 group"
  >
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="font-semibold text-gray-800 text-sm truncate">{title}</h4>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
      <FiArrowRight className="text-gray-400 group-hover:text-blue-600 transition-colors" />
    </div>
  </motion.button>
));
QuickActionButton.displayName = 'QuickActionButton';

const ProcessingOverlay = React.memo(({ isVisible, message = "Processando..." }: { isVisible: boolean; message?: string }) => {
  if (!isVisible) return null;
  return (
    <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 rounded-lg backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center bg-white p-6 rounded-lg shadow-lg border border-gray-200"
      >
        <FiLoader className="animate-spin text-blue-500 text-2xl mb-3 mx-auto" />
        <p className="text-sm text-gray-600 font-medium">{message}</p>
      </motion.div>
    </div>
  );
});
ProcessingOverlay.displayName = 'ProcessingOverlay';

const NavigationButtons = React.memo(({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  isNavigating
}: {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  isNavigating: boolean;
}) => (
  <div className="mt-6 flex justify-between border-t pt-4">
    {currentStep > 0 && (
      <button
        className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded flex items-center text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        onClick={onPrev}
        disabled={isNavigating}
      >
        {isNavigating ? (
          <FiLoader className="animate-spin mr-2" size={14} />
        ) : (
          <FiArrowLeft className="mr-2" size={14} />
        )}
        {isNavigating ? 'Processando...' : 'Voltar'}
      </button>
    )}
    {currentStep < totalSteps - 1 && (
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded flex items-center text-sm ml-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
        onClick={onNext}
        disabled={isNavigating}
      >
        {isNavigating ? (
          <>
            <FiLoader className="animate-spin mr-2" size={14} />
            Processando...
          </>
        ) : (
          <>
            Próximo <FiArrowRight className="ml-2" size={14} />
          </>
        )}
      </button>
    )}
  </div>
));
NavigationButtons.displayName = 'NavigationButtons';

// Configuração de navegação
const NAVIGATION_SECTIONS = [
  { title: 'Lista de Documentos', icon: '📋' },
  { title: 'Visão Geral', icon: '📊' },
];

export default function DocumentsPage() {
  const router = useRouter();
  const { secureLog, isAuthenticated: _isAuthenticated } = useDocumentManager();

  // Estados de UI
  const [activeTab, setActiveTab] = useState<DocumentType>('faturas');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus>('todos');
  const [dateFilter, setDateFilter] = useState<string>('30');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<OverviewDocument | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string>('Processando...');
  const rootRef = useRef<HTMLDivElement | null>(null);

  // ✅ Estados para o preview
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<OverviewDocument | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [lastOpenedDocument, setLastOpenedDocument] = useState<string | null>(null);

  // ✅ Hook para buscar HTML
  const {
    documentHtml,
    isLoading: isLoadingHtml,
    error: htmlError,
    fetchDocumentHtml,
    clearDocumentHtml
  } = useDocumentHtml();

  // Hooks com segurança
  const {
    documents,
    loading,
    error,
    refetch,
    removeDocument,
    stats
  } = useList({
    tipo: activeTab,
    status: statusFilter,
    search: searchTerm,
    page: 1,
    limit: 50
  });

  const { deleteDocument, isDeleting, error: deleteError } = useDelete();

  // Monitoramento de erros
  useEffect(() => {
    if (deleteError) {
      secureLog('error', 'Erro de eliminação detectado no frontend', {
        error: deleteError
      });
    }
  }, [deleteError, secureLog]);

  // Capturar cliques em qualquer botão para processamento breve caso não haja ação async
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') && !isProcessing && !isNavigating) {
        setIsProcessing(true);
        setTimeout(() => setIsProcessing(false), 400);
      }
    };
    root.addEventListener('click', handler);
    return () => root.removeEventListener('click', handler);
  }, [isProcessing, isNavigating]);

  // Função para refresh da página
  const refreshPage = useCallback(() => {
    secureLog('info', 'Refresh manual da página solicitado');
    setProcessingMessage('A carregar documentos...');
    setIsProcessing(true);
    Promise.resolve(refetch()).finally(() => setIsProcessing(false));
  }, [refetch, secureLog]);

  // Calcular rascunhos em tempo real
  const draftStats = useMemo(() => {
    if (loading || !documents.length) {
      return { draftInvoices: 0, draftQuotes: 0 };
    }
    const draftInvoices = documents.filter(
      doc => doc.tipo === 'fatura' && doc.status === 'rascunho'
    ).length;
    const draftQuotes = documents.filter(
      doc => doc.tipo === 'cotacao' && doc.status === 'rascunho'
    ).length;

    return { draftInvoices, draftQuotes };
  }, [documents, loading]);

  // Filtros locais
  const filteredDocuments = useMemo(() => {
    if (loading) return [];
    const now = new Date();
    let daysToSubtract = 0;
    switch (dateFilter) {
      case '7': daysToSubtract = 7; break;
      case '30': daysToSubtract = 30; break;
      case '90': daysToSubtract = 90; break;
      default: daysToSubtract = 0;
    }
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - daysToSubtract);

    const filtered = documents.filter(doc => {
      const docDate = new Date(doc.data_emissao);
      const isDateMatch = dateFilter === 'all' || docDate >= startDate;
      return isDateMatch;
    });

    return filtered;
  }, [documents, dateFilter, loading]);

  // ✅ FUNÇÃO MELHORADA: Preview com feedback visual
  const handlePreview = useCallback(async (document: OverviewDocument, event?: React.MouseEvent) => {
    // Prevenir múltiplos cliques rápidos
    if (lastOpenedDocument === document.id) {
      return;
    }

    event?.stopPropagation();

    secureLog('info', 'Visualização de documento solicitada', {
      documentId: document.id,
      documentNumber: document.numero,
      type: document.tipo
    });

    setLastOpenedDocument(document.id);
    setSelectedDocument(document);
    setIsPreviewOpen(true);
    setIsProcessing(true);

    // Feedback visual imediato
    if (event?.currentTarget) {
      const element = event.currentTarget as HTMLElement;
      element.style.transform = 'scale(0.98)';
      setTimeout(() => {
        element.style.transform = '';
      }, 150);
    }

    // Buscar HTML do documento
    try {
      await fetchDocumentHtml(document.id);
    } catch (err) {
      secureLog('error', 'Erro ao buscar HTML do documento', {
        documentId: document.id,
        error: err
      });
    }
    setIsProcessing(false);

    // Reset do último documento após 1 segundo
    setTimeout(() => {
      setLastOpenedDocument(null);
    }, 1000);
  }, [fetchDocumentHtml, secureLog, lastOpenedDocument]);

  // ✅ FUNÇÃO MELHORADA: Download com tratamento de erro
  const handleDownload = useCallback(async (documentNumber?: string) => {
    if (!documentHtml || !selectedDocument) {
      secureLog('error', 'Tentativa de download sem HTML ou documento selecionado');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      setIsProcessing(true);

      const pdfWindow = window.open('', '_blank');
      if (!pdfWindow) {
        throw new Error('Permita popups para gerar o PDF.');
      }

      const dynamicDocumentData = {
        id: selectedDocument.numero,
        type: selectedDocument.tipo,
        typeDisplay: selectedDocument.tipo === 'fatura' ? 'Fatura' : 'Cotação',
        client: selectedDocument.destinatario
      };

      const optimizedHtml = getPdfTemplate(documentHtml, dynamicDocumentData, documentNumber);
      pdfWindow.document.write(optimizedHtml);
      pdfWindow.document.close();

      secureLog('info', 'PDF gerado com sucesso', {
        documentId: selectedDocument.id,
        documentNumber: selectedDocument.numero
      });

    } catch (error) {
      secureLog('error', 'Erro ao gerar PDF', {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        documentId: selectedDocument.id
      });

      // Fallback: tentar abrir em nova aba
      const pdfUrl = `/api/document/pdf?id=${selectedDocument.id}`;
      window.open(pdfUrl, '_blank');
    } finally {
      setIsGeneratingPdf(false);
      setIsProcessing(false);
    }
  }, [documentHtml, selectedDocument, secureLog]);

  // (Email sending removed) — kept in codebase intentionally omitted from preview UI.

  // ✅ FUNÇÃO: Fechar Preview
  const handleClosePreview = useCallback(() => {
    secureLog('info', 'Fechando preview de documento');
    setIsPreviewOpen(false);
    setSelectedDocument(null);
    clearDocumentHtml();
    setLastOpenedDocument(null);
  }, [clearDocumentHtml, secureLog]);

  // Funções de navegação
  const nextSection = useCallback(async () => {
    secureLog('info', 'Navegação para próxima seção', {
      fromSection: currentSection,
      toSection: currentSection + 1
    });

    setIsNavigating(true);
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setCurrentSection(prev => Math.min(prev + 1, NAVIGATION_SECTIONS.length - 1));
    setIsNavigating(false);
    setIsProcessing(false);
  }, [currentSection, secureLog]);

  const prevSection = useCallback(async () => {
    secureLog('info', 'Navegação para seção anterior', {
      fromSection: currentSection,
      toSection: currentSection - 1
    });

    setIsNavigating(true);
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setCurrentSection(prev => Math.max(prev - 1, 0));
    setIsNavigating(false);
    setIsProcessing(false);
  }, [currentSection, secureLog]);

  const handleSectionClick = useCallback((sectionIndex: number) => {
    secureLog('info', 'Clique direto na seção', {
      fromSection: currentSection,
      toSection: sectionIndex
    });
    setCurrentSection(sectionIndex);
    setIsProcessing(true);
    setTimeout(() => setIsProcessing(false), 250);
  }, [currentSection, secureLog]);

  // Funções de UI
  const handleNewDocument = useCallback((type: 'fatura' | 'cotacao' | 'recibo') => {
    secureLog('info', 'Criação de novo documento solicitada', { type });
    setIsProcessing(true);
    if (type === 'fatura') {
      router.push('/pages/invoices/new');
    } else if (type === 'cotacao') {
      router.push('/pages/quotations/new');
    } else {
      router.push('/pages/receipts/new');
    }
    setTimeout(() => setIsProcessing(false), 800);
  }, [router, secureLog]);

  const handleDeleteClick = useCallback((document: OverviewDocument, event: React.MouseEvent) => {
    event.stopPropagation(); // Impedir que abra o preview
    setIsProcessing(true);

    secureLog('info', 'Eliminação de documento solicitada', {
      documentId: document.id,
      documentNumber: document.numero,
      currentStatus: document.status
    });

    if (document.status !== 'rascunho') {
      const message = 'Só é possível eliminar rascunhos. Documentos emitidos não podem ser eliminados.';
      secureLog('warn', 'Tentativa de eliminar documento não rascunho', {
        documentId: document.id,
        status: document.status
      });
      alert(message);
      return;
    }
    setDocumentToDelete(document);
    setIsDeleteConfirmOpen(true);
    setTimeout(() => setIsProcessing(false), 300);
  }, [secureLog]);

  // Função de confirmação de delete
  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;
    setIsProcessing(true);

    secureLog('info', 'Confirmação de eliminação iniciada', {
      documentId: documentToDelete.id,
      documentNumber: documentToDelete.numero
    });

    try {
      const result = await deleteDocument(documentToDelete.id);

      if (result.success) {
        removeDocument(documentToDelete.id);
        setIsDeleteConfirmOpen(false);
        setDocumentToDelete(null);

        secureLog('info', 'Eliminação confirmada e processada com sucesso', {
          documentId: documentToDelete.id
        });

        refreshPage();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      secureLog('error', 'Erro na confirmação de eliminação', {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        documentId: documentToDelete.id
      });
    }
    setIsProcessing(false);
  };

  const handleCancelDelete = useCallback(() => {
    secureLog('info', 'Eliminação cancelada pelo usuário', {
      documentId: documentToDelete?.id
    });
    setIsDeleteConfirmOpen(false);
    setDocumentToDelete(null);
  }, [documentToDelete, secureLog]);

  // ✅ Componente para Linha de Documento Cliсkável
  const DocumentRow = React.memo(({ doc, index }: { doc: OverviewDocument; index: number }) => (
    <motion.tr
      key={doc.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="hover:bg-blue-50 transition-all duration-200 cursor-pointer group border-b border-gray-100"
      onClick={(e) => handlePreview(doc, e)}
      whileHover={{ backgroundColor: "rgba(239, 246, 255, 0.5)" }}
      whileTap={{ scale: 0.995 }}
    >
      <td className="px-4 py-4">
        <div className="flex flex-col min-w-0">
          <div className="font-medium text-gray-900 truncate text-sm flex items-center gap-2">
            {doc.numero}
            <FiExternalLink className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {formatDate(doc.data_emissao)}
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col min-w-0">
          <div className="text-sm text-gray-900 truncate">{doc.destinatario}</div>
          <div className="text-xs text-gray-500 truncate">{doc.emitente}</div>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
        {formatCurrency(doc.valor_total, doc.moeda)}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(doc.data_vencimento)}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <StatusBadge status={doc.status} />
        {doc.pagamento_status && (
          <div className="mt-1">
            <StatusBadge status={doc.pagamento_status} />
          </div>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handlePreview(doc)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Visualizar Documento"
          >
            <FiEye className="h-4 w-4" />
          </motion.button>
          {doc.tipo === 'fatura' && doc.status === 'rascunho' && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => handleDeleteClick(doc, e)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar Rascunho"
            >
              <FiTrash2 className="h-4 w-4" />
            </motion.button>
          )}
        </div>
      </td>
    </motion.tr>
  ));
  DocumentRow.displayName = 'DocumentRow';

  // Renderizar conteúdo da seção atual
  const renderSectionContent = useCallback(() => {
    switch (currentSection) {
      case 0: // Lista de Documentos
        return (
          <div className="w-full space-y-6">

            <div className="mb-6 p-4 bg-green-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div>
                    <h5 className="text-blue-800">
                      Faturas, Cotações e Recibos
                    </h5>
                    <p className="text-sm text-blue-600">
                      Clique numa linha para ver o documento. Todos os seus registos reunidos num só lugar.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filtros e Busca */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-50 p-1 rounded-lg w-fit">
                {(['faturas', 'cotacoes', 'recibos'] as DocumentType[]).map((tab) => (
                  <motion.button
                    key={tab}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === tab
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                      }`}
                  >
                    {tab === 'faturas' ? 'Faturas' : tab === 'cotacoes' ? 'Cotações' : 'Recibos'}
                  </motion.button>
                ))}
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Filter Button */}
                <div className="relative">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    className="flex items-center gap-2 text-sm text-gray-700 bg-white px-4 py-2.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors w-full sm:w-auto"
                  >
                    <FiFilter className="text-gray-500" />
                    Filtros
                    {isFiltersOpen ? <FiChevronUp className="ml-1" /> : <FiChevronDown className="ml-1" />}
                  </motion.button>
                  <AnimatePresence>
                    {isFiltersOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                      >
                        <div className="p-4 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Status
                            </label>
                            <select
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value as DocumentStatus)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              {Object.entries(statusConfig).map(([key, { text }]) => (
                                <option key={key} value={key}>{text}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Período
                            </label>
                            <select
                              value={dateFilter}
                              onChange={(e) => setDateFilter(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="7">Últimos 7 dias</option>
                              <option value="30">Últimos 30 dias</option>
                              <option value="90">Últimos 90 dias</option>
                              <option value="all">Todos</option>
                            </select>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Search Input */}
                <div className="relative flex-1 sm:flex-none">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Pesquisar documentos..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Tabela de Documentos */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                {filteredDocuments.length > 0 ? (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Documento', 'Cliente', 'Valor', 'Vencimento', 'Status', 'Ações'].map((header) => (
                          <th
                            key={header}
                            className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredDocuments.map((doc, index) => (
                        <DocumentRow key={doc.id} doc={doc} index={index} />
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-12 px-4">
                    <div className="flex flex-col items-center">
                      <FiActivity className="h-12 w-12 text-gray-300 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Nenhum documento encontrado
                      </h3>
                      <p className="text-gray-500 mb-6 max-w-sm">
                        Não há {activeTab === 'faturas' ? 'faturas' : activeTab === 'cotacoes' ? 'cotações' : 'recibos'} com os filtros selecionados.
                      </p>
                      <button
                        onClick={async () => {
                          setProcessingMessage('A carregar documentos...');
                          setIsProcessing(true);
                          try { await Promise.resolve(refetch()); } finally { setIsProcessing(false); }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                      >
                        Recarregar Documentos
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 1: // Visão Geral
        return (
          <div className="w-full space-y-6">
            <div className="pt-4">
              <h4 className="text-lg font-semibold mb-2">Visão Geral dos Documentos</h4>
              <p className="text-sm text-gray-600 mb-4">
                Acompanhe o status de Faturas, Cotações e Recibos de forma consolidada.
              </p>
              <hr className="mb-6" />
            </div>

            {/* Cards de Estatísticas reduzidos conforme solicitação: */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-red-50 border border-red-200 rounded p-4 flex items-center">
                <div className="mr-3">
                  <FiAlertCircle className="text-red-500" />
                </div>
                <div>
                  <div className="text-xs text-red-700">Faturas Expiradas</div>
                  <h4 className="text-lg font-bold mt-1 text-red-800">{stats?.expiredInvoicesCount ?? 0}</h4>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded p-4 flex items-center">
                <div className="mr-3">
                  <FiAlertCircle className="text-orange-500" />
                </div>
                <div>
                  <div className="text-xs text-orange-700">Cotações Expiradas</div>
                  <h4 className="text-lg font-bold mt-1 text-orange-800">{stats?.expiredQuotesCount ?? 0}</h4>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded p-4 flex items-center">
                <div className="mr-3">
                  <FaInfoCircle className="text-green-500" />
                </div>
                <div>
                  <div className="text-xs text-green-700">Total de Recibos</div>
                  <h4 className="text-lg font-bold mt-1 text-green-800">{stats?.totalReceipts ?? 0}</h4>
                </div>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <QuickActionButton
                title="Nova Fatura"
                subtitle="Criar nova fatura"
                icon={<FiFileText className="h-5 w-5 text-blue-600" />}
                color="bg-blue-50"
                onClick={() => handleNewDocument('fatura')}
              />
              <QuickActionButton
                title="Nova Cotação"
                subtitle="Criar nova cotação"
                icon={<FiFileText className="h-5 w-5 text-purple-600" />}
                color="bg-purple-50"
                onClick={() => handleNewDocument('cotacao')}
              />
              <QuickActionButton
                title="Novo Recibo"
                subtitle="Criar novo recibo"
                icon={<FiFileText className="h-5 w-5 text-green-600" />}
                color="bg-green-50"
                onClick={() => handleNewDocument('recibo')}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentSection, activeTab, statusFilter, dateFilter, searchTerm,
    filteredDocuments, draftStats, isFiltersOpen,
    handlePreview, handleDeleteClick, handleNewDocument, refetch
  ]);

  // Loading state
  if (loading && documents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiLoader className="animate-spin text-blue-500 text-2xl mb-4 mx-auto" />
          <p className="text-gray-600">Carregando documentos...</p>
        </div>
      </div>
    );
  }

  const NavigationList = React.memo(() => (
    <div className="bg-white rounded-lg border border-gray-200 p-3 sticky top-4 shadow-sm">
      <h6 className="font-semibold text-gray-800 text-base mb-3">Navegação:</h6>
      <hr className="mb-3" />
      <div className="space-y-1 text-sm">
        {NAVIGATION_SECTIONS.map((section, index) => (
          <div
            key={index}
            className={`px-2 py-2 border-b border-gray-100 cursor-pointer transition-colors rounded ${index === currentSection
              ? 'bg-blue-50 border-blue-200'
              : index < currentSection
                ? 'bg-green-50 border-green-200 hover:bg-green-100'
                : 'hover:bg-gray-50'
              } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !isNavigating && handleSectionClick(index)}
          >
            <div className="font-medium text-gray-700 text-xs flex items-center justify-between">
              <span>
                {section.icon} <span className="hidden sm:inline">{section.title}</span>
                <span className="sm:hidden">{section.title}</span>
              </span>
              {index < currentSection && (
                <FiCheck className="text-green-500 text-xs" />
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Link de Ajuda */}
      <div className="pt-3 border-t border-gray-200 text-center mt-4">
        <a
          href="mailto:digitalhub.midia@gmail.com"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Ajuda? digitalhub.midia@gmail.com
        </a>
      </div>
    </div>
  ));
  NavigationList.displayName = 'NavigationList';

  return (
    <div ref={rootRef} className="min-h-screen bg-gray-50 mt-3 p-3 md:p-4 relative">
      <ProcessingOverlay isVisible={isNavigating || isProcessing} message={isNavigating ? 'Navegando...' : processingMessage} />

      <div className="max-w-6xl mx-auto">
        <header className="mb-4 md:mb-6 text-center">
          <div className="bg-white rounded-lg border border-gray-200 p-2 mb-4 shadow-sm">
            <div className="bg-gray-50 p-2 rounded">
              <h5 className={`text-xl md:text-2xl font-bold uppercase text-gray-900 mb-2 mt-2 ${roboto.className}`}>
                Faturas & Cotações
              </h5>
              <p className={`text-gray-600 text-xs md:text-sm ${roboto.className}`}>
                Gerencie as suas faturas e cotações de forma eficiente
              </p>
            </div>
          </div>
        </header>

        {/* Card de Navegação */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-4 mb-4 overflow-x-auto shadow-sm">
          <div className="flex items-center space-x-2 md:space-x-4 text-xs md:text-sm min-w-max">
            {NAVIGATION_SECTIONS.map((section, index) => (
              <React.Fragment key={index}>
                <div className="flex items-center">
                  <div className={`rounded-full p-1 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center mr-1 md:mr-2 ${index <= currentSection ? 'bg-blue-600' : 'bg-gray-300'
                    }`}>
                    <span className={`text-xs font-bold ${index <= currentSection ? 'text-white' : 'text-gray-600'
                      }`}>
                      {index + 1}
                    </span>
                  </div>
                  <span className={`hidden md:inline ${index <= currentSection ? 'text-gray-700 font-medium' : 'text-gray-500'
                    }`}>
                    {section.title}
                  </span>
                  <span className={`md:hidden ${index <= currentSection ? 'text-gray-700 font-medium' : 'text-gray-500'
                    }`}>
                    {section.icon}
                  </span>
                </div>
                {index < NAVIGATION_SECTIONS.length - 1 && <div className="text-gray-300">›</div>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Layout de 3 Cards */}
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* Card 1: Lista de Navegação */}
          <div className="lg:w-64 xl:w-80">
            <NavigationList />
          </div>

          {/* Card 2: Conteúdo da Seção Atual */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 overflow-hidden shadow-sm">
              {renderSectionContent()}

              {/* Navegação entre Seções */}
              <NavigationButtons
                currentStep={currentSection}
                totalSteps={NAVIGATION_SECTIONS.length}
                onPrev={prevSection}
                onNext={nextSection}
                isNavigating={isNavigating}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Modal de Preview Completo */}
      <DocumentPreviewModal
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        documentData={selectedDocument}
        documentHtml={documentHtml}
        isLoading={isLoadingHtml}
        error={htmlError}
        onDownload={handleDownload}
        isGeneratingPdf={isGeneratingPdf}
      />

      {/* Modal de Confirmação de Eliminação */}
      <AnimatePresence>
        {isDeleteConfirmOpen && documentToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={handleCancelDelete}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <FiTrash2 className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Eliminar Rascunho</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Tem certeza que deseja eliminar <strong>{documentToDelete.numero}</strong>?
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-700">
                    <strong>⚠️ ELIMINAÇÃO PERMANENTE</strong>
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    Esta ação <strong>NÃO PODE</strong> ser desfeita.
                    O rascunho será <strong>PERMANENTEMENTE ELIMINADO</strong> do sistema.
                  </p>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={handleCancelDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:bg-red-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <FiLoader className="animate-spin h-4 w-4" />
                        <span>Eliminando...</span>
                      </>
                    ) : (
                      'Sim, Eliminar Permanentemente'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mostrar erros de forma segura */}
      {(error || deleteError) && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-sm z-50 shadow-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <FiAlertCircle className="text-red-600" />
            <span className="font-semibold text-red-800">Erro</span>
          </div>
          <div className="text-sm text-red-700">
            {error || deleteError}
          </div>
          {error && (
            <button
              onClick={refreshPage}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 font-medium"
            >
              Tentar Novamente
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}