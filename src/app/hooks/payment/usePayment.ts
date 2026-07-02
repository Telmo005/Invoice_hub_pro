// src/app/hooks/payment/usePayment.ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { InvoiceData, TipoDocumento } from '@/types/invoice-types';
import { useAuth } from '@/app/providers/AuthProvider';

interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  requiresContact: boolean;
  imagePath: string;
}

interface UsePaymentProps {
  invoiceData: InvoiceData;
  onInvoiceCreated?: (invoiceId: string) => void;
}

interface UsePaymentReturn {
  selectedMethod: string | null;
  paymentStatus: 'idle' | 'processing' | 'success' | 'error';
  contactNumber: string;
  errorMessage: string | null;
  successMessage: string | null;
  documentSaveResult: { documentId: string; documentNumber: string } | null;
  isPreviewOpen: boolean;
  isGeneratingPdf: boolean;
  isDocumentValid: boolean;
  documentValidationErrors: string[];
  setSelectedMethod: (method: string | null) => void;
  setContactNumber: (contact: string) => void;
  setIsPreviewOpen: (isOpen: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  processPayment: (renderedHtml: string) => Promise<void>;
  handleRetry: () => void;
  handleDownload: (renderedHtml: string, documentNumber?: string) => Promise<void>;
  handleEmailSend: (documentNumber?: string) => void;
  paymentMethods: PaymentMethod[];
  dynamicDocumentData: any;
}

// Fase 4 (docs/auditoria-inicial.md): valores do "id" batem certo com o
// campo `method` esperado pelo PaySuite (mpesa|emola|credit_card) -- ver
// src/lib/payments/PaymentProvider.ts -- para não precisar de mapear entre
// um id interno e o valor real da API.
const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'mpesa',
    name: 'M-Pesa',
    description: 'Pagamento via M-Pesa',
    requiresContact: false,
    imagePath: '/m-pesa-seeklogo.png'
  },
  {
    id: 'emola',
    name: 'e-Mola',
    description: 'Pagamento via e-Mola',
    requiresContact: false,
    imagePath: '/m-pesa-seeklogo.png'
  },
  {
    id: 'credit_card',
    name: 'Cartão (Visa/Mastercard)',
    description: 'Pode demorar até 1-2 dias úteis a confirmar',
    requiresContact: false,
    imagePath: '/m-pesa-seeklogo.png'
  }
];

const LIBERATION_FEE = 10;
const CURRENCY = 'MT';
const POLL_INTERVAL_MS = 3000;
// ~5 minutos de polling ativo antes de deixar o utilizador seguir em frente
// (o pagamento continua a ser processado em segundo plano pelo webhook;
// cartão pode legitimamente demorar 1-2 dias úteis a confirmar)
const MAX_POLL_ATTEMPTS = 100;

// Cache simples em memória para token CSRF (mesmo padrão de useCrudEmissores.ts)
let cachedCsrfToken: string | null = null;
const fetchCsrfToken = async (): Promise<string> => {
  if (cachedCsrfToken) return cachedCsrfToken;
  const res = await fetch('/api/auth/csrf', { method: 'GET', credentials: 'include' });
  const data = await res.json();
  const received = data?.csrfToken || data?.token;
  if (typeof received === 'string' && received.length > 10) {
    cachedCsrfToken = received;
    return cachedCsrfToken;
  }
  throw new Error('Falha ao obter CSRF token');
};

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

// ✅ FUNÇÕES PARA VERIFICAR SE DOCUMENTO JÁ EXISTE
const checkFaturaExistsDirect = async (numero: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/document/invoice/find', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ numero }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro na API de busca de fatura:', data.error);
      return false;
    }

    return data.success && data.data?.exists === true;
  } catch (error) {
    console.error('Erro ao verificar fatura:', error);
    return false;
  }
};
  const checkReciboExistsDirect = async (numero: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/document/receipt/find', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ numero }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Erro na API de busca de recibo:', data.error);
        return false;
      }

      return data.success && data.data?.exists === true;
    } catch (error) {
      console.error('Erro ao verificar recibo:', error);
      return false;
    }
  };

const checkCotacaoExistsDirect = async (numero: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/document/quotation/find', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ numero }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro na API de busca de cotação:', data.error);
      return false;
    }

    return data.success && data.data?.exists === true;
  } catch (error) {
    console.error('Erro ao verificar cotação:', error);
    return false;
  }
};

const generateThirdPartyReference = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * 26));
  }
  return result;
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return new Date().toLocaleDateString('pt-MZ');
  return new Date(dateString).toLocaleDateString('pt-MZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const getDocumentDisplayInfo = (documentType: TipoDocumento) => {
  const isCotacao = documentType === 'cotacao';
  const isRecibo = documentType === 'recibo';
  return {
    type: documentType,
    typeDisplay: isCotacao ? 'Cotação' : (isRecibo ? 'Recibo' : 'Fatura'),
    typeDisplayLower: isCotacao ? 'cotação' : (isRecibo ? 'recibo' : 'fatura'),
    description: isCotacao ? 'Taxa de liberação de cotação' : (isRecibo ? 'Recibo de pagamento' : 'Taxa de liberação de fatura')
  };
};

// Fase 4 (docs/auditoria-inicial.md): inicia a cobrança via PaySuite.
// Devolve um checkout_url para onde o utilizador é enviado para completar
// o pagamento (M-Pesa/e-Mola/cartão) -- o documento só é criado depois do
// webhook confirmar o pagamento, nunca aqui.
const initiateCheckout = async (
  tipo: TipoDocumento,
  documentData: InvoiceData,
  method: string,
  htmlContent: string
): Promise<{ payment_id: string; checkout_url: string }> => {
  const csrfToken = await fetchCsrfToken();
  const response = await fetch('/api/payments/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken
    },
    credentials: 'include',
    body: JSON.stringify({
      tipo,
      documentData: { ...documentData, htmlContent },
      method
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error?.code || 'PAYMENT_ERROR',
      data.error?.message || 'Erro ao iniciar pagamento',
      data.error?.details,
      response.status
    );
  }

  return data.data;
};

interface PaymentStatusResult {
  status: string;
  documento: { id: string; numero: string } | null;
}

const pollPaymentStatusOnce = async (paymentId: string): Promise<PaymentStatusResult> => {
  const response = await fetch(`/api/payments/status/${paymentId}`, { credentials: 'include' });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new ApiError('STATUS_ERROR', 'Erro ao consultar estado do pagamento');
  }

  return data.data;
};

// CSRF removido do fluxo de envio de email para reduzir latência

const sendDocumentByEmail = async (documentData: {
  documentId: string;
  documentNumber: string;
  documentType: 'fatura' | 'cotacao';
  clientName: string;
  clientEmail: string;
  date: string;
  totalValue?: number;
  currency?: string;
}): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('📧 usePayment: Enviando email para:', documentData.clientEmail);
    console.log('📧 usePayment - documentId:', documentData.documentId);

    const response = await fetch('/api/email/send-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(documentData),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error?.message || result.error || 'Erro ao enviar email');
    }

    return {
      success: result.success,
      message: result.data?.message || result.message || 'Email enviado'
    };
  } catch (error) {
    console.error('📧 usePayment: Erro ao enviar email:', error);
    return {
      success: false,
      message: 'Erro ao enviar email. Tente novamente.'
    };
  }
};

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
      @page { margin: 5mm !important; size: A4; }
      body { padding: 0 !important; margin: 0 !important; width: 100% !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .header, .footer, [class*="header"], [class*="footer"] { display: none !important; }
    }
  </style>
</head>
<body>
  ${htmlContent}
  
  <script>
    setTimeout(() => window.print(), 500);
  </script>
</body>
</html>`;
};

export const usePayment = ({
  invoiceData,
  onInvoiceCreated
}: UsePaymentProps): UsePaymentReturn => {
  const [selectedMethod, setSelectedMethod] = useState<string | null>('mpesa');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [documentSaveResult, setDocumentSaveResult] = useState<{ documentId: string; documentNumber: string } | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [thirdPartyReference, setThirdPartyReference] = useState<string>('');

  const isProcessingRef = useRef(false);
  // Removido controle de tentativas automáticas: processamento agora é single-shot

  const { user } = useAuth();

  const documentType: TipoDocumento = invoiceData?.tipo || 'fatura';
  const documentInfo = getDocumentDisplayInfo(documentType);
  const isCotacao = documentType === 'cotacao';
  const isRecibo = documentType === 'recibo';

  const computeDocumentValidation = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const fd: any = invoiceData?.formData || {};
    // numero
    const numero = isCotacao ? fd.cotacaoNumero : (isRecibo ? fd.reciboNumero : fd.faturaNumero);
    if (!numero) errors.push('Número do documento ausente');
    // emitente
    if (!fd.emitente?.nomeEmpresa) errors.push('Emitente nomeEmpresa');
    if (!fd.emitente?.pais) errors.push('Emitente pais');
    if (!fd.emitente?.cidade) errors.push('Emitente cidade');
    if (!fd.emitente?.telefone) errors.push('Emitente telefone');
    // destinatario (não exigir para recibo se opcional)
    if (!isRecibo && !fd.destinatario?.nomeCompleto) errors.push('Destinatário nomeCompleto');
    // items
    const itemsList = invoiceData?.items || [];
    if (!isRecibo && (!Array.isArray(itemsList) || itemsList.length === 0)) errors.push('Itens do documento');
    if (!isRecibo) {
      for (const it of itemsList) {
        if (!it.descricao) { errors.push('Item descrição vazio'); break; }
        if (it.quantidade <= 0) { errors.push('Item quantidade inválida'); break; }
        if (it.precoUnitario <= 0) { errors.push('Item preço inválido'); break; }
      }
    }
    // recibo campos específicos
    if (isRecibo) {
      if (typeof fd.valorRecebido !== 'number' || fd.valorRecebido <= 0) errors.push('Valor Recebido inválido');
      if (!fd.dataRecibo) fd.dataRecibo = new Date().toISOString().split('T')[0];
    }
    // validade
    if (documentType === 'cotacao' && !fd.validezCotacao) errors.push('Validez da cotação');
    if (documentType === 'fatura' && !fd.validezFatura) errors.push('Validez da fatura');
    return { valid: errors.length === 0, errors };
  }, [invoiceData, documentType, isRecibo, isCotacao]);

  const { valid: isDocumentValid, errors: documentValidationErrors } = computeDocumentValidation();

  useEffect(() => {
    setThirdPartyReference(generateThirdPartyReference());
  }, []);

  

  const dynamicDocumentData = useMemo(() => ({
    id: isCotacao
      ? invoiceData?.formData?.cotacaoNumero || 'N/A'
      : (documentType === 'recibo' ? invoiceData?.formData?.reciboNumero || 'N/A' : invoiceData?.formData?.faturaNumero || 'N/A'),
    client: invoiceData?.formData?.destinatario?.nomeCompleto || 'Cliente não definido',
    amount: `${LIBERATION_FEE.toFixed(2)} ${CURRENCY}`,
    date: formatDate(invoiceData?.formData?.dataFatura || invoiceData?.formData?.dataRecebimento),
    totalItems: invoiceData?.items?.length || 0,
    totalValue: invoiceData?.totais?.totalFinal || 0,
    currency: invoiceData?.formData?.moeda || 'MT',
    thirdPartyReference: thirdPartyReference,
    ...documentInfo
  }), [invoiceData, thirdPartyReference, documentInfo, isCotacao]);

  // ✅ VALIDAÇÃO ATUALIZADA - VERIFICA SE DOCUMENTO JÁ EXISTE
  const validateDocumentNumber = useCallback(async (): Promise<boolean> => {
    const numero = isCotacao
      ? invoiceData?.formData?.cotacaoNumero
      : (documentType === 'recibo' ? invoiceData?.formData?.reciboNumero : invoiceData?.formData?.faturaNumero);

    if (!numero?.trim()) {
      throw new Error('Número do documento é obrigatório');
    }

    try {
      // Verificar se o documento já existe
      let documentExists = false;
      if (isCotacao) {
        documentExists = await checkCotacaoExistsDirect(numero);
      } else if (documentType === 'recibo') {
        documentExists = await checkReciboExistsDirect(numero);
      } else {
        documentExists = await checkFaturaExistsDirect(numero);
      }

      if (documentExists) {
        throw new Error(`${dynamicDocumentData.typeDisplay} "${numero}" já existe. Já registaste uma ${dynamicDocumentData.typeDisplay} com este código.`);
      }

      return true;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro ao verificar documento existente');
    }
  }, [invoiceData, isCotacao, dynamicDocumentData.typeDisplay]);

  const processPayment = useCallback(async (renderedHtml: string): Promise<void> => {
    if (isProcessingRef.current) {
      setErrorMessage('Processamento já em andamento');
      return;
    }

    // Validação completa antes de qualquer pagamento
    if (!isDocumentValid) {
      setErrorMessage('Preencha todos os campos obrigatórios antes de pagar: ' + documentValidationErrors.join(', '));
      setPaymentStatus('error');
      return;
    }

    if (!selectedMethod) {
      setErrorMessage('Selecione um método de pagamento');
      return;
    }

    // Reset do estado
    isProcessingRef.current = true;
    setPaymentStatus('processing');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Verifica se o número do documento já existe (mesma validação de antes)
      setSuccessMessage('Validando número do documento...');
      await validateDocumentNumber();

      // 2. Inicia o pagamento no PaySuite -- o documento em si só é criado
      // pelo webhook depois de o pagamento ser confirmado (ver
      // src/app/api/payments/webhook/paysuite/route.ts).
      const currentThirdPartyReference = generateThirdPartyReference();
      setThirdPartyReference(currentThirdPartyReference);

      setSuccessMessage('A abrir página de pagamento...');
      const documentDataWithHtml = {
        ...invoiceData,
        payment_reference: currentThirdPartyReference
      };

      const { payment_id, checkout_url } = await initiateCheckout(
        documentType,
        documentDataWithHtml,
        selectedMethod,
        renderedHtml
      );

      // 3. Abre o checkout do PaySuite numa nova aba (decisão do utilizador --
      // mantém esta página com o wizard/estado visível em vez de navegar
      // para fora da app).
      const checkoutWindow = window.open(checkout_url, '_blank', 'noopener,noreferrer');
      if (!checkoutWindow) {
        setPaymentStatus('error');
        setErrorMessage('Permita popups no navegador para concluir o pagamento.');
        return;
      }

      // 4. Poll até o webhook confirmar o pagamento (ou até esgotar as
      // tentativas -- cartão pode legitimamente demorar 1-2 dias úteis).
      setSuccessMessage('Aguardando confirmação do pagamento...');

      let resolved = false;
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        const result = await pollPaymentStatusOnce(payment_id);

        if (result.status === 'pago' && result.documento) {
          resolved = true;
          setDocumentSaveResult({
            documentId: result.documento.id,
            documentNumber: result.documento.numero
          });

          try {
            const userEmail = user?.email;
            if (userEmail) {
              setSuccessMessage('Enviando documento por email...');
              await sendDocumentByEmail({
                documentId: result.documento.id,
                documentNumber: result.documento.numero,
                documentType: dynamicDocumentData.type as 'fatura' | 'cotacao',
                clientName: dynamicDocumentData.client,
                clientEmail: userEmail,
                date: new Date().toISOString(),
                totalValue: dynamicDocumentData.totalValue,
                currency: dynamicDocumentData.currency
              });
              setSuccessMessage(`${dynamicDocumentData.typeDisplay} criada com sucesso! Documento enviado por email.`);
            } else {
              setSuccessMessage(`${dynamicDocumentData.typeDisplay} criada com sucesso!`);
            }
          } catch (emailError) {
            console.error('Erro ao enviar email:', emailError);
            setSuccessMessage(`${dynamicDocumentData.typeDisplay} criada com sucesso! (Email não enviado)`);
          }

          setPaymentStatus('success');
          if (onInvoiceCreated) {
            onInvoiceCreated(result.documento.id);
          }
          break;
        }

        if (result.status === 'falhado') {
          resolved = true;
          setPaymentStatus('error');
          setErrorMessage('O pagamento não foi concluído ou foi recusado.');
          break;
        }
      }

      if (!resolved) {
        // Ainda a processar em segundo plano (comum em cartão) -- não é um
        // erro, o utilizador vai receber email quando o webhook confirmar.
        setPaymentStatus('idle');
        setSuccessMessage('O pagamento ainda está a ser processado. Vai receber um email assim que for confirmado.');
      }

    } catch (error) {
      setPaymentStatus('error');

      if (error instanceof ApiError) {
        setErrorMessage(error.message || 'Erro ao processar pagamento');
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Erro inesperado ao processar pagamento');
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [
    isDocumentValid,
    documentValidationErrors,
    selectedMethod,
    validateDocumentNumber,
    invoiceData,
    documentType,
    dynamicDocumentData,
    onInvoiceCreated,
    user?.email
  ]);

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

    } catch (_error) {
      setErrorMessage('Erro ao gerar PDF');
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

  const handleRetry = useCallback(() => {
    setThirdPartyReference(generateThirdPartyReference());
    setPaymentStatus('idle');
    setErrorMessage(null);
    setSuccessMessage(null);
    setDocumentSaveResult(null);
    isProcessingRef.current = false;
    // Sem reset de tentativas porque não há retry automático
  }, []);

  return {
    selectedMethod,
    paymentStatus,
    contactNumber,
    errorMessage,
    successMessage,
    documentSaveResult,
    isPreviewOpen,
    isGeneratingPdf,
    setSelectedMethod,
    setContactNumber,
    setIsPreviewOpen,
    setErrorMessage,
    processPayment,
    handleRetry,
    handleDownload,
    handleEmailSend,
    paymentMethods: PAYMENT_METHODS,
    dynamicDocumentData,
    isDocumentValid,
    documentValidationErrors
  };
};