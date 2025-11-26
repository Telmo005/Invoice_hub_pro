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
  isCreating: boolean;
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

const formatTransactionReference = (documentNumber: string): string => {
  const sanitized = documentNumber.replace(/[^a-zA-Z0-9]/g, '');
  const withPrefix = `ORDER${sanitized}`;
  return withPrefix.slice(0, 20);
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

const createDocumentDirect = async (documentData: InvoiceData): Promise<{
  id: string;
  numero: string;
}> => {
  const docType = documentData.tipo || 'fatura';
  const endpoint = docType === 'cotacao'
    ? '/api/document/quotation/create'
    : (docType === 'recibo' ? '/api/document/receipt/create' : '/api/document/invoice/create');

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

const processRealPayment = async (
  contact: string,
  amount: number,
  documentNumber: string,
  thirdPartyReference: string,
  docType: string,
  moeda: string,
  documentSnapshot: any
): Promise<void> => {
  const formattedTransactionRef = formatTransactionReference(documentNumber);

  const payload = {
    customer_msisdn: contact,
    amount: amount,
    transaction_reference: formattedTransactionRef,
    third_party_reference: thirdPartyReference,
    tipo_documento: docType.toLowerCase(),
    moeda: moeda || 'MZN',
    document_snapshot: documentSnapshot || {}
  };

  const response = await fetch('/api/mpesa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.error?.message || 'Erro ao processar pagamento';
    throw new ApiError(
      data.error?.code || 'PAYMENT_ERROR',
      errorMessage,
      data.error?.details,
      response.status
    );
  }

  if (!data.success) {
    throw new ApiError(
      'PAYMENT_FAILED',
      data.message || 'Pagamento não foi autorizado'
    );
  }
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
  const [selectedMethod, setSelectedMethod] = useState<string | null>('Mpeza');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [documentSaveResult, setDocumentSaveResult] = useState<{ documentId: string; documentNumber: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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

  const processPaymentSingleAttempt = useCallback(async (
    contact: string,
    amount: number,
    documentNumber: string,
    thirdPartyRef: string,
    docSnapshot: any
  ): Promise<void> => {
    await processRealPayment(
      contact,
      amount,
      documentNumber,
      thirdPartyRef,
      documentType,
      invoiceData?.formData?.moeda || 'MZN',
      docSnapshot
    );
  }, [documentType, invoiceData?.formData?.moeda]);

  const handleSaveDocument = useCallback(async (htmlContent: string): Promise<{
    id: string;
    numero: string;
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

      if (!result.id) {
        throw new Error('ID do documento não foi retornado');
      }

      return result;
    } catch (error) {
      let errorMessage = 'Erro ao criar documento';

      if (error instanceof ApiError) {
        switch (error.code) {
          case 'DOCUMENT_ALREADY_EXISTS':
            errorMessage = `${dynamicDocumentData.typeDisplay} já existe! Escolha outro número.`;
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
  }, [invoiceData, dynamicDocumentData.typeDisplay, thirdPartyReference]);

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

    // Validação do contacto
    if (!contactNumber.trim()) {
      setErrorMessage('Por favor, insira o número de contacto para MPesa');
      return;
    }

    const cleanedContact = contactNumber.replace(/\D/g, '');
    if (cleanedContact.length < 9) {
      setErrorMessage('Número de telefone deve ter pelo menos 9 dígitos');
      return;
    }

    // Reset do estado
    isProcessingRef.current = true;
    // Sem controle de tentativas
    setPaymentStatus('processing');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // ✅ 1. VALIDAÇÃO DO DOCUMENTO - VERIFICA SE JÁ EXISTE (PRIMEIRO PASSO CRÍTICO)
      setSuccessMessage('Validando número do documento...');
      await validateDocumentNumber();

      // ✅ 2. SE CHEGOU AQUI, DOCUMENTO NÃO EXISTE - PODE CONTINUAR

      // 3. Gerar referência
      const currentThirdPartyReference = generateThirdPartyReference();
      setThirdPartyReference(currentThirdPartyReference);

      // 4. Processar pagamento
      setSuccessMessage('Iniciando processamento MPesa...');
      // Snapshot do documento para validação backend
      const fd: any = invoiceData?.formData || {};
      const docSnapshot = {
        tipo: documentType,
        faturaNumero: fd.faturaNumero,
        cotacaoNumero: fd.cotacaoNumero,
        reciboNumero: fd.reciboNumero,
        emitente: fd.emitente,
        destinatario: fd.destinatario,
        items: invoiceData?.items || [],
        valorRecebido: fd.valorRecebido,
        validezCotacao: fd.validezCotacao,
        validezFatura: fd.validezFatura
      };

      await processPaymentSingleAttempt(
        contactNumber,
        LIBERATION_FEE,
        dynamicDocumentData.id,
        currentThirdPartyReference,
        docSnapshot
      );

      // 5. Salvar documento
      setSuccessMessage('Pagamento confirmado! Salvando documento...');
      const saveResult = await handleSaveDocument(renderedHtml);

      setDocumentSaveResult({
        documentId: saveResult.id,
        documentNumber: saveResult.numero
      });

      // ✅ 6. ENVIAR EMAIL APÓS SALVAR O DOCUMENTO COM SUCESSO
      try {
        const userEmail = user?.email;
        if (userEmail) {
          setSuccessMessage('Enviando documento por email...');

          await sendDocumentByEmail({
            documentId: saveResult.id,
            documentNumber: saveResult.numero,
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

      // 7. Sucesso final
      setPaymentStatus('success');

      if (onInvoiceCreated) {
        onInvoiceCreated(saveResult.id);
      }

    } catch (error) {
      setPaymentStatus('error');

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();

        if (errorMsg.includes('já existe') || errorMsg.includes('nunca')) {
          setErrorMessage(error.message);
        } else if (errorMsg.includes('saldo') || errorMsg.includes('insufficient')) {
          setErrorMessage('Saldo insuficiente no MPesa. Por favor, recarregue e tente novamente.');
        } else if (errorMsg.includes('duplicate') || errorMsg.includes('duplicad')) {
          setErrorMessage('Transação duplicada. Aguarde alguns instantes e tente novamente.');
        } else if (error instanceof ApiError) {
          // Tratamento específico baseado em códigos da API
          switch (error.code) {
            case 'INVALID_PHONE':
              setErrorMessage('Número de telefone inválido. Formatos aceites: 84XXXXXXX, 084XXXXXXX ou +25884XXXXXXX.');
              break;
            case 'MISSING_FIELDS':
              setErrorMessage('Campos obrigatórios em falta no pagamento. Verifique os dados e tente novamente.');
              break;
            default:
              if (errorMsg.includes('invalid') || errorMsg.includes('inválido')) {
                setErrorMessage('Dados inválidos recebidos. Verifique número e valor.');
              } else {
                setErrorMessage(error.message);
              }
          }
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage('Erro inesperado ao processar pagamento');
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [
    contactNumber,
    dynamicDocumentData,
    handleSaveDocument,
    onInvoiceCreated,
    validateDocumentNumber,
    processPaymentSingleAttempt,
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
    isCreating,
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