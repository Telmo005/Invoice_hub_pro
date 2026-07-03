// src/app/components/payment/PaymentScreen.tsx
'use client';

import { Roboto } from 'next/font/google';
import {
  FaCheck,
  FaSpinner,
  FaEnvelope,
  FaEye,
  FaShieldAlt,
  FaArrowRight,
  FaFileInvoice,
  FaExclamationTriangle,
  FaInfoCircle,
  FaQuoteLeft,
  FaFilePdf,
  FaMobileAlt,
  FaWallet,
  FaExternalLinkAlt,
  FaCommentDots
} from 'react-icons/fa';
import { SiVisa, SiMastercard } from 'react-icons/si';
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

// Visual de cada método. Para o cartão usamos os ícones reais da Visa/
// Mastercard (react-icons/si -- Simple Icons, uso padrão em checkouts para
// indicar redes aceites). Não há um ícone de marca disponível para M-Pesa
// nem e-Mola nesta biblioteca (nem temos assets licenciados delas), por
// isso usamos um ícone genérico com a cor aproximada de cada marca em vez
// de reproduzir um logótipo que não é o correto.
const METHOD_VISUALS: Record<string, { renderIcon: () => React.ReactNode }> = {
  mpesa: { renderIcon: () => <FaMobileAlt className="text-xl text-red-500" /> },
  emola: { renderIcon: () => <FaWallet className="text-xl text-teal-500" /> },
  credit_card: {
    renderIcon: () => (
      <div className="flex items-center gap-1">
        <SiVisa className="text-lg" color="#1A1F71" />
        <SiMastercard className="text-lg" color="#EB001B" />
      </div>
    )
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

    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h5 className="font-semibold text-gray-800 text-base mb-4">
          Escolha como prefere pagar
        </h5>

        <div className="space-y-3 mb-5">
          {paymentMethods.map((method) => {
            const visual = METHOD_VISUALS[method.id] ?? DEFAULT_VISUAL;
            const isSelected = selectedMethod === method.id;

            return (
              <button
                key={method.id}
                type="button"
                onClick={() => onMethodSelect(method.id)}
                className={`w-full flex items-center gap-4 text-left rounded-2xl p-4 transition-all duration-200 ${
                  isSelected
                    ? 'bg-blue-50 border-2 border-blue-400 shadow-md shadow-blue-100'
                    : 'bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200'
                }`}
              >
                <div className="w-14 h-14 rounded-full bg-white shadow-md shadow-black/5 flex items-center justify-center flex-shrink-0">
                  {visual.renderIcon()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-800">{method.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-snug">{method.description}</div>
                </div>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? 'bg-blue-500 text-white' : 'bg-transparent border-2 border-gray-200'
                  }`}
                >
                  {isSelected && <FaCheck className="text-[11px]" />}
                </span>
              </button>
            );
          })}
        </div>

        {selectedMethodData && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <FaExternalLinkAlt className="text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-700">
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
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 text-base transition-all duration-200 shadow-lg shadow-green-500/25 hover:-translate-y-0.5"
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
        <div className="mb-6 p-6 bg-blue-50 rounded-2xl">
          <h4 className="text-2xl font-bold text-gray-900 mb-1">Método de Pagamento</h4>
          <p className="text-sm text-blue-600 font-medium">
            Escolha como prefere pagar e conclua a sua {dynamicDocumentData.typeDisplayLower}.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Documento</div>
                  <div className="font-semibold text-gray-800">{dynamicDocumentData.id}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Cliente</div>
                  <div className="font-semibold text-gray-800 truncate">{dynamicDocumentData.client}</div>
                </div>
              </div>
              <div className="flex items-end justify-between pt-4 border-t border-gray-100">
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Quantidade de itens</div>
                  <div className="font-semibold text-gray-800">{dynamicDocumentData.totalItems}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Total a pagar</div>
                  <div className="text-2xl font-bold text-green-600">{dynamicDocumentData.amount}</div>
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

          <div className="lg:w-80 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 sticky top-4">
              <div className="flex items-center gap-2 text-gray-800 font-semibold mb-4">
                <FaCommentDots className="text-gray-400" />
                <span>Você receberá</span>
              </div>

              <div className="space-y-2.5 text-sm mb-4">
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
              <p className="text-xs text-gray-400">
                *Se tiver email configurado na conta.
              </p>

              <div className="flex gap-2 mt-5 pt-4 border-t border-gray-100">
                <button
                  className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 px-3 rounded-lg font-medium flex items-center justify-center text-sm transition-colors"
                  onClick={() => setIsPreviewOpen(true)}
                >
                  <FaEye className="mr-2" />
                  Pré-visualizar
                </button>
                <button
                  className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 px-3 rounded-lg font-medium flex items-center justify-center text-sm transition-colors"
                  onClick={() => handleEmailSend()}
                >
                  <FaEnvelope className="mr-2" />
                  Dúvidas?
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 text-gray-800 font-semibold mb-2">
                <FaShieldAlt className="text-green-500" />
                <span>Pagamento Seguro</span>
              </div>
              <p className="text-gray-500 text-sm mb-4">
                Seus dados estão protegidos e criptografados.
              </p>
              <div className="pt-3 border-t border-gray-100">
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