'use client';

import React, { useEffect, useRef } from 'react';
import { Roboto } from 'next/font/google';
import { FaCheck, FaSpinner, FaExclamationTriangle, FaFilePdf, FaRedo } from 'react-icons/fa';
import { usePayment } from '@/app/hooks/payment/usePayment';

const roboto = Roboto({ weight: ['300', '400', '700'], subsets: ['latin'], variable: '--font-roboto' });

interface FinalizeStepProps {
  invoiceData: any;
  renderedHtml: string;
  onInvoiceCreated?: (invoiceId: string) => void;
}

// Substitui o antigo passo de pagamento (branch temp/remove-payments): em vez
// de escolher método e pagar, o documento é criado automaticamente ao entrar
// neste passo -- usePayment continua a chamar /api/payments/checkout, que
// agora cria sempre direto (ver hasActiveSubscription).
const FinalizeStep: React.FC<FinalizeStepProps> = ({ invoiceData, renderedHtml, onInvoiceCreated }) => {
  const {
    paymentStatus,
    errorMessage,
    successMessage,
    documentSaveResult,
    isGeneratingPdf,
    processPayment,
    handleDownload,
    dynamicDocumentData,
    isDocumentValid,
    documentValidationErrors,
  } = usePayment({ invoiceData, onInvoiceCreated });

  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !isDocumentValid) return;
    startedRef.current = true;
    processPayment(renderedHtml);
  }, [isDocumentValid, processPayment, renderedHtml]);

  if (!isDocumentValid) {
    return (
      <div className="min-h-[300px] flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <FaExclamationTriangle className="text-amber-500 text-2xl mx-auto mb-3" />
          <p className="text-sm text-amber-800 font-medium mb-2">Preencha todos os campos obrigatórios antes de finalizar:</p>
          <ul className="text-xs text-amber-700 list-disc text-left inline-block">
            {documentValidationErrors.map((e, idx) => <li key={idx}>{e}</li>)}
          </ul>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'success') {
    return (
      <div className="min-h-[300px] flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <FaCheck className="h-5 w-5 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">{dynamicDocumentData.typeDisplay} criada com sucesso!</h2>
          <div className="bg-gray-50 rounded-md p-4 mb-4 text-left text-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Número:</span>
              <span className="font-medium">{documentSaveResult?.documentNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Cliente:</span>
              <span className="font-medium text-right max-w-[150px] truncate">{dynamicDocumentData.client}</span>
            </div>
          </div>
          {successMessage && <p className="text-xs text-green-600 mb-3">{successMessage}</p>}
          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-md font-medium flex items-center justify-center text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-3"
            onClick={() => handleDownload(renderedHtml, documentSaveResult?.documentNumber)}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? <FaSpinner className="animate-spin mr-2" /> : <FaFilePdf className="mr-2" />}
            {isGeneratingPdf ? 'A preparar...' : 'Imprimir / Guardar PDF'}
          </button>
          <button
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-3 rounded-md font-medium text-sm transition-colors"
            onClick={() => window.location.reload()}
          >
            Criar Nova {dynamicDocumentData.typeDisplay}
          </button>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'error') {
    return (
      <div className="min-h-[300px] flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-lg shadow-sm border border-red-200 p-6 text-center">
          <FaExclamationTriangle className="text-red-500 text-2xl mx-auto mb-3" />
          <p className="text-sm text-red-700 font-medium mb-4">{errorMessage || 'Ocorreu um erro ao finalizar o documento.'}</p>
          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-md font-medium text-sm flex items-center justify-center"
            onClick={() => processPayment(renderedHtml)}
          >
            <FaRedo className="mr-2" /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${roboto.variable} font-sans min-h-[300px] flex items-center justify-center p-4`}>
      <div className="text-center">
        <FaSpinner className="animate-spin text-blue-500 text-3xl mx-auto mb-3" />
        <p className="text-gray-600 text-sm">{successMessage || 'A finalizar o documento...'}</p>
      </div>
    </div>
  );
};

export default FinalizeStep;
