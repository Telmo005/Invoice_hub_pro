import MainLayout from '@/app/components/layout/MainLayout';
import Footer from '@/app/components/layout/sections/Footer';

// Página criada para corrigir o 404 nos links do Footer -- conteúdo
// descreve fielmente o modelo de negócio atual (planos, pagamentos via
// PaySuite, responsabilidade sobre o conteúdo dos documentos). Não
// substitui aconselhamento jurídico -- recomenda-se revisão por um
// advogado antes de tratar isto como documento legal definitivo.

export default function TermosDeUsoPage() {
  return (
    <MainLayout title="Termos de Uso - Invoice Hub Pro" description="Termos de uso da Invoice Hub Pro">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-32 pb-20 text-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Termos de Uso</h1>
        <p className="text-sm text-gray-400 mb-10">Última atualização: julho de 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. O serviço</h2>
            <p>
              A Invoice Hub Pro é uma aplicação para criar e gerir faturas, cotações e
              recibos. Está disponível em dois modelos: pagamento por documento (10 MT por
              documento) ou subscrição mensal (250 MT/mês, documentos ilimitados). Os preços
              atuais estão sempre visíveis na página de Preços.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. A tua conta</h2>
            <p>
              O acesso é feito através de login com a tua conta Google. És responsável por
              manter o acesso a essa conta seguro -- qualquer pessoa com acesso à tua conta
              Google consegue aceder aos teus documentos na aplicação.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Responsabilidade pelo conteúdo</h2>
            <p>
              És responsável pela exatidão dos dados que introduzes nos teus documentos
              (dados fiscais, valores, impostos). A aplicação ajuda a gerar e organizar os
              documentos, mas não substitui aconselhamento contabilístico ou fiscal
              profissional.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Pagamentos e subscrição</h2>
            <p>
              Os pagamentos são processados pela PaySuite (M-Pesa, e-Mola ou cartão). Na
              subscrição mensal, a renovação não é automática -- enviamos um lembrete antes da
              data de cobrança e a criação direta de documentos fica bloqueada se o pagamento
              não for renovado. Podes cancelar a subscrição a qualquer momento, deixando
              simplesmente de a renovar.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Disponibilidade do serviço</h2>
            <p>
              Fazemos o possível para manter a aplicação disponível, mas não garantimos
              disponibilidade ininterrupta. Recomendamos guardar cópias dos teus documentos
              importantes fora da aplicação (download/impressão).
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Suporte e contacto</h2>
            <p>
              Para dúvidas, problemas técnicos ou pedidos relacionados com a tua conta, usa a
              opção de contacto/suporte disponível na aplicação.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Alterações a estes termos</h2>
            <p>
              Estes termos podem ser atualizados à medida que o serviço evolui. Vamos indicar
              sempre a data da última atualização no topo desta página.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </MainLayout>
  );
}
