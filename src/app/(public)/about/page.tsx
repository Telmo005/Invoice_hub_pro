import type { Metadata } from 'next';
import MainLayout from '@/app/components/layout/MainLayout';
import Footer from '@/app/components/layout/sections/Footer';

// Página "Sobre" (2026-09-04): identifica publicamente a pessoa responsável
// pelo Invoice Hub Pro. Existia como rota reservada em ROUTES.ABOUT sem
// página associada -- criada agora para que revisores externos (ex.
// compliance de processadores de pagamento) consigam confirmar quem opera
// o serviço, sem depender só do formulário de contacto.

export const metadata: Metadata = {
  title: 'Sobre',
  description: 'Quem está por trás do Invoice Hub Pro e como entrar em contacto.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <MainLayout>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-32 pb-20 text-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sobre</h1>
        <p className="text-sm text-gray-400 mb-10">Última atualização: setembro de 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Quem está por trás do Invoice Hub Pro</h2>
            <p>
              O Invoice Hub Pro é desenvolvido e operado por <strong>Telmo Augusto Sigauque Junior</strong>,
              pessoa individual (freelancer) sediada em Moçambique. Não é um produto de uma agência ou
              empresa terceira -- é um projeto próprio, criado para ajudar pequenos negócios e
              freelancers moçambicanos a emitir faturas, cotações e recibos profissionais.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">O que fazemos</h2>
            <p>
              A aplicação permite criar, gerir e partilhar faturas, cotações e recibos com modelos
              profissionais, numeração automática e envio direto por email aos clientes. Os planos e
              preços atuais estão sempre visíveis na página de Preços.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Contacto direto</h2>
            <p>
              Para qualquer questão sobre o serviço, faturação ou os teus dados, podes contactar
              diretamente:
            </p>
            <ul className="mt-3 space-y-1">
              <li>
                Email:{' '}
                <a href="mailto:telmo.sigauquejr@gmail.com" className="text-indigo-600 hover:underline">
                  telmo.sigauquejr@gmail.com
                </a>
              </li>
              <li>
                WhatsApp/Telefone:{' '}
                <a href="tel:+258842010505" className="text-indigo-600 hover:underline">
                  +258 84 201 0505
                </a>
              </li>
              <li>Localização: Moçambique</li>
            </ul>
            <p className="mt-3">
              Também podes usar o formulário de &quot;Contactar Suporte&quot; disponível no rodapé de
              qualquer página.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </MainLayout>
  );
}
