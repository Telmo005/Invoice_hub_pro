// src/app/components/payment/PaymentScreen.tsx
'use client';

import { Roboto } from 'next/font/google';
import {
  FaCheck,
  FaSpinner,
  FaEnvelope,
  FaEye,
  FaLock,
  FaArrowRight,
  FaFileInvoice,
  FaExclamationTriangle,
  FaInfoCircle,
  FaQuoteLeft,
  FaFilePdf,
  FaMobileAlt,
  FaWallet,
  FaCreditCard,
  FaExternalLinkAlt
} from 'react-icons/fa';
import type { IconType } from 'react-icons';
import { usePayment } from '@/app/hooks/payment/usePayment';

const roboto = Roboto({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  variable: '--font-roboto',
});

interface PaymentScreenProps {
  invoiceData: any;
  renderedHtml: string;
  onInvoiceCreated?: (invoiceId: string) => void;
}

interface StatusMessageProps {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  className?: string;
}

// Componente de mensagem de status sem fundo
const StatusMessage: React.FC<StatusMessageProps> = ({ type, message, className = '' }) => {
  const styles = {
    success: 'text-green-600',
    error: 'text-red-600',
    info: 'text-blue-600',
    warning: 'text-yellow-600'
  };

  const icons = {
    success: <FaCheck className="text-green-500" />,
    error: <FaExclamationTriangle className="text-red-500" />,
    info: <FaInfoCircle className="text-blue-500" />,
    warning: <FaInfoCircle className="text-yellow-500" />
  };

  return (
    <div className={`flex items-center space-x-2 text-sm ${styles[type]} ${className}`}>
      {icons[type]}
      <span className="flex-1">{message}</span>
    </div>
  );
};

const SuccessScreen: React.FC<{
  dynamicDocumentData: any;
  documentSaveResult: { documentId: string; documentNumber: string } | null;
  renderedHtml: string;
  isGeneratingPdf: boolean;
  handleDownload: (html: string, documentNumber?: string) => Promise<void>;
}> = ({
  dynamicDocumentData,
  documentSaveResult,
  renderedHtml,
  isGeneratingPdf,
  handleDownload
}) => {
    const _DocumentIcon = dynamicDocumentData.type === 'cotacao' ? FaQuoteLeft : FaFileInvoice;

    const getSuccessMessage = () => {
      return `${dynamicDocumentData.typeDisplay} criada com sucesso!`;
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <FaCheck className="h-5 w-5 text-green-600" />
          </div>

          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            {dynamicDocumentData.typeDisplay} Liberada!
          </h2>

          <StatusMessage
            type="success"
            message={getSuccessMessage()}
          />

          <div className="bg-gray-50 rounded-md p-4 mb-4 text-left text-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Número:</span>
              <span className="font-medium">{documentSaveResult?.documentNumber}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Cliente:</span>
              <span className="font-medium text-right max-w-[150px] truncate">
                {dynamicDocumentData.client}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Taxa paga:</span>
              <span className="font-bold text-green-600">{dynamicDocumentData.amount}</span>
            </div>
          </div>

          <div className="flex space-x-2 mb-3">
            <button
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-md font-medium flex items-center justify-center text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={() => handleDownload(renderedHtml, documentSaveResult?.documentNumber)}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <FaSpinner className="animate-spin mr-2" />
              ) : (
                <FaFilePdf className="mr-2" />
              )}
              {isGeneratingPdf ? 'Gerando PDF...' : 'Baixar PDF'}
            </button>
          </div>

          <button
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-3 rounded-md font-medium text-sm transition-colors"
            onClick={() => window.location.reload()}
          >
            Criar Nova {dynamicDocumentData.typeDisplay}
          </button>
        </div>
      </div>
    );
  };

// Visual de cada método -- não usa imagens de marca (não temos assets
// licenciados de M-Pesa/e-Mola/Visa), em vez disso um ícone + cor própria
// por método para serem imediatamente distinguíveis à vista. As classes têm
// de estar escritas por extenso (não construídas com template strings) para
// o Tailwind JIT as conseguir detetar.
const METHOD_VISUALS: Record<string, {
  Icon: IconType;
  iconWrap: string;
  border: string;
  glow: string;
  badge: string;
  button: string;
}> = {
  mpesa: {
    Icon: FaMobileAlt,
    iconWrap: 'bg-red-50 text-red-600',
    border: 'border-red-400',
    glow: 'shadow-red-200/70',
    badge: 'bg-red-500',
    button: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-500/25'
  },
  emola: {
    Icon: FaWallet,
    iconWrap: 'bg-teal-50 text-teal-600',
    border: 'border-teal-400',
    glow: 'shadow-teal-200/70',
    badge: 'bg-teal-500',
    button: 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 shadow-teal-500/25'
  },
  credit_card: {
    Icon: FaCreditCard,
    iconWrap: 'bg-indigo-50 text-indigo-600',
    border: 'border-indigo-400',
    glow: 'shadow-indigo-200/70',
    badge: 'bg-indigo-500',
    button: 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-500/25'
  }
};

const DEFAULT_VISUAL = METHOD_VISUALS.credit_card;

const PaymentMethodSelector: React.FC<{
  paymentMethods: any[];
  selectedMethod: string | null;
  onMethodSelect: (method: string) => void;
  errorMessage?: string;
  successMessage?: string;
  isProcessing: boolean;
  isPaymentDisabled: boolean;
  onProcessPayment: () => void;
  dynamicDocumentData: any;
  isDocumentValid: boolean;
  documentValidationErrors: string[];
}> = ({
  paymentMethods,
  selectedMethod,
  onMethodSelect,
  errorMessage,
  successMessage,
  isProcessing,
  isPaymentDisabled,
  onProcessPayment,
  dynamicDocumentData,
  isDocumentValid,
  documentValidationErrors
}) => {
    const selectedMethodData = paymentMethods.find(method => method.id === selectedMethod);
    const selectedVisual = selectedMethod ? (METHOD_VISUALS[selectedMethod] ?? DEFAULT_VISUAL) : null;

    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h5 className="font-semibold text-gray-800 text-lg">
          Método de Pagamento
        </h5>
        <p className="text-sm text-gray-500 mb-4">Escolha como prefere pagar</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {paymentMethods.map((method) => {
            const visual = METHOD_VISUALS[method.id] ?? DEFAULT_VISUAL;
            const isSelected = selectedMethod === method.id;
            const Icon = visual.Icon;

            return (
              <button
                key={method.id}
                type="button"
                onClick={() => onMethodSelect(method.id)}
                className={`relative flex flex-col items-center justify-center text-center gap-1.5 min-h-[148px] rounded-xl border bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 ${
                  isSelected
                    ? `border-2 ${visual.border} shadow-lg ${visual.glow}`
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                {isSelected && (
                  <span className={`absolute -top-2 -right-2 w-5 h-5 rounded-full ${visual.badge} text-white flex items-center justify-center ring-2 ring-white shadow-sm`}>
                    <FaCheck className="text-[10px]" />
                  </span>
                )}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center ${visual.iconWrap}`}>
                  <Icon className="text-lg" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-800">{method.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-snug">{method.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedMethodData && selectedVisual && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <FaExternalLinkAlt className="text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-600">
                Vai abrir uma nova aba para concluir o pagamento com segurança.
                {selectedMethodData.id === 'credit_card'
                  ? ' Pagamentos com cartão Visa ou Mastercard podem demorar até 1-2 dias úteis a confirmar -- vai receber um email assim que estiver pronto.'
                  : ' Confirme o pagamento no seu telemóvel quando for solicitado.'}
              </p>
            </div>

            {errorMessage && (
              <StatusMessage type="error" message={errorMessage} />
            )}

            {successMessage && !errorMessage && (
              <StatusMessage type="info" message={successMessage} />
            )}

            {!isDocumentValid && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                Preencha todos os campos obrigatórios antes do pagamento:
                <ul className="list-disc ml-4 mt-1 space-y-1">
                  {documentValidationErrors.map((e: string, idx: number) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={onProcessPayment}
              disabled={isPaymentDisabled}
              className={`w-full text-white py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 text-base transition-all duration-200 shadow-lg hover:-translate-y-0.5 ${selectedVisual.button}`}
            >
              {isProcessing ? (
                <>
                  <FaSpinner className="animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                <>
                  Pagar {dynamicDocumentData.amount}
                  <FaArrowRight className="ml-2" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

const PreviewModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  dynamicDocumentData: any;
  renderedHtml: string;
}> = ({
  isOpen,
  onClose,
  dynamicDocumentData,
  renderedHtml
}) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
            <h3 className="font-semibold text-lg text-gray-800">
              Pré-visualização - {dynamicDocumentData.id}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-gray-50">
            <div
              className="bg-white p-6 shadow-sm mx-auto max-w-4xl"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
          <div className="p-4 border-t border-gray-200 flex justify-end bg-white">
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-medium text-sm transition-colors"
              onClick={onClose}
            >
              Fechar Pré-visualização
            </button>
          </div>
        </div>
      </div>
    );
  };

const PaymentScreen: React.FC<PaymentScreenProps> = ({
  invoiceData,
  renderedHtml,
  onInvoiceCreated
}) => {
  const {
    selectedMethod,
    paymentStatus,
    errorMessage,
    successMessage,
    documentSaveResult,
    isPreviewOpen,
    isGeneratingPdf,
    setSelectedMethod,
    setIsPreviewOpen,
    setErrorMessage: _setErrorMessage,
    processPayment,
    handleRetry: _handleRetry,
    handleDownload,
    handleEmailSend,
    paymentMethods,
    dynamicDocumentData,
    isDocumentValid,
    documentValidationErrors
  } = usePayment({
    invoiceData,
    onInvoiceCreated
  });

  const DocumentIcon = dynamicDocumentData.type === 'cotacao' ? FaQuoteLeft : FaFileInvoice;
  const isProcessing = paymentStatus === 'processing';
  const isPaymentDisabled = !selectedMethod || isProcessing || !isDocumentValid;

  if (paymentStatus === 'success') {
    return (
      <SuccessScreen
        dynamicDocumentData={dynamicDocumentData}
        documentSaveResult={documentSaveResult}
        renderedHtml={renderedHtml}
        isGeneratingPdf={isGeneratingPdf}
        handleDownload={handleDownload}
      />
    );
  }

  return (
    <div className={`${roboto.variable} font-sans`}>
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div>
                <h4 className="text-lg font-semibold mb-2">Liberar {dynamicDocumentData.typeDisplay}</h4>
                <p className="text-sm text-blue-600">
                  Pague a taxa de serviço para gerar sua {dynamicDocumentData.typeDisplayLower}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <h5 className="font-semibold text-gray-800 text-lg mb-3">
                Resumo da {dynamicDocumentData.typeDisplay}
              </h5>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Número:</span>
                  <span className="font-medium">{dynamicDocumentData.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cliente:</span>
                  <span className="font-medium text-right max-w-[200px] truncate">
                    {dynamicDocumentData.client}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quantidade de itens:</span>
                  <span className="font-medium">{dynamicDocumentData.totalItems}</span>
                </div>
              </div>
            </div>

            <PaymentMethodSelector
              paymentMethods={paymentMethods}
              selectedMethod={selectedMethod}
              onMethodSelect={setSelectedMethod}
              errorMessage={errorMessage ?? undefined}
              successMessage={successMessage ?? undefined}
              isProcessing={isProcessing}
              isPaymentDisabled={isPaymentDisabled}
              onProcessPayment={() => processPayment(renderedHtml)}
              dynamicDocumentData={dynamicDocumentData}
              isDocumentValid={isDocumentValid}
              documentValidationErrors={documentValidationErrors}
            />
          </div>

          <div className="lg:w-80">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-4">
              <h5 className="font-semibold text-gray-800 text-lg mb-3">Resumo do Pagamento</h5>

              <div className="space-y-4 mb-5 text-sm">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-gray-700 font-medium">Taxa de serviço:</span>
                  <span className="font-bold text-blue-600 text-lg">{dynamicDocumentData.amount}</span>
                </div>

                <div className="text-center text-gray-600 text-sm font-medium pt-2">
                  <DocumentIcon className="inline mr-2 mb-1" />
                  Você receberá:
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center">
                    <FaCheck className="text-green-500 mr-2 text-xs" />
                    <span>Documento personalizado</span>
                  </div>
                  <div className="flex items-center">
                    <FaCheck className="text-green-500 mr-2 text-xs" />
                    <span>Download em PDF</span>
                  </div>
                  <div className="flex items-center">
                    <FaCheck className="text-green-500 mr-2 text-xs" />
                    <span>Armazenamento seguro</span>
                  </div>
                  <div className="flex items-center">
                    <FaCheck className="text-green-500 mr-2 text-xs" />
                    <span>Envio por email*</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center">
                  *Se tiver email configurado na conta
                </p>
              </div>

              <div className="flex space-x-2 mb-4">
                <button
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-3 rounded-md font-medium flex items-center justify-center text-sm transition-colors"
                  onClick={() => setIsPreviewOpen(true)}
                >
                  <FaEye className="mr-2" />
                  Pré-visualizar
                </button>
                <button
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-3 rounded-md font-medium flex items-center justify-center text-sm transition-colors"
                  onClick={() => handleEmailSend()}
                >
                  <FaEnvelope className="mr-2" />
                  Dúvidas?
                </button>
              </div>

              {/* Informações de segurança movidas para abaixo dos botões */}
              <div className="pt-3 border-t border-gray-200 text-center">
                <div className="flex items-center justify-center text-gray-600 mb-2 text-sm">
                  <FaLock className="mr-2" />
                  <span className="font-medium">Pagamento Seguro</span>
                </div>
                <p className="text-gray-500 text-xs mb-3">
                  Seus dados estão protegidos e criptografados
                </p>
                <a
                  href="mailto:digitalhub.midia@gmail.com"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                >
                  Ajuda? digitalhub.midia@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>

        <PreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          dynamicDocumentData={dynamicDocumentData}
          renderedHtml={renderedHtml}
        />
      </div>
    </div>
  );
};

export default PaymentScreen;