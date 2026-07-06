import type { Metadata } from 'next';
import MainLayout from '@/app/components/layout/MainLayout';
import Footer from '@/app/components/layout/sections/Footer';

// Página criada para corrigir o 404 nos links do Footer -- conteúdo
// descreve fielmente o que a aplicação faz hoje (login Google, dados
// guardados no Supabase, pagamentos via PaySuite, emails via Gmail),
// verificado contra o código em vez de ser texto genérico copiado. Não
// substitui aconselhamento jurídico -- recomenda-se revisão por um
// advogado antes de tratar isto como documento legal definitivo.

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Política de privacidade do Invoice Hub Pro: que dados recolhemos, onde ficam guardados e como são usados.',
  alternates: { canonical: '/politica-de-privacidade' },
};

export default function PoliticaDePrivacidadePage() {
  return (
    <MainLayout>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-32 pb-20 text-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-gray-400 mb-10">Última atualização: julho de 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Que dados recolhemos</h2>
            <p>
              Ao iniciares sessão através da tua conta Google, recebemos o teu nome, email e
              foto de perfil associados a essa conta. Ao usares a aplicação, guardamos os
              dados que introduzes: dados da tua empresa (nome, país, cidade, contactos,
              documento fiscal), dados de clientes/destinatários, e o conteúdo das faturas,
              cotações e recibos que crias.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Onde os dados ficam guardados</h2>
            <p>
              Os teus dados são guardados numa base de dados Supabase (PostgreSQL), com
              controlo de acesso ao nível da base de dados (Row Level Security) para que só
              a tua conta consiga aceder aos teus próprios documentos e clientes.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Pagamentos</h2>
            <p>
              Os pagamentos (M-Pesa, e-Mola ou cartão) são processados pela PaySuite, um
              gateway de pagamentos terceiro. Não guardamos dados de cartão nem números de
              M-Pesa/e-Mola nos nossos servidores -- esses dados são inseridos diretamente na
              página de checkout da PaySuite.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Links de documentos partilhados</h2>
            <p>
              Quando envias uma fatura, cotação ou recibo a um cliente por email, geramos um
              link de visualização público (sem necessidade de login) para que o teu cliente
              o possa consultar. Esse link não é indexado nem listado publicamente, mas
              qualquer pessoa com o link consegue ver o documento -- evita partilhá-lo fora do
              contexto pretendido.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Emails</h2>
            <p>
              Usamos email para enviar documentos aos teus clientes, lembretes de subscrição,
              e para receber mensagens de contacto/suporte que envies através da aplicação.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Os teus direitos</h2>
            <p>
              Podes pedir a eliminação da tua conta e dos dados associados, ou esclarecer
              qualquer dúvida sobre os teus dados, contactando-nos através da página de
              contacto/suporte da aplicação.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Alterações a esta política</h2>
            <p>
              Esta política pode ser atualizada à medida que a aplicação evolui. Vamos
              indicar sempre a data da última atualização no topo desta página.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </MainLayout>
  );
}
