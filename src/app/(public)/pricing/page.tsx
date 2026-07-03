'use client';

import { useRouter } from 'next/navigation';
import { FiCheck } from 'react-icons/fi';
import MainLayout from '@/app/components/layout/MainLayout';
import Footer from '@/app/components/layout/sections/Footer';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/app/providers/AuthProvider';
import { PLANS } from '@/lib/payments/config';

// Fase 4 bloco 4f: página pública de preços. Não faz o checkout aqui --
// reencaminha para /pages/subscription (bloco 4e), que já tem a seleção de
// método de pagamento e o fluxo de checkout+poll do PaySuite. Visitantes sem
// sessão são enviados primeiro para o login com redirect_to.

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const goToSubscription = () => {
    if (user) {
      router.push(ROUTES.SUBSCRIPTION);
    } else {
      router.push(`${ROUTES.LOGIN}?redirect_to=${ROUTES.SUBSCRIPTION}`);
    }
  };

  const goToStart = () => {
    if (user) {
      router.push(ROUTES.INVOICES_NEW);
    } else {
      router.push(`${ROUTES.LOGIN}?redirect_to=${ROUTES.INVOICES_NEW}`);
    }
  };

  return (
    <MainLayout title="Preços - Invoice Hub Pro" description="Planos e preços da Invoice Hub Pro">
      <section className="relative min-h-screen bg-slate-950 text-white pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto text-center mb-14">
          <div className="inline-flex items-center bg-slate-850 border border-slate-700 rounded-full px-4 py-2 mb-6 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-amber-400 mr-2 animate-pulse" />
            <span className="text-sm text-slate-200">PREÇOS</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-400">
              Escolha como quer pagar
            </span>
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Sem letras pequenas. Pague por documento quando precisar, ou assine e crie sem limites.
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Pay-per-documento */}
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col">
            <h2 className="text-xl font-semibold text-white mb-1">{PLANS.pay_per_documento.label}</h2>
            <p className="text-slate-400 text-sm mb-6">Ideal para quem só precisa de emitir documentos ocasionalmente.</p>

            <div className="mb-6">
              <span className="text-4xl font-bold text-white">{PLANS.pay_per_documento.valor} MT</span>
              <span className="text-slate-400 text-sm"> / documento</span>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <FiCheck className="text-amber-400 mt-0.5 flex-shrink-0" /> Sem mensalidade nem fidelização
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <FiCheck className="text-amber-400 mt-0.5 flex-shrink-0" /> Pague só quando gerar fatura, cotação ou recibo
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <FiCheck className="text-amber-400 mt-0.5 flex-shrink-0" /> M-Pesa, e-Mola ou cartão
              </li>
            </ul>

            <button
              onClick={goToStart}
              className="w-full border border-slate-700 hover:border-slate-600 hover:bg-slate-800 transition-colors rounded-lg px-6 py-3 font-medium text-white"
            >
              Começar agora
            </button>
          </div>

          {/* Mensal */}
          <div className="relative bg-gradient-to-b from-amber-500/10 to-slate-900 border border-amber-500/40 rounded-2xl p-8 flex flex-col shadow-xl shadow-amber-900/10">
            <div className="absolute -top-3 right-6 bg-amber-500 text-slate-950 text-xs font-semibold px-3 py-1 rounded-full">
              Mais popular
            </div>
            <h2 className="text-xl font-semibold text-white mb-1">{PLANS.mensal.label}</h2>
            <p className="text-slate-400 text-sm mb-6">{PLANS.mensal.descricao}</p>

            <div className="mb-6">
              <span className="text-4xl font-bold text-white">{PLANS.mensal.valor} MT</span>
              <span className="text-slate-400 text-sm"> / mês</span>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <FiCheck className="text-amber-400 mt-0.5 flex-shrink-0" /> Faturas, cotações e recibos ilimitados
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <FiCheck className="text-amber-400 mt-0.5 flex-shrink-0" /> Sem custo adicional por documento
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <FiCheck className="text-amber-400 mt-0.5 flex-shrink-0" /> M-Pesa, e-Mola ou cartão
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <FiCheck className="text-amber-400 mt-0.5 flex-shrink-0" /> Cancele quando quiser
              </li>
            </ul>

            <button
              onClick={goToSubscription}
              className="w-full bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 transition-all rounded-lg px-6 py-3 font-semibold text-white shadow-lg"
            >
              Assinar agora
            </button>
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-10">
          Pagamentos por cartão podem demorar até 1-2 dias úteis a confirmar. M-Pesa e e-Mola são confirmados na hora.
        </p>
      </section>
      <Footer />
    </MainLayout>
  );
}
