'use client';

import Navbar from '@/app/components/layout/sections/Navbar';
import { useSubscription } from '@/app/hooks/payment/useSubscription';
import { FiCheckCircle, FiAlertTriangle, FiCreditCard } from 'react-icons/fi';
import React, { useState } from 'react';

const METHOD_OPTIONS: { id: 'mpesa' | 'emola' | 'credit_card'; label: string }[] = [
  { id: 'mpesa', label: 'M-Pesa' },
  { id: 'emola', label: 'e-Mola' },
  { id: 'credit_card', label: 'Cartão (Visa/Mastercard)' }
];

export default function SubscriptionPage() {
  const { subscription, isLoading, isSubscribing, errorMessage, successMessage, subscribe } = useSubscription();
  const [selectedMethod, setSelectedMethod] = useState<'mpesa' | 'emola' | 'credit_card'>('mpesa');

  const isMensal = subscription?.plano === 'mensal';
  const isAtiva = isMensal && subscription?.status === 'ativa';
  const isVencida = isMensal && subscription?.status === 'vencida';

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <Navbar />
      <div className="py-3 border-top border-bottom border-2" />
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold text-gray-800 mb-5">A minha assinatura</h1>

        {isLoading && (
          <div className="text-center py-16 text-gray-600">Carregando estado da assinatura...</div>
        )}

        {!isLoading && (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-6">
            {isAtiva && (
              <div className="flex items-start gap-3">
                <FiCheckCircle className="text-green-500 mt-1 flex-shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-gray-800">Assinatura mensal ativa</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Próxima renovação: {subscription?.data_proxima_cobranca
                      ? new Date(subscription.data_proxima_cobranca).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric' })
                      : '-'}
                  </p>
                </div>
              </div>
            )}

            {isVencida && (
              <div className="flex items-start gap-3 mb-4">
                <FiAlertTriangle className="text-amber-500 mt-1 flex-shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-gray-800">A sua assinatura expirou</p>
                  <p className="text-sm text-gray-600 mt-1">
                    A criação direta de documentos está bloqueada. Renove para recuperar o acesso.
                  </p>
                </div>
              </div>
            )}

            {!isMensal && (
              <div className="mb-4">
                <p className="font-semibold text-gray-800">Plano atual: pagar por documento</p>
                <p className="text-sm text-gray-600 mt-1">
                  Paga {subscription?.precos.pay_per_documento.valor} {subscription?.precos.pay_per_documento.moeda} sempre que gerar um documento.
                  Assine o plano mensal por {subscription?.precos.mensal.valor} {subscription?.precos.mensal.moeda}/mês para criação ilimitada.
                </p>
              </div>
            )}

            {!isAtiva && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <p className="font-medium text-gray-800 mb-3">Método de pagamento</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {METHOD_OPTIONS.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedMethod(option.id)}
                      className={`px-4 py-2 rounded-md text-sm font-medium border ${
                        selectedMethod === option.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => subscribe(selectedMethod)}
                  disabled={isSubscribing}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-md font-semibold text-sm"
                >
                  <FiCreditCard />
                  {isSubscribing ? 'Processando...' : `${isVencida ? 'Renovar' : 'Assinar'} (${subscription?.precos.mensal.valor} ${subscription?.precos.mensal.moeda}/mês)`}
                </button>

                <p className="text-xs text-gray-500 mt-3">
                  Vai ser aberta uma nova aba para concluir o pagamento com segurança. Pagamentos por cartão podem demorar até 1-2 dias úteis a confirmar.
                </p>
              </div>
            )}

            {errorMessage && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{errorMessage}</div>
            )}
            {successMessage && !errorMessage && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">{successMessage}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
