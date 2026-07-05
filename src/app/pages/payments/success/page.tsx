'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/app/components/layout/sections/Navbar';
import { ROUTES } from '@/config/routes';
import { FiCheckCircle, FiAlertTriangle, FiEye, FiDownload, FiArrowLeft } from 'react-icons/fi';
import { FaSpinner } from 'react-icons/fa';

// Fase 4: página de destino depois de o utilizador concluir o pagamento no
// PaySuite (returnUrl em /api/payments/checkout) -- substitui o redireccionamento
// anterior para a lista genérica de documentos. Aqui a pessoa vê logo o
// documento que acabou de pagar, sem ter de o procurar na lista.
//
// O PaySuite pode entregar um payment.failed prematuro antes do
// payment.success real para o mesmo pagamento (confirmado em produção,
// 2026-07-03) -- por isso um único "falhado" não é tratado como definitivo
// aqui, mesma tolerância usada em usePayment.ts/useSubscription.ts.

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 100;
const FALHADO_GRACE_ATTEMPTS = 10;

type ViewState = 'loading' | 'success' | 'failed' | 'timeout';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('payment_id');

  const [viewState, setViewState] = useState<ViewState>('loading');
  const [documento, setDocumento] = useState<{ id: string; numero: string } | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!paymentId || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    let falhadoSeenAtAttempt: number | null = null;

    const poll = async () => {
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        if (cancelled) return;
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

        try {
          const res = await fetch(`/api/payments/status/${paymentId}`, { credentials: 'include' });
          const data = await res.json();
          if (!res.ok || !data.success) continue;

          if (data.data.status === 'pago' && data.data.documento) {
            if (!cancelled) {
              setDocumento(data.data.documento);
              setViewState('success');
            }
            return;
          }

          if (data.data.status === 'falhado') {
            if (falhadoSeenAtAttempt === null) {
              falhadoSeenAtAttempt = attempt;
              continue;
            }
            if (attempt - falhadoSeenAtAttempt >= FALHADO_GRACE_ATTEMPTS) {
              if (!cancelled) setViewState('failed');
              return;
            }
          }
        } catch {
          // ignora falhas pontuais de rede, continua a tentar
        }
      }

      if (!cancelled) setViewState('timeout');
    };

    poll();

    return () => { cancelled = true; };
  }, [paymentId]);

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <Navbar />
      <div className="py-3 border-top border-bottom border-2" />
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          {!paymentId && (
            <>
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-amber-100 mb-4">
                <FiAlertTriangle className="text-amber-600" size={24} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Referência de pagamento em falta</h1>
              <p className="text-sm text-gray-500 mb-6">Não conseguimos identificar qual pagamento estás a confirmar.</p>
            </>
          )}

          {paymentId && viewState === 'loading' && (
            <>
              <FaSpinner className="animate-spin text-blue-500 mx-auto mb-4" size={36} />
              <h1 className="text-xl font-bold text-gray-900 mb-2">A confirmar o seu pagamento...</h1>
              <p className="text-sm text-gray-500">Isto pode demorar alguns segundos. Não feche esta página.</p>
            </>
          )}

          {viewState === 'success' && documento && (
            <>
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-green-100 mb-4">
                <FiCheckCircle className="text-green-600" size={26} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Documento pronto!</h1>
              <p className="text-sm text-gray-500 mb-6">
                O documento <span className="font-semibold text-gray-700">{documento.numero}</span> foi gerado com sucesso.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <a
                  href={`/api/document/view/${documento.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50 py-3 px-4 rounded-xl font-semibold flex items-center justify-center text-sm transition-colors"
                >
                  <FiEye className="mr-2" /> Ver documento
                </a>
                <a
                  href={`/api/document/pdf/${documento.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center text-sm shadow-lg shadow-green-500/25 transition-colors"
                >
                  <FiDownload className="mr-2" /> Imprimir / Guardar PDF
                </a>
              </div>
            </>
          )}

          {viewState === 'failed' && (
            <>
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100 mb-4">
                <FiAlertTriangle className="text-red-600" size={24} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">O pagamento não foi concluído</h1>
              <p className="text-sm text-gray-500 mb-6">Não foi possível confirmar este pagamento. Tenta novamente a partir do documento.</p>
            </>
          )}

          {viewState === 'timeout' && (
            <>
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-blue-100 mb-4">
                <FiCheckCircle className="text-blue-600" size={24} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Ainda a processar</h1>
              <p className="text-sm text-gray-500 mb-6">
                O seu pagamento ainda está a ser confirmado (comum em pagamentos por cartão). Vai receber um email assim que o documento estiver pronto.
              </p>
            </>
          )}

          <Link
            href={ROUTES.QUOTES_INVOICES}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mt-2"
          >
            <FiArrowLeft /> Voltar aos meus documentos
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
        <Navbar />
        <div className="py-3 border-top border-bottom border-2" />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <FaSpinner className="animate-spin text-blue-500 mx-auto" size={36} />
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
