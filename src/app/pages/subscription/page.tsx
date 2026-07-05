'use client';

import Navbar from '@/app/components/layout/sections/Navbar';
import { useSubscription } from '@/app/hooks/payment/useSubscription';
import { PaymentMethodPicker } from '@/app/components/payment/PaymentMethodPicker';
import { FiCheckCircle, FiAlertTriangle, FiInfo, FiExternalLink, FiArrowRight, FiCheck } from 'react-icons/fi';
import { FaSpinner, FaCheck, FaExclamationTriangle, FaExternalLinkAlt } from 'react-icons/fa';
import React, { useState } from 'react';

// 'credit_card' temporariamente oculto (2026-07-05): PaySuite rejeita este
// método (HTTP 422 "The selected method is invalid") para esta conta -- ver
// mesma nota em usePayment.ts.
const METHOD_OPTIONS = [
  { id: 'mpesa', name: 'M-Pesa', description: 'Confirmação instantânea' },
  { id: 'emola', name: 'e-Mola', description: 'Confirmação instantânea' }
];

export default function SubscriptionPage() {
  const { subscription, isLoading, isSubscribing, errorMessage, successMessage, checkoutUrl, subscribe } = useSubscription();
  const [selectedMethod, setSelectedMethod] = useState<string | null>('mpesa');

  const isMensal = subscription?.plano === 'mensal';
  const isAtiva = isMensal && subscription?.status === 'ativa';
  const isVencida = isMensal && subscription?.status === 'vencida';

  const bannerSubtitle = isAtiva
    ? 'A sua assinatura mensal está ativa -- crie documentos sem limites.'
    : isVencida
      ? 'A sua assinatura expirou. Renove para recuperar o acesso ilimitado.'
      : 'Assine o plano mensal e crie faturas, cotações e recibos sem limites.';

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <Navbar />
      <div className="py-3 border-top border-bottom border-2" />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6 p-6 bg-blue-50 rounded-2xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">A minha assinatura</h1>
          <p className="text-sm text-blue-600 font-medium">{bannerSubtitle}</p>
        </div>

        {isLoading && (
          <div className="text-center py-16 text-gray-500">Carregando estado da assinatura...</div>
        )}

        {!isLoading && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              {isAtiva && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <FiCheckCircle className="text-green-600" size={22} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Assinatura mensal ativa</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Próxima renovação: {subscription?.data_proxima_cobranca
                        ? new Date(subscription.data_proxima_cobranca).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric' })
                        : '-'}
                    </p>
                  </div>
                </div>
              )}

              {isVencida && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <FiAlertTriangle className="text-amber-600" size={22} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">A sua assinatura expirou</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      A criação direta de documentos está bloqueada até renovar.
                    </p>
                  </div>
                </div>
              )}

              {!isMensal && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <FiInfo className="text-blue-600" size={22} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Plano atual: pagar por documento</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {subscription?.precos.pay_per_documento.valor} {subscription?.precos.pay_per_documento.moeda} por documento gerado
                    </p>
                  </div>
                </div>
              )}

              {!isAtiva && (
                <>
                  <div className="flex items-end justify-between mt-5 pt-4 border-t border-gray-100">
                    <div>
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Plano mensal</div>
                      <div className="text-sm text-gray-600">Documentos ilimitados</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Valor</div>
                      <div className="text-2xl font-bold text-green-600">
                        {subscription?.precos.mensal.valor} {subscription?.precos.mensal.moeda}
                        <span className="text-sm font-medium text-gray-400">/mês</span>
                      </div>
                    </div>
                  </div>

                  <ul className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <FiCheck className="text-green-500 mt-0.5 flex-shrink-0" /> Faturas, cotações e recibos sem custo por documento
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <FiCheck className="text-green-500 mt-0.5 flex-shrink-0" /> Sem fidelização -- cancela quando quiser, deixando de renovar
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <FiCheck className="text-green-500 mt-0.5 flex-shrink-0" /> Renovação manual por email, nunca cobramos o cartão automaticamente
                    </li>
                  </ul>

                  {!isMensal && subscription?.precos.pay_per_documento && (
                    <p className="mt-3 text-xs text-gray-400">
                      A pagar por documento? Continuas a poder, a {subscription.precos.pay_per_documento.valor} {subscription.precos.pay_per_documento.moeda}/documento -- o plano mensal compensa a partir de{' '}
                      {Math.ceil(Number(subscription.precos.mensal.valor) / Number(subscription.precos.pay_per_documento.valor))} documentos/mês.
                    </p>
                  )}
                </>
              )}
            </div>

            {!isAtiva && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h5 className="font-semibold text-gray-800 text-base mb-4">Escolha como prefere pagar</h5>

                <div className="mb-5">
                  <PaymentMethodPicker
                    methods={METHOD_OPTIONS}
                    selectedMethod={selectedMethod}
                    onSelect={setSelectedMethod}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                    <FiExternalLink className="text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-700">
                      Vai abrir uma nova aba para concluir o pagamento com segurança.
                      {selectedMethod === 'credit_card'
                        ? ' Pagamentos com cartão Visa ou Mastercard podem demorar até 1-2 dias úteis a confirmar -- vai receber um email assim que estiver pronto.'
                        : ' Confirme o pagamento no seu telemóvel quando for solicitado.'}
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <FaExclamationTriangle className="text-red-500 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && !errorMessage && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <FaCheck className="text-blue-500 flex-shrink-0" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  <button
                    onClick={() => selectedMethod && subscribe(selectedMethod as 'mpesa' | 'emola' | 'credit_card')}
                    disabled={isSubscribing || !selectedMethod}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 text-base transition-all duration-200 shadow-lg shadow-green-500/25 hover:-translate-y-0.5"
                  >
                    {isSubscribing ? (
                      <>
                        <FaSpinner className="animate-spin mr-2" />
                        Processando...
                      </>
                    ) : (
                      <>
                        {isVencida ? 'Renovar' : 'Assinar'} ({subscription?.precos.mensal.valor} {subscription?.precos.mensal.moeda}/mês)
                        <FiArrowRight className="ml-2" />
                      </>
                    )}
                  </button>

                  {checkoutUrl && (
                    <a
                      href={checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50 py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center text-base transition-colors"
                    >
                      <FaExternalLinkAlt className="mr-2" />
                      Abrir página de pagamento
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
