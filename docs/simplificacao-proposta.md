# Simplificação — menos informação, mesmo controle

Análise de 12/10/2026 sobre a versão 1.3.1.

**Andamento (12/10/2026):** fases 1 (só tela) e 2 (regras simples, schema v8) implementadas. Nas decisões 4 e 5, a escolha foi juntar "Em análise" com "Enviada", tirar "Em transporte", juntar fabricação e conferência final e reduzir a instalação a A agendar · Agendada · Concluída. Da fase 3, a decisão 1 também foi implementada: o rascunho é regravado na mesma revisão, e a revisão só avança em "Criar revisão", depois de emitida. As revisões intermediárias criadas antes dessa mudança continuam no histórico. As decisões 2 e 3 continuam como proposta.

**Princípio:** manter todas as garantias do servidor e reduzir o que a tela *pede* e *mostra*. Essas garantias incluem aceite sem duplicar pedido, revisão emitida imutável, entrega confirmada imutável, Produção sem preços e histórico completo. Cada item abaixo está marcado como **[tela]**, quando muda só a interface, ou **[regra]**, quando muda a lógica no servidor.

## O problema em números

Um pedido com instalação contratada, do aceite à conclusão, hoje exige:

| | Hoje | Proposto |
| --- | --- | --- |
| Janelas de confirmação (modais) | ~13 | ~6 |
| Telas diferentes para o mesmo pedido | 3 (Orçamentos, Pedidos de venda, Produção) | 1 (o pedido, com a separação dentro) |
| Etapas no indicador do pedido | 7 | 4–5 |
| Situações possíveis de um pedido (status + etapa + instalação + separação + entrega) | 5 + 7 + 6 + 3 + 4 | um selo único derivado |
| Abas de situação em Orçamentos | 8 | 4 |

Sequência atual: aprovar → liberar → ir para Produção → iniciar separação → conferir 3 abas → salvar → concluir → voltar ao pedido → iniciar fabricação → finalizar fabricação → aprovar conferência final → programar entrega → marcar "em transporte" → marcar "entregue" → instalação "programada" → "em execução" → "concluída" → concluir pedido.

## As 8 mudanças de maior efeito

1. **Um selo de situação por pedido** [tela]. Hoje a tela do pedido mostra o mesmo momento com três nomes: selo "Liberado", etapa "3 Separação" e aviso "Agora: Materiais pendentes" (`src/screens/Pedidos.tsx`).
2. **Um botão principal por vez** [tela]. Mostrar só a próxima ação da etapa atual e mover Planejar, Cancelar, PDF e revisões para "Mais ações ▾". Hoje aparecem até 6 botões no pedido e até 10 na proposta.
3. **Separação dentro do pedido** [tela]. "Conferir separação" e "Ver etapas do pedido →" mandam a pessoa de uma tela para outra. O menu Produção continua como fila da fábrica, mas abre o próprio pedido.
4. **Concluir a separação avança sozinho para Fabricação** [regra]. Hoje `salvarSeparacao` (`electron/db/repo.ts:578`) deixa o pedido "Em separação" mesmo após concluir. Ainda é preciso voltar e clicar em "Iniciar fabricação".
5. **Fabricação + conferência final em uma ação** [regra]. Hoje são dois modais: "Finalizar fabricação" e "Aprovar conferência final". Ambos pedem "Responsável", que o histórico já registra como autor. Proposto: "Fabricação concluída e conferida", com uma caixa de confirmação. *Isso desfaz uma separação feita de propósito em `fluxo-de-negocio-proposto.md`; ver Decisões.*
6. **Entrega direto para "Entregue"** [regra]. Hoje a entrega nasce "Programada" e só pode ir para "Em transporte" antes de "Entregue": são 3 modais por entrega (`negocio.ts:154`). Proposto: Agendada → Entregue (ou Ocorrência).
7. **Pedido conclui sozinho** [regra]. Quando a última entrega e a instalação contratada terminam, não deve ser preciso clicar em "Concluir pedido".
8. **Remover avisos permanentes** [tela]. Textos como "não representa baixa de estoque", "antes de perdas", "não aparece no PDF", "Emitir ou visualizar PDF não registra o envio" e os subtítulos das páginas passam para um ícone ⓘ ou são retirados.

## Detalhe por tela

### Pedido de venda (`Pedidos.tsx`)
- Cabeçalho: hoje mostra `PV 8026-01-26`, `OP-8026-01-26.rev1` e "revisão aceita 8026-01-26.rev1", três códigos derivados do mesmo número. Mostrar só o número; a revisão aparece apenas se houve aditivo.
- Indicador de etapas: tirar "Aceite" (sempre concluída quando o pedido existe) e juntar "Conferência" a "Fabricação". Resultado: **Liberação · Separação · Fabricação · Entrega · Instalação** (a última só quando contratada).
- "Produtos contratados": colunas Entregue/Saldo só depois da primeira entrega.
- Histórico e "Revisões substituídas" ficam recolhidos.
- Liberação: hoje há 2 caixas de confirmação, data e uma caixa "comprado pronto" por produto. Juntar as duas confirmações em uma. "Comprado pronto" deve vir do cadastro do produto; ver Decisões.
- Instalação: 6 situações → **A agendar · Agendada · Concluída**. "Pendência" vira uma observação, sem situação própria [regra].

### Produção / separação (`Separacao.tsx`)
- Remover "Entrega prevista" e "Prioridade" editáveis: duplicam o modal "Planejar" do pedido. Mostrar só o texto.
- "Conferente" preenchido com o usuário logado.
- Remover o botão "Iniciar separação" [tela]: a primeira gravação já envia "Em separação", transição que o servidor aceita hoje.
- Trocar as 3 abas com campos numéricos e "Conferir tudo" em cada linha por **uma lista agrupada com caixa de seleção por linha**. Marcar significa "separado por completo". A quantidade parcial só é digitada quando necessário. O modelo de dados não muda.

### Orçamentos (`Propostas.tsx`, `FiltrosPropostas.tsx`)
- 8 abas → **Em aberto · Aprovados · Perdidos · Todos**.
- O filtro "Situação" dentro de "Filtrar por período" duplica as abas e está inconsistente: 5 opções contra 8 abas. Remover.
- Hoje clicar em "Abrir ↗" abre um painel intermediário, onde é preciso clicar em "Abrir" de novo. Ir direto ao orçamento e levar as ações da proposta para o cabeçalho dele.
- "Em análise": a ação "Em negociação" não pede nenhum dado e não tem regra no servidor. Juntar com "Enviada" [regra]. O próprio sistema já se confunde com os dois: o Início conta como "Em negociação" apenas Rascunho, Proposta e Em análise (`Dashboard.tsx`). Uma proposta *enviada* some da métrica e de "Próximas ações", e o filtro de situação também não tem "Enviada".
- "Expirada" pode ser calculada pela data de validade (selo "vencida"), sem ação manual "Encerrar por validade" [regra].
- Registrar envio: o texto livre "Canal de envio *" vira botões rápidos (WhatsApp · E-mail · Em mãos) com observação opcional.

### Orçamento (`Orcamento.tsx`)
- Etapa 1: remover "Número (automático)", "Situação" e "rev · data" no cartão. O número aparece uma vez, no título.
- Cabeçalho: hoje há trilha de navegação, título, subtítulo e botão "← Orçamentos". Manter trilha e título.
- Etapa 3: o cartão "Total da proposta" e "Apuração detalhada" repetem os totais; juntar os dois. Em "Margem, impostos e descontos", deixar visíveis só Desconto e Margem alvo. Markup, imposto, comissões e perda já vêm das Configurações (`store.tsx:80`) e vão para "Ajustes avançados".
- "Atualizar os custos deste rascunho", hoje abaixo do rodapé, vai para "Mais ações".
- "Gerar proposta" abre direto a prévia do PDF [tela]. O modal "Proposta gerada" tem uma única opção, já marcada (`ModalGerarProposta.tsx`, com `separacao = false` fixo).

### Início (`Dashboard.tsx`)
- "Próximas ações" mostra os rascunhos locais duas vezes: no seletor "Retomar rascunho local" e nos itens "Continuar…". Manter só os itens, com "ver todos (N)".
- "Conferir {obra}" repete a primeira linha de "Próximas entregas".
- "Próximas entregas" mostra o selo da *separação* ("Pendente"), que parece situação da entrega. Mostrar o prazo.
- Ajustar o painel ao perfil: o vendedor vê o comercial; a Produção vê a fila.

### Geral
- Subtítulos de todas as páginas (`TITULOS` em `Shell.tsx`): remover.
- Rodapé do menu: "Servidor conectado / Reconectar / atualizar" e "Preferências de exibição" vão para o menu do perfil. A conexão só aparece quando houver problema.
- Rótulos iguais aos do servidor: a aba "Emitidos" filtra o status "Proposta", e "Aprovado" é usado para proposta e para pedido. Padronizar.

## Ordem sugerida

1. **Só tela** (sem migração, risco baixo): itens 1, 2, 3 e 8, além de Produção, Orçamentos, Orçamento, Início e Geral, exceto o que está marcado [regra].
2. **Regras simples** (exige migrar registros antigos: "Em análise" → "Enviada", "Em transporte" → "Agendada", "Em conferência" → "Em fabricação", instalação "Em execução"/"Pendência" → "Agendada"): itens 4 a 7, expiração calculada e início automático da separação.
3. **Decisões de negócio** (abaixo).

Os testes `teste:negocio` e `teste:ux` cobrem exatamente essas transições e precisam ser atualizados nas fases 2 e 3.

## Decisões que dependem da empresa

1. **Revisões a cada gravação?** Hoje cada "Salvar rascunho" com conteúdo alterado cria uma nova revisão (`repo.ts:509-517`). Um vendedor que salva 5 vezes chega à rev5 antes de enviar qualquer coisa ao cliente. Sugestão: o rascunho sobrescreve, e a revisão só avança depois de emitida. As gravações intermediárias continuam no histórico de eventos. *A documentação atual escolheu o comportamento de hoje de propósito.*
2. **"Comprado pronto" no cadastro do produto?** Hoje a pergunta é feita na liberação de cada pedido, produto por produto.
3. **Conferir matéria-prima em quilos (3 casas) é obrigatório para concluir a separação?** Ou basta marcar cada linha como separada?
4. **A equipe usa "Em análise" diferente de "Enviada"?** E "Em transporte" diferente de "Agendada"?
5. **A conferência de qualidade é feita por outra pessoa ou em outro momento que a fabricação?** E a instalação precisa das situações "Em execução" e "Pendência"? As duas distinções foram criadas de propósito no fluxo de setembro. Se não forem usadas no dia a dia, saem as mudanças 5 e a simplificação da instalação.
