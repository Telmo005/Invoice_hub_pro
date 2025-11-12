// src/app/components/payment/PaymentScreen.tsx
'use client';

import { useState } from 'react';
import { Roboto } from 'next/font/google';
import Image from 'next/image';
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
  FaChevronDown
} from 'react-icons/fa';
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
}

const StatusMessage: React.FC<StatusMessageProps> = ({ type, message }) => {
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700'
  };

  const icons = {
    success: <FaCheck className="text-green-500" />,
    error: <FaExclamationTriangle className="text-red-500" />,
    info: <FaInfoCircle className="text-blue-500" />,
    warning: <FaInfoCircle className="text-yellow-500" />
  };

  return (
    <div className={`p-3 border rounded-md flex items-start space-x-2 mb-4 ${styles[type]}`}>
      {icons[type]}
      <span className="text-sm flex-1">{message}</span>
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

const PaymentMethodImage: React.FC<{
  methodId: string;
  imagePath: string;
  className?: string;
}> = ({
  methodId,
  imagePath,
  className = "w-6 h-6"
}) => {
    return (
      <div className={`relative ${className}`}>
        <Image
          src={imagePath}
          alt={methodId}
          fill
          className="object-contain"
        />
      </div>
    );
  };

const PaymentMethodDropdown: React.FC<{
  paymentMethods: any[];
  selectedMethod: string | null;
  contactNumber: string;
  onMethodSelect: (method: string) => void;
  onContactChange: (value: string) => void;
}> = ({
  paymentMethods,
  selectedMethod,
  contactNumber,
  onMethodSelect,
  onContactChange
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const selectedMethodData = paymentMethods.find(method => method.id === selectedMethod);

    const handleMethodSelect = (methodId: string) => {
      onMethodSelect(methodId);
      setIsDropdownOpen(false);
    };

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h5 className="font-semibold text-gray-800 text-lg mb-3">
          Método de Pagamento
        </h5>

        <div className="relative mb-4">
          <button
            type="button"
            className="w-full px-4 py-3 text-left bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between hover:border-gray-400 transition-colors"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className="flex items-center">
              {selectedMethodData ? (
                <>
                  <PaymentMethodImage
                    methodId={selectedMethodData.id}
                    imagePath={selectedMethodData.imagePath}
                    className="w-6 h-6 mr-3"
                  />
                  <span className="font-medium">{selectedMethodData.name}</span>
                </>
              ) : (
                <span className="text-gray-500">Selecione método de pagamento</span>
              )}
            </div>
            <FaChevronDown className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center border-b border-gray-100 last:border-b-0 transition-colors"
                  onClick={() => handleMethodSelect(method.id)}
                >
                  <PaymentMethodImage
                    methodId={method.id}
                    imagePath={method.imagePath}
                    className="w-6 h-6 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{method.name}</div>
                    <div className="text-sm text-gray-600">{method.description}</div>
                  </div>
                  {selectedMethod === method.id && (
                    <FaCheck className="text-green-500 ml-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedMethodData && (
          <div className="p-4 border-2 rounded-lg bg-red-50 border-red-200 transition-all">
            <div className="flex items-center mb-3">
              <PaymentMethodImage
                methodId={selectedMethodData.id}
                imagePath={selectedMethodData.imagePath}
                className="w-8 h-8 mr-3"
              />
              <div>
                <h4 className="font-semibold text-gray-800 text-base">{selectedMethodData.name}</h4>
                <p className="text-gray-600 text-sm">{selectedMethodData.description}</p>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                Seu número para confirmação:
              </label>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => onContactChange(e.target.value)}
                placeholder="84 123 4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-colors"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enviaremos uma confirmação para este número
              </p>
            </div>
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
    setErrorMessage: _setErrorMessage,
    processPayment,
    handleRetry: _handleRetry,
    handleDownload,
    handleEmailSend,
    paymentMethods,
    dynamicDocumentData
  } = usePayment({
    invoiceData,
    onInvoiceCreated
  });

  const DocumentIcon = dynamicDocumentData.type === 'cotacao' ? FaQuoteLeft : FaFileInvoice;
  const isProcessing = paymentStatus === 'processing' || isCreating;
  const isPaymentDisabled = !selectedMethod || isProcessing || !contactNumber.trim();

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

        {successMessage && !errorMessage && (
          <StatusMessage type="info" message={successMessage} />
        )}

        {errorMessage && (
          <StatusMessage type="error" message={errorMessage} />
        )}

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

            <PaymentMethodDropdown
              paymentMethods={paymentMethods}
              selectedMethod={selectedMethod}
              contactNumber={contactNumber}
              onMethodSelect={setSelectedMethod}
              onContactChange={setContactNumber}
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

              <button
                onClick={() => processPayment(renderedHtml)}
                disabled={isPaymentDisabled}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-semibold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed mb-3 text-base transition-colors"
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