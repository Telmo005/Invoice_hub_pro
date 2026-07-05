# Plano de Testes — Invoice Hub Pro

Lista de testes manuais para validar a aplicação de ponta a ponta antes de considerar uma sessão de correções "fechada". Organizado por área funcional. Usa duas contas de teste diferentes ("Utilizador A" e "Utilizador B") sempre que o teste envolver isolamento de dados entre utilizadores.

## 1. Autenticação e sessão

- [ ] Login com Google funciona e redireciona para a página certa.
- [ ] Aceder a uma rota privada sem sessão redireciona para `/login` (com `redirect_to` a apontar de volta).
- [ ] Aceder a uma rota pública (`/`, `/pricing`, `/politica-de-privacidade`, `/termos-de-uso`) sem sessão funciona normalmente.
- [ ] Sessão expirada durante o uso (ex.: deixar o separador aberto várias horas) mostra uma mensagem clara ("sessão expirou") em vez de um erro técnico, ao tentar uma ação (editar, eliminar, etc.).
- [ ] Logout limpa a sessão e bloqueia acesso a rotas privadas até novo login.

## 2. Entidades (emissores/clientes)

- [ ] Criar uma nova empresa emitente com todos os campos obrigatórios.
- [ ] Criar uma empresa com **cada tipo de Documento Fiscal** (NUIT, NIF, VAT, TIN, CPF, Outro) — confirmar que só o NUIT (com país Moçambique) exige 9 dígitos; os restantes aceitam qualquer valor não vazio.
- [ ] Tentar guardar um NUIT inválido (menos de 9 dígitos) com país Moçambique — deve ser rejeitado com mensagem clara.
- [ ] Usar o autocomplete de País: escrever parte do nome (com e sem acentos, ex. "mocambique" vs "Moçambique") e confirmar que filtra corretamente; abrir a lista completa pelo botão e selecionar diretamente.
- [ ] Editar uma empresa existente e confirmar que os dados persistem (incluindo tipo de documento fiscal e país).
- [ ] Eliminar uma empresa e confirmar que desaparece da lista.
- [ ] Marcar uma empresa como "padrão" e confirmar que aparece pré-selecionada num novo documento.
- [ ] Upload de logo: ficheiro válido (PNG/JPG/WEBP/SVG, <2MB) funciona; ficheiro demasiado grande ou formato inválido é rejeitado com mensagem clara.
- [ ] Criar uma empresa com um NUIT/documento duplicado — deve ser rejeitado ("Documento duplicado").

## 3. Criação de documentos (wizard) — repetir para Fatura, Cotação e Recibo

- [ ] Completar o wizard do início ao fim sem selecionar uma empresa existente (preenchimento manual de todos os campos).
- [ ] Completar o wizard selecionando uma empresa emitente já guardada (dados pré-preenchidos corretamente, incluindo tipo de documento fiscal).
- [ ] Alterar dados do emitente a meio do wizard (depois de selecionar uma empresa existente) — deve aparecer o modal "Atualizar Dados do Emissor?"; testar tanto "Atualizar" (deve persistir na BD, sem erro) como "Pular".
- [ ] Adicionar múltiplos itens, cada um com taxas diferentes (percentual e fixo); confirmar que os totais (subtotal, impostos, desconto, total final) calculam corretamente na pré-visualização.
- [ ] Aplicar desconto percentual >100% — deve ser rejeitado.
- [ ] Selecionar um template e mudar a cor de destaque; confirmar visualmente que a cor aplicada na pré-visualização é a mesma que aparece no documento final (após pagamento/criação) — **este era o bug da condição de corrida corrigido nesta sessão; testar mudando a cor e avançando imediatamente para o pagamento, sem esperar.**
- [ ] Criar um 2º e 3º documento do mesmo tipo **na mesma sessão do browser, sem recarregar a página** — confirmar que não trava nem mostra "documento já existe" (bug corrigido nesta sessão).
- [ ] Verificar que o número de dois documentos criados em sequência (mesmo tipo, mesmo utilizador) é realmente sequencial (ex. FTR/2026/010 seguido de FTR/2026/011).
- [ ] Criar documentos em simultâneo a partir de **dois separadores/dispositivos diferentes** com o mesmo utilizador — confirmar que não há colisão de números (testa a reserva atómica).
- [ ] Criar um documento com Utilizador A e outro com Utilizador B ao mesmo tempo — confirmar que cada um tem a sua sequência própria (ex. ambos podem ter FTR/2026/001 sem conflito).
- [ ] Campo "Documento" do destinatário vazio (opcional) — deve aceitar sem erro.
- [ ] Email do destinatário obrigatório — testar submissão sem email, deve bloquear com mensagem no passo certo (não só no fim).

## 4. Pagamento — pay-per-documento (utilizador sem subscrição)

- [ ] Pagar com M-Pesa: o checkout abre numa nova aba; confirmar pagamento no telemóvel; documento é criado após confirmação (via webhook) e aparece na página de sucesso com os links "Ver documento" e "Imprimir/Guardar PDF".
- [ ] Pagar com e-Mola: mesmo fluxo acima.
- [ ] **Cartão/Visa está temporariamente oculto** (bug conhecido do lado da PaySuite) — confirmar que a opção não aparece no seletor de método até ser reativada.
- [ ] Fechar a aba de pagamento sem completar — confirmar que a app não trava (mensagem de "aguardando confirmação" ou timeout eventual, sem erro fatal).
- [ ] Testar o link "Abrir pagamento" manual (fallback caso o popup automático seja bloqueado pelo browser).
- [ ] Confirmar que a mensagem de erro específica aparece (não a genérica) quando os dados do documento falham a validação do servidor (ex. tirar um campo obrigatório via devtools antes de submeter).

## 5. Pagamento — subscrição mensal (utilizador com subscrição ativa)

- [ ] Com subscrição ativa, criar um documento **não deve gerar nenhuma cobrança PaySuite** — confirmar que o documento aparece imediatamente, sem passar por ecrã de checkout externo. **(Bug de cobrança indevida corrigido nesta sessão — validar especificamente que não há uma segunda cobrança de 10 MT.)**
- [ ] Assinar o plano mensal pela primeira vez (M-Pesa ou e-Mola) — subscrição fica "ativa", `data_proxima_cobranca` definida ~1 mês à frente.
- [ ] Clicar em "Assinar"/"Renovar" e confirmar que aparece feedback imediato ("A iniciar pagamento...") antes da nova aba abrir — não deve parecer que o clique não fez nada.
- [ ] Simular expiração da subscrição (ou esperar pelo cron `subscription-check`) — confirmar que o status muda para "vencida" e a criação direta de documentos fica bloqueada (force para pay-per-documento).
- [ ] Confirmar que o lembrete por email chega ~3 dias antes da data de renovação (cron `subscription-check`).
- [ ] Cancelamento "por não-renovação": não renovar deliberadamente e confirmar que, passado o período de tolerância, o acesso ilimitado é revogado sem erro.

## 6. Lista de documentos e ações

- [ ] Lista carrega com paginação correta (não travar/demorar excessivamente com muitos documentos).
- [ ] Filtros por tipo (fatura/cotação/recibo), status e intervalo de datas funcionam e refletem-se na lista.
- [ ] Pesquisa por nome/número funciona sem gerar demasiados pedidos por tecla (debounce).
- [ ] Pré-visualizar um documento a partir da lista mostra o HTML correto.
- [ ] "Imprimir / Guardar PDF" abre a caixa de impressão do browser com o conteúdo correto (não um ficheiro corrompido).
- [ ] Eliminar um rascunho funciona e remove da lista imediatamente. **(Bug crítico corrigido nesta sessão — confirmar que já não dá erro 403/"[object Object]".)**
- [ ] Tentar eliminar um documento que não é rascunho (emitido/pago) — deve ser bloqueado com mensagem clara.
- [ ] Converter cotação → fatura e fatura → recibo — dados chegam corretos ao novo documento, incluindo referência ao documento de origem.
- [ ] Enviar documento por email a partir da lista — o cliente recebe o email com o link de visualização correto.
- [ ] Link de visualização público (`/api/document/view/[id]`) funciona sem sessão (é suposto ser público) e tem rate-limit a proteger contra abuso.

## 7. Documento fiscal, país (regressão desta sessão)

- [ ] Criar entidades com todos os 6 tipos de documento fiscal e confirmar que aparecem corretamente na lista de entidades e no PDF/documento final (rótulo do tipo, não só "Documento").
- [ ] Confirmar que documentos antigos (criados antes desta funcionalidade) continuam a mostrar/funcionar sem erro (têm `documento_tipo` = 'Outro' ou 'NUIT' consoante o país, via backfill da migração).

## 8. Segurança e isolamento entre utilizadores

- [ ] Utilizador A não consegue ver/editar/eliminar entidades ou documentos do Utilizador B (testar via UI e, se possível, tentando aceder a um ID de outro utilizador diretamente no URL de uma rota autenticada).
- [ ] Rotas de mutação (`POST`/`PATCH`/`DELETE`) falham com 403 se o token CSRF não for enviado (testar com devtools a remover o header).
- [ ] Rate limiting: disparar várias tentativas seguidas de uma rota limitada (ex. `/api/contact`, 5/hora) e confirmar que bloqueia a partir do limite.
- [ ] `/api/contact`: enviar mensagem sem sessão (utilizador não autenticado) funciona; destinatário do email é sempre o suporte, nunca configurável pelo remetente.

## 9. Página de subscrição e preços

- [ ] `/pricing` mostra os dois planos com os valores corretos (lidos de `PLANS`, não hardcoded) e não menciona pagamento por cartão enquanto estiver desativado.
- [ ] `/pages/subscription` mostra o estado correto consoante o plano atual (pay-per-documento, mensal ativa, mensal vencida).
- [ ] Comparação de preço "compensa a partir de N documentos/mês" calcula corretamente consoante os valores atuais dos planos.

## 10. Cron jobs e monitorização

- [ ] `subscription-check` corre diariamente (verificar execução no painel Vercel) e não falha silenciosamente.
- [ ] `error-alert` envia o resumo diário de erros para `ALERT_EMAIL` quando há erros nas últimas 24h; não falha o cron se `ALERT_EMAIL` não estiver definido.
- [ ] Confirmar que a App Password do Gmail usada em produção está válida (testar o formulário de contacto ou aguardar o próximo digest) — **local `.env` tinha uma App Password inválida nesta sessão, confirmar que produção está OK.**

## 11. Templates e personalização visual

- [ ] Testar a cor de destaque personalizada em `template-1` (único suportado atualmente) — persiste corretamente entre pré-visualização, pagamento e visualização final.
- [ ] Confirmar que os outros templates (sem personalização de cor ainda) continuam a renderizar com a cor original, sem quebrar.

## 12. Responsividade e navegadores

- [ ] Fluxo completo (criação + pagamento) num ecrã de telemóvel real (não só devtools) — atenção a popups bloqueados no Safari iOS.
- [ ] Testar em pelo menos Chrome e Safari (mobile e desktop), dado que o histórico deste projeto já teve bugs específicos de popup-blocking no Safari.

---

**Notas de prioridade**: os itens da secção 3 (numeração/cor no wizard), 4-5 (pagamentos) e 6 (eliminar documentos) cobrem bugs críticos corrigidos nesta sessão (2026-07-05) — merecem verificação prioritária antes de qualquer outra coisa. A secção 8 (segurança/isolamento) deve ser revalidada sempre que houver alterações a RLS, CSRF ou rotas de API.
