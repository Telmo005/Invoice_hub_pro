import { useState, useCallback, useRef } from 'react';
import { InvoiceData, TipoDocumento } from '@/types/invoice-types';
import { useDocumentCheck } from '@/app/hooks/document/useFind';

export interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  requiresContact: boolean;
  imagePath: string;
}

export interface UsePaymentProps {
  invoiceData: InvoiceData;
  onInvoiceCreated?: (invoiceId: string) => void;
}

export interface UsePaymentReturn {
  // Estados
  selectedMethod: string | null;
  paymentStatus: 'idle' | 'processing' | 'success' | 'error' | 'duplicate_document';
  contactNumber: string;
  errorMessage: string | null;
  successMessage: string | null;
  documentSaveResult: { documentId: string; documentNumber: string } | null;
  isCreating: boolean;
  internalCreateError: string | null;
  isPreviewOpen: boolean;
  isGeneratingPdf: boolean;
  existingDocumentData: { documentNumber: string; documentId?: string } | null;
  isCheckingDocument: boolean;

  // Setters
  setSelectedMethod: (method: string | null) => void;
  setContactNumber: (contact: string) => void;
  setIsPreviewOpen: (isOpen: boolean) => void;
  setErrorMessage: (message: string | null) => void;

  // Ações
  processPayment: (renderedHtml: string) => Promise<void>;
  handleRetry: () => void;
  handleDownload: (renderedHtml: string, documentNumber?: string) => Promise<void>;
  handleEmailSend: (documentNumber?: string) => void;
  handleUseExistingDocument: () => void;
  handleCreateNewDocument: () => void;

  // Dados
  paymentMethods: PaymentMethod[];
  dynamicDocumentData: any;
  liberationFee: number;
  currency: string;
}

// Constantes
const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'Mpeza',
    name: 'M-Pesa',
    description: 'Confirmação imediata',
    requiresContact: true,
    imagePath: '/m-pesa-seeklogo.png'
  }
];

const LIBERATION_FEE = 10;
const CURRENCY = 'MT';

// ✅ GERADOR DE THIRD_PARTY_REFERENCE (Formato: 6 caracteres alfanuméricos)
const generateThirdPartyReference = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  // Primeiros 3 caracteres: números
  for (let i = 0; i < 3; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  
  // Últimos 3 caracteres: letras
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * 26));
  }
  
  return result;
};

// ✅ FUNÇÃO PARA FORMATAR TRANSACTION REFERENCE COM PREFIXO ORDER
const formatTransactionReference = (documentNumber: string): string => {
  // Remover TODOS os caracteres especiais, manter APENAS letras e números
  const sanitized = documentNumber.replace(/[^a-zA-Z0-9]/g, '');
  
  // Adicionar prefixo ORDER (sem underscore) e limitar a 20 caracteres
  const withPrefix = `ORDER${sanitized}`;
  const limited = withPrefix.slice(0, 20);
  
  console.log('🔧 Formatando transaction reference:', {
    original: documentNumber,
    sanitized: sanitized,
    withPrefix: withPrefix,
    final: limited
  });
  
  return limited;
};

// Utilitários
const formatDate = (dateString?: string): string => {
  if (!dateString) return new Date().toLocaleDateString('pt-MZ');
  return new Date(dateString).toLocaleDateString('pt-MZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const getDocumentId = (invoiceData: InvoiceData, isCotacao: boolean): string => {
  return isCotacao
    ? invoiceData?.formData?.cotacaoNumero || 'N/A'
    : invoiceData?.formData?.faturaNumero || 'N/A';
};

const getDocumentDisplayInfo = (documentType: TipoDocumento) => {
  const isCotacao = documentType === 'cotacao';
  return {
    type: documentType,
    typeDisplay: isCotacao ? 'Cotação' : 'Fatura',
    typeDisplayLower: isCotacao ? 'cotação' : 'fatura',
    description: isCotacao ? 'Taxa de liberação de cotação' : 'Taxa de liberação de fatura'
  };
};

// Cliente API
class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: any = null,
    public status: number = 0
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Função para criar documento
const createDocumentDirect = async (documentData: InvoiceData): Promise<{
  id: string;
  numero: string;
}> => {
  const docType = documentData.tipo || 'fatura';
  const endpoint = docType === 'cotacao'
    ? '/api/document/quotation/create'
    : '/api/document/invoice/create';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentData }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.message || 'Erro desconhecido',
      data.error?.details,
      response.status
    );
  }

  return data.data!;
};

// ✅ FUNÇÃO REAL DE PAGAMENTO - CORRIGIDA
const processRealPayment = async (
  contact: string,           // Número de telefone
  amount: number,            // Valor do pagamento
  documentNumber: string,    // Número da fatura/cotação
  thirdPartyReference: string // Referência única
): Promise<{ success: boolean; paymentId?: string; message?: string }> => {
  try {
    // ✅ FORMATAR a transaction reference com prefixo ORDER
    const formattedTransactionRef = formatTransactionReference(documentNumber);
    
    const payload = {
      customer_msisdn: contact,
      amount: amount,
      transaction_reference: formattedTransactionRef, // ✅ Com prefixo ORDER
      third_party_reference: thirdPartyReference
    };

    console.log('📤 Payload final para MPesa:', payload);

    const response = await fetch('/api/mpesa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new ApiError(
        data.error?.code || 'PAYMENT_ERROR',
        data.error?.message || 'Erro ao processar pagamento',
        data.error?.details,
        response.status
      );
    }

    return {
      success: data.success,
      paymentId: data.mpesa_transaction_id,
      message: data.message
    };

  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'NETWORK_ERROR',
      'Erro de conexão. Verifique sua internet e tente novamente.',
      { originalError: error }
    );
  }
};

// Template PDF
const getPdfTemplate = (htmlContent: string, documentData: any, documentNumber?: string): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${documentData.typeDisplay} ${documentNumber || documentData.id}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Arial', 'Helvetica', sans-serif; }
    body { background: white !important; color: #000 !important; line-height: 1.4; padding: 5mm; margin: 0 !important; }
    
    @media print {
      @page { margin: 5mm !important; size: A4; margin-header: 0 !important; margin-footer: 0 !important; marks: none !important; }
      body { padding: 0 !important; margin: 0 !important; width: 100% !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      .header, .footer, [class*="header"], [class*="footer"], #header, #footer, .print-header, .print-footer { display: none !important; }
    }
    
    table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
    th, td { padding: 8px 12px; border: 1px solid #ddd; }
    .no-break { page-break-inside: avoid; }
  </style>
</head>
<body>
  ${htmlContent}
  
  <div style="display: none;" class="print-instructions">
    <h3>📄 Como Salvar como PDF</h3>
    <ol>
      <li><strong>Pressione Ctrl+P</strong> (ou Cmd+P no Mac)</li>
      <li>Selecione <strong>"Salvar como PDF"</strong></li>
      <li><strong>Margens:</strong> "Mínimo" | <strong>Cabeçalhos/rodapés:</strong> DESATIVADOS</li>
    </ol>
  </div>

  <script>
    setTimeout(() => window.print(), 500);
    window.onbeforeunload = () => "PDF gerado com sucesso? Pode fechar esta janela.";
  </script>
</body>
</html>`;
};

export const usePayment = ({
  invoiceData,
  onInvoiceCreated
}: UsePaymentProps): UsePaymentReturn => {
  // Estados
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error' | 'duplicate_document'>('idle');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [documentSaveResult, setDocumentSaveResult] = useState<{ documentId: string; documentNumber: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [internalCreateError, setInternalCreateError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [existingDocumentData, setExistingDocumentData] = useState<{ documentNumber: string; documentId?: string } | null>(null);
  const [thirdPartyReference, setThirdPartyReference] = useState<string>('');

  // Ref para prevenir duplo clique
  const isProcessingRef = useRef(false);

  // Hook de verificação
  const {
    checkFaturaExists,
    checkCotacaoExists,
    checking: isCheckingDocument,
  } = useDocumentCheck();

  // Dados derivados
  const documentType: TipoDocumento = invoiceData?.tipo || 'fatura';
  const documentInfo = getDocumentDisplayInfo(documentType);
  const isCotacao = documentType === 'cotacao';

  // ✅ Gerar third_party_reference quando o hook é inicializado
  useState(() => {
    setThirdPartyReference(generateThirdPartyReference());
  });

  const dynamicDocumentData = {
    id: getDocumentId(invoiceData, isCotacao),
    client: invoiceData?.formData?.destinatario?.nomeCompleto || 'Cliente não definido',
    description: documentInfo.description,
    amount: `${LIBERATION_FEE.toFixed(2)} ${CURRENCY}`,
    date: formatDate(invoiceData?.formData?.dataFatura),
    totalItems: invoiceData?.items?.length || 0,
    totalValue: invoiceData?.totais?.totalFinal || 0,
    currency: invoiceData?.formData?.moeda || 'MT',
    thirdPartyReference: thirdPartyReference,
    ...documentInfo
  };

  // Verificação de documento
  const checkDocumentByType = useCallback(async (numero: string): Promise<boolean> => {
    if (!numero.trim()) return false;
    try {
      return invoiceData?.tipo === 'fatura' 
        ? await checkFaturaExists(numero)
        : await checkCotacaoExists(numero);
    } catch {
      return false;
    }
  }, [invoiceData?.tipo, checkFaturaExists, checkCotacaoExists]);

  // Salvamento seguro de documento
  const handleSaveDocument = useCallback(async (htmlContent: string): Promise<{
    documentId: string;
    documentNumber: string;
  }> => {
    setIsCreating(true);
    setErrorMessage(null);

    try {
      const documentDataWithHtml = {
        ...invoiceData,
        htmlContent,
        payment_reference: thirdPartyReference
      };

      const result = await createDocumentDirect(documentDataWithHtml);
      return result;
    } catch (error) {
      let errorMessage = 'Erro ao criar documento';

      if (error instanceof ApiError) {
        switch (error.code) {
          case 'UNAUTHORIZED':
            errorMessage = 'Sessão expirada. Faça login novamente.';
            break;
          case 'VALIDATION_ERROR':
            errorMessage = `Dados inválidos: ${error.message}`;
            break;
          case 'DOCUMENT_ALREADY_EXISTS':
            errorMessage = error.message;
            setExistingDocumentData({
              documentNumber: error.details?.documentNumber || dynamicDocumentData.id,
              documentId: error.details?.documentId
            });
            throw new ApiError(error.code, error.message, error.details);
          case 'DATABASE_ERROR':
            errorMessage = 'Erro no banco de dados. Tente novamente.';
            break;
          default:
            errorMessage = error.message || 'Erro ao criar documento';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setErrorMessage(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [invoiceData, dynamicDocumentData.id, thirdPartyReference]);

  // ✅ PROCESSAMENTO REAL DE PAGAMENTO - CORRIGIDO
  const processRealPaymentCallback = useCallback(async (
    contact: string
  ): Promise<boolean> => {
    try {
      console.log('🔍 Dados para MPesa:', {
        contact,
        amount: LIBERATION_FEE,
        documentNumber: dynamicDocumentData.id,
        thirdPartyReference
      });

      const paymentResult = await processRealPayment(
        contact,                    // Número de telefone
        LIBERATION_FEE,             // Valor (10)
        dynamicDocumentData.id,     // Número do documento (FTR-112)
        thirdPartyReference         // Referência única (942XQN)
      );

      if (!paymentResult.success) {
        throw new ApiError(
          'PAYMENT_FAILED',
          paymentResult.message || 'Pagamento não foi autorizado pelo provedor'
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        // Tratamento específico por tipo de erro
        switch (error.code) {
          case 'INSUFFICIENT_FUNDS':
            throw new Error('Saldo insuficiente. Por favor, recarregue sua conta e tente novamente.');
          
          case 'INVALID_NUMBER':
            throw new Error('Número de telefone inválido. Verifique o número e tente novamente.');
          
          case 'NETWORK_ERROR':
            throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
          
          case 'PAYMENT_TIMEOUT':
            throw new Error('Tempo limite excedido. O pagamento demorou muito para processar.');
          
          case 'PROVIDER_ERROR':
            throw new Error('Serviço de pagamento temporariamente indisponível. Tente novamente em alguns minutos.');
          
          case 'DUPLICATE_TRANSACTION':
            // ✅ Gerar nova referência para tentativa de retry
            setThirdPartyReference(generateThirdPartyReference());
            throw new Error('Transação duplicada. Nova referência gerada, tente novamente.');
          
          default:
            throw new Error(error.message || 'Erro ao processar pagamento. Tente novamente.');
        }
      }
      
      throw new Error('Erro inesperado ao processar pagamento. Tente novamente.');
    }
  }, [dynamicDocumentData.id, thirdPartyReference]);

  // Processamento principal CORRIGIDO
  const processPayment = useCallback(async (renderedHtml: string): Promise<void> => {
    if (isProcessingRef.current) return;

    // ✅ VALIDAÇÕES SIMPLIFICADAS para MPesa
    if (!contactNumber.trim()) {
      setErrorMessage('Por favor, insira o número de contacto para MPesa');
      return;
    }

    if (!selectedMethod) {
      setErrorMessage('Por favor, selecione MPesa como método de pagamento');
      return;
    }

    // ✅ VALIDAÇÃO BÁSICA do número
    const cleanedContact = contactNumber.replace(/\D/g, '');
    if (cleanedContact.length < 9) {
      setErrorMessage('Número de telefone deve ter pelo menos 9 dígitos');
      return;
    }

    isProcessingRef.current = true;
    setPaymentStatus('processing');
    setErrorMessage(null);
    setSuccessMessage(null);
    setExistingDocumentData(null);

    try {
      // Verificação de duplicata
      const numero = invoiceData?.formData?.faturaNumero || invoiceData?.formData?.cotacaoNumero;
      if (numero?.trim()) {
        const documentStillExists = await checkDocumentByType(numero);
        if (documentStillExists) {
          setPaymentStatus('duplicate_document');
          setErrorMessage(`${dynamicDocumentData.typeDisplay} "${numero}" já registrada. Escolha outro número!`);
          return;
        }
      }

      // ✅ PROCESSAR PAGAMENTO MPesa
      setSuccessMessage(`🔄 Processando pagamento MPesa... Referência: ${thirdPartyReference}`);
      
      const paymentSuccess = await processRealPaymentCallback(contactNumber);

      if (!paymentSuccess) {
        throw new Error('Pagamento MPesa falhou. Tente novamente.');
      }

      // Salvar documento COM HTML (após pagamento confirmado)
      setSuccessMessage('✅ Pagamento confirmado! Salvando documento...');
      const saveResult = await handleSaveDocument(renderedHtml);
      setDocumentSaveResult(saveResult);

      // Sucesso
      setPaymentStatus('success');
      setSuccessMessage(
        `${dynamicDocumentData.typeDisplay} criada com sucesso! 
        Número: ${saveResult.documentNumber}
        Referência: ${thirdPartyReference}`
      );

      if (onInvoiceCreated) {
        onInvoiceCreated(saveResult.documentId);
      }

    } catch (error) {
      if (error instanceof ApiError && error.code === 'DOCUMENT_ALREADY_EXISTS') {
        setPaymentStatus('duplicate_document');
        const numero = invoiceData?.formData?.faturaNumero || invoiceData?.formData?.cotacaoNumero;
        setErrorMessage(`${dynamicDocumentData.typeDisplay} já existe! Número: ${numero}`);
      } else {
        setPaymentStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Erro ao processar pagamento MPesa.');
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [
    selectedMethod,
    contactNumber,
    dynamicDocumentData,
    processRealPaymentCallback,
    handleSaveDocument,
    onInvoiceCreated,
    invoiceData,
    checkDocumentByType,
    thirdPartyReference
  ]);

  // Download funcionando
  const handleDownload = useCallback(async (renderedHtml: string, documentNumber?: string): Promise<void> => {
    try {
      setIsGeneratingPdf(true);
      setErrorMessage(null);

      const pdfWindow = window.open('', '_blank');
      if (!pdfWindow) {
        throw new Error('Permita popups para gerar o PDF.');
      }

      const optimizedHtml = getPdfTemplate(renderedHtml, dynamicDocumentData, documentNumber);
      pdfWindow.document.write(optimizedHtml);
      pdfWindow.document.close();

      setSuccessMessage('📄 PDF gerado com sucesso!');

    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao gerar PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [dynamicDocumentData]);

  const handleEmailSend = useCallback((documentNumber?: string) => {
    const docNumber = documentNumber || dynamicDocumentData.id;
    const subject = encodeURIComponent(`Dúvidas sobre ${dynamicDocumentData.typeDisplay} ${docNumber}`);
    const body = encodeURIComponent(`Olá,\n\nTenho dúvidas sobre a ${dynamicDocumentData.typeDisplayLower} ${docNumber}.\n\nPodem ajudar?\n\nObrigado!`);
    window.open(`mailto:digitalhub.midia@gmail.com?subject=${subject}&body=${body}`, '_blank');
  }, [dynamicDocumentData]);

  const handleUseExistingDocument = useCallback(() => {
    if (existingDocumentData?.documentId) {
      setDocumentSaveResult({
        documentId: existingDocumentData.documentId,
        documentNumber: existingDocumentData.documentNumber
      });
      setPaymentStatus('success');
      setErrorMessage(null);
      setSuccessMessage(`Usando ${dynamicDocumentData.typeDisplayLower} existente: ${existingDocumentData.documentNumber}`);

      if (onInvoiceCreated) {
        onInvoiceCreated(existingDocumentData.documentId);
      }
    }
  }, [existingDocumentData, dynamicDocumentData, onInvoiceCreated]);

  const handleCreateNewDocument = useCallback(() => {
    setPaymentStatus('idle');
    setExistingDocumentData(null);
    setErrorMessage('Por favor, altere o número do documento e tente novamente.');
  }, []);

  const handleRetry = useCallback(() => {
    // ✅ Gerar nova third_party_reference no retry
    setThirdPartyReference(generateThirdPartyReference());
    setPaymentStatus('idle');
    setErrorMessage(null);
    setSuccessMessage(null);
    setDocumentSaveResult(null);
    setExistingDocumentData(null);
    setContactNumber('');
    setSelectedMethod(null);
    isProcessingRef.current = false;
  }, []);

  return {
    // Estados
    selectedMethod,
    paymentStatus,
    contactNumber,
    errorMessage,
    successMessage,
    documentSaveResult,
    isCreating,
    internalCreateError,
    isPreviewOpen,
    isGeneratingPdf,
    existingDocumentData,
    isCheckingDocument,

    // Setters
    setSelectedMethod,
    setContactNumber,
    setIsPreviewOpen,
    setErrorMessage,

    // Ações
    processPayment,
    handleRetry,
    handleDownload,
    handleEmailSend,
    handleUseExistingDocument,
    handleCreateNewDocument,

    // Dados
    paymentMethods: PAYMENT_METHODS,
    dynamicDocumentData,
    liberationFee: LIBERATION_FEE,
    currency: CURRENCY
  };
};