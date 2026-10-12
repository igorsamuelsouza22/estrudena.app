# Implementação do fluxo — 07/09/2026

> **Atualização de 12/10/2026:** as situações descritas abaixo foram simplificadas no schema v8. Em caso de diferença, valem [simplificacao-proposta.md](simplificacao-proposta.md) e a seção "Situações simplificadas (schema v8)" do README: proposta sem "Em análise", fabricação com a conferência final, entrega sem "Em transporte", instalação sem "Em execução"/"Pendência" e conclusão automática do pedido. Também mudou a numeração: o rascunho é regravado na mesma revisão, e a próxima revisão só nasce depois de emitir (decisão 1 da proposta).

O fluxo principal está implementado no aplicativo local:

**Orçamento → proposta emitida → envio/negociação → aceite → pedido de venda → liberação técnica → separação → fabricação → conferência final → entrega → instalação contratada → conclusão.**

- A primeira gravação gera `numero.rev1`. Cada edição salva gera a próxima revisão, com novo registro e conteúdo anterior preservado. Salvar sem alterar conteúdo não consome revisão. Emitir a mesma versão também não consome outra revisão. As cópias locais continuam protegidas durante a edição.
- App e nome do PDF usam `numero.revN`. O número comercial existente é preservado. Revisões legadas são normalizadas a partir de 1, mantendo IDs, produtos, preços e conferências.
- Emitir PDF não significa enviar. O envio registra canal, data e responsável; o aceite exige aprovador do cliente e referência documental.
- O aceite cria um único pedido por número, em transação. Cliques repetidos não duplicam o pedido. Ele preserva a revisão aceita, cliente, valores e composição.
- A nova revisão não altera o pedido aceito. Aditivos exigem administrador, descrição dos impactos e confirmação explícita; a revisão anterior e suas conferências ficam no histórico. O novo aceite volta à liberação técnica.
- Aditivos que alterem o cliente ou pedidos que já tenham entregas programadas/realizadas são bloqueados. Para esses casos, registre um orçamento complementar. Não há remapeamento automático de peças já entregues.
- A liberação gera a identificação da ordem de produção, exige data, medidas finais e requisitos internos conferidos. Cada produto deve ter composição ou ser identificado explicitamente como comprado pronto. Produtos comprados prontos exigem recebimento, sem consumo dos seus componentes.
- Separação tem validação de quantidades e conclusão no servidor, além de controle de edição simultânea. Consumo de composição é teórico, antes de perdas; ainda não é plano de corte nem baixa de estoque.
- Fabricação, conferência de qualidade, entregas parciais, ocorrências, equipe de instalação e conclusão têm ações próprias. O servidor impede pular etapas, entregar acima do saldo ou concluir com entregas/instalação pendentes.
- Cancelamento exige administrador e motivo, preservando todo o histórico. Registros de entrega confirmada são imutáveis.
- Pedidos aprovados antigos são importados automaticamente. Quando já havia separação, ela é preservada. Um aviso pede ao administrador conferir o aceite legado e a contratação da instalação.
- Carteira aprovada usa pedidos e a revisão aceita, mesmo quando há um novo rascunho em negociação. Valores financeiros continuam sendo estimativas comerciais, sem baixa de contas ou comissão paga.
- IPC exige sessão ativa, revalida o perfil e restringe alterações por função. Produção recebe os dados operacionais com valores comerciais removidos dos snapshots e sem propostas em negociação.
- Histórico registra autor, data e ação. Pedido e separação usam versões para impedir sobrescritas simultâneas. As migrações usam transação e trava para conexões concorrentes.

Validação: `npm run build`, `npm run teste:catalogo`, `npm run teste:negocio` e `npm run teste:ux`. Os testes de banco e Electron usam schemas temporários isolados dos dados reais.

Estoque com saldo/reserva, compras, plano de corte, financeiro e custos realizados permanecem como evolução opcional da proposta original abaixo; não são simulados como operações já existentes.

---

# Fluxo de negócio — diagnóstico e proposta

Análise do código local em 7 de setembro de 2026. O redesenho visual não introduz os novos estados abaixo; esta é a proposta para a próxima evolução do domínio.

## O que existe hoje

| Ação | Resultado real |
| --- | --- |
| Novo orçamento | Cria um rascunho local editável. A primeira gravação no servidor atribui o número. |
| Salvar rascunho | Grava cliente, produtos, medidas, condições e referência de preços; mantém `Rascunho`. |
| Gerar proposta | Grava o mesmo registro com status `Proposta`, antes da escolha dos PDFs. Não comprova envio ao cliente. |
| Alterar situação | A interface oferece `Proposta`, `Em análise`, `Aprovado` e `Perdido`. |
| Aprovar | A proposta passa a aparecer na fila de produção por seu status. Não nasce um pedido comercial independente. |
| Iniciar separação | Cria/atualiza a separação vinculada ao ID daquela revisão e registra `Em separação`. |
| Conferir | Registra quantidades de produtos, matérias-primas e ferragens separadamente. |
| Concluir separação | A interface exige as quantidades conferidas nas três categorias e grava `Concluída`. Isso não comprova fabricação, entrega ou instalação. |
| Criar revisão | Cria outro registro com o mesmo número, revisão incrementada e status `Rascunho`. Preserva os valores da origem. |

Fontes no projeto: `src/store.tsx`, `src/screens/Orcamento.tsx`, `src/screens/Propostas.tsx`, `src/screens/Separacao.tsx`, `src/historico.ts`, `electron/db/repo.ts` e `electron/db/schema.sql`.

## O que já está bem encaminhado

- Produtos de venda e matérias-primas têm classificações distintas; novos itens comerciais são validados no repositório. A composição calcula consumo por peça, área ou largura.
- As referências de preços preservam materiais, composição, ferragens e parâmetros do orçamento. Mudanças no catálogo não devem alterar silenciosamente propostas emitidas.
- O conteúdo de revisões emitidas é protegido no repositório. Alterações exigem uma nova revisão.
- A gravação do orçamento usa transação e controle de alteração concorrente. A criação de revisões usa bloqueio por número.
- A conferência distingue produtos, insumos e ferragens; o perfil de Produção recebe uma interface sem valores comerciais.

## Lacunas e efeitos práticos

1. **Pedido de venda inexistente.** O mesmo registro representa estimativa, proposta aceita e referência operacional. Falta uma entidade para o compromisso firmado com o cliente.
2. **Mudanças de status pouco controladas.** Há proteção de conteúdo emitido, mas não uma máquina de estados no servidor: por exemplo, um aprovado pode voltar a negociação ou perdido pelo seletor. A aplicação precisa de ações de negócio explícitas.
3. **Nova revisão pode deslocar a anterior na fábrica.** A fila escolhe a última revisão entre as aprovadas ou com separação. Se outra revisão for aprovada, ela pode ocupar o lugar da anterior, enquanto a conferência continua vinculada ao ID antigo. Falta aprovação formal de alteração de pedido.
4. **Indicadores podem perder uma venda aprovada.** Os relatórios escolhem a última revisão por número antes de filtrar status. Uma nova revisão em rascunho pode retirar da carteira uma aprovação anterior. Vendas confirmadas devem vir de pedidos, independentemente da negociação de aditivos.
5. **Emitir não é enviar.** Gerar proposta já muda seu status, mesmo que o PDF seja fechado sem exportar. Existe `enviadaEm`, mas não foi encontrado um fluxo que registre o envio de forma confiável.
6. **Separação não equivale a fabricação nem entrega.** Não há estados próprios para corte, montagem, qualidade, expedição, entrega e instalação. A conclusão atual deve continuar sendo chamada de conclusão de conferência.
7. **Conferência protegida principalmente pela interface.** `salvarSeparacao` persiste os dados sem verificar no servidor a aprovação comercial, a transição, as quantidades necessárias para concluir ou uma versão concorrente. Essas validações devem ser centralizadas.
8. **Composição incompleta pode gerar conferência vazia.** Um produto com custo manual pode ser orçado legitimamente, mas não fornece lista completa de fabricação. Liberar fabricação deve exigir ficha técnica suficiente ou uma exceção identificada para produto comprado pronto.
9. **Permissões precisam chegar ao servidor.** Os menus filtram os perfis, mas os handlers IPC de gravação e carregamento não verificam uma sessão/perfil. Ocultar preços não constitui controle de acesso aos dados.
10. **Faltam rastreabilidade e exceções comerciais.** Não existem registro estruturado da aprovação, motivo de perda/cancelamento, validade encerrada, autor de cada transição e regras para substituir uma revisão aceita.
11. **Consumo previsto não é estoque.** A composição e a separação não controlam saldo disponível, reserva, entrada, baixa ou devolução. Conferir material não deve ser apresentado como baixa de estoque.
12. **Margem é estimada.** Os cálculos não representam pagamentos, faturamento fiscal nem lucro realizado. Mão de obra, comissões, perdas e arredondamento precisam de uma política explícita e conciliação entre tela e documento.

## Modelo recomendado

**Cliente → Obra → Orçamento → Proposta/revisões → Pedido de venda → Ordem de produção → Entrega → Instalação, quando contratada.**

Orçamento é a elaboração interna dos custos e preços. Proposta é a versão apresentada ao cliente. A aprovação de uma proposta cria o pedido de venda e vincula a revisão aceita. O pedido de separação é uma tarefa operacional da ordem de produção.

| Entidade | Estados sugeridos |
| --- | --- |
| Orçamento | Rascunho, pronto para emissão |
| Proposta | Emitida, enviada, em negociação, aprovada, recusada, expirada, substituída |
| Pedido de venda | Confirmado, aguardando liberação, liberado, em execução, concluído, cancelado |
| Ordem de produção | Aguardando planejamento, materiais pendentes, em separação, em fabricação, em conferência, pronta para expedição, concluída |
| Entrega | A programar, programada, em transporte, entregue, ocorrência |
| Instalação | Não contratada, a programar, programada, em execução, concluída, pendência |

Pagamento e aprovação técnica devem ser condições de liberação quando a empresa exigir, não uma etapa obrigatória universal. Na primeira versão, essas condições podem ser registradas manualmente, sem criar um módulo financeiro completo.

## Regras das transições

1. **Emitir:** validar cliente, obra, produtos, medidas, quantidades, prazo, pagamento e validade. Conferir custos ausentes e avisar sobre margem abaixo da política. Gravar uma revisão imutável e permitir visualizar/exportar o PDF. Exportar não marca envio automaticamente.
2. **Registrar envio:** identificar revisão, data, canal e responsável. Sem enviar mensagens automaticamente.
3. **Registrar aprovação:** informar data, responsável pelo aceite e evidência/referência. Aprovar uma revisão elegível cria **um único pedido**, na mesma transação. Repetir a ação devolve o pedido já criado, sem duplicar.
4. **Congelar o pedido:** guardar a revisão aceita, produtos, medidas, composição, preços e condições acordadas. Separar custo previsto aceito de custo atualizado de execução.
5. **Liberar produção:** conferir medidas finais, ficha técnica, prazo e condições internas. Quando necessário, marcar falta de materiais. Na ausência de estoque real, essa confirmação é manual e assim deve ser exibida.
6. **Separar/fabricar:** gerar a lista de insumos da versão técnica liberada, com unidades e perdas previstas identificadas. Registrar quantidades, responsáveis e ocorrências; validar tudo no servidor. Produto comprado pronto pode seguir diretamente à conferência/expedição conforme seu tipo de atendimento.
7. **Conferir e expedir:** exigir quantidades e inspeções aplicáveis. Uma divergência abre pendência; não concluir silenciosamente. Permitir entregas parciais com saldo pendente explícito.
8. **Concluir o pedido:** todas as entregas concluídas e, se contratada, instalação concluída e aceita. Encerrar separação não encerra automaticamente o pedido.
9. **Revisar após aprovação:** criar solicitação de alteração/aditivo. A fábrica continua seguindo a versão liberada até o aceite da alteração. Após aceite, registrar impactos em preço, prazo e material já consumido; não reaproveitar quantidades conferidas por posição da linha.
10. **Cancelar:** registrar motivo, autor e data, impedir novas tarefas e tratar reservas/consumos já realizados. Nunca apagar um pedido com histórico operacional.
11. **Autorizar:** validar sessão e perfil em cada comando do servidor. Produção não carrega preços; descontos excepcionais, cancelamentos e substituições aceitas exigem os perfis definidos pela empresa.
12. **Auditar:** cada comando grava evento com estado anterior/novo, entidade, usuário, horário e motivo. Proteger alterações concorrentes em pedido e conferência, não só no orçamento.

## Exemplo concreto

1. Wilson prepara o orçamento de dez portas e três janelas para a obra Tenório.
2. Emite a proposta, revisão 00, e registra o envio ao cliente.
3. O cliente aceita a revisão 00: nasce o pedido PV-000123, ligado a ela.
4. A equipe confirma medidas finais e libera a OP-000087.
5. A OP gera a separação de perfis, vidro e ferragens; seguem fabricação e conferência.
6. Oito portas são entregues primeiro: o pedido continua em execução, com duas portas e três janelas pendentes.
7. Com a entrega restante e a instalação contratada concluídas, o pedido é encerrado.
8. Se o cliente pedir mais uma janela durante a fabricação, isso gera alteração formal. A OP original não muda só porque foi criado outro rascunho comercial.

## Implementação por fases

**Primeiro:** centralizar permissões/validações; separar pedido de venda; aprovação transacional e idempotente; vincular uma revisão aceita; histórico de eventos; corrigir os indicadores de venda confirmada. Migrar aprovações e separações existentes sem alterar valores ou descartar conferências.

**Depois:** ordem de produção com liberação técnica, separação e fabricação distintas; concorrência na conferência; expedição, entregas parciais e instalação.

**Por último:** estoque e reservas, compras por falta de insumos, recebimentos e custos realizados, se fizerem parte do escopo da empresa.

Critérios de aceite essenciais: uma aprovação não duplica pedidos; uma revisão em negociação não altera a OP; alteração de catálogo não muda valores aceitos; quantidades inválidas não concluem a produção; duas conferências simultâneas não se sobrescrevem; produção não recebe preços por API; entrega parcial mantém saldo; cancelamento preserva histórico; tela e PDF apresentam os mesmos totais.
