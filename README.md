# Sistema Estrudena

Orçamento, proposta comercial e separação de material para a **Estrudena**
(esquadrias de alumínio, Americana/SP).

Aplicativo Windows com banco de dados PostgreSQL compartilhado na rede local:
um PC guarda o banco, os demais se conectam nele. O instalador carrega o
PostgreSQL embutido — não é preciso instalar nada antes, nem ter internet.

> Guia de instalação e uso: [INSTALACAO.md](INSTALACAO.md)

---

## O que o sistema faz

- **Orça** obras de esquadrias — perfis de alumínio por kg, vidro e ACM por m²,
  acessórios por unidade ou metro.
- **Emite a proposta comercial** em PDF, no layout que a empresa já usa.
- **Conduz a separação de material** na fábrica, com conferência por quantidade
  e pedido de separação em PDF.
- **Mantém os cadastros** que alimentam o cálculo: produtos, matérias-primas, cores, acessórios,
  kits de ferragem e de venda, instaladores, clientes, usuários e parâmetros.

### Produtos e matérias-primas

- **Produtos** são os itens de venda selecionados no orçamento e nos kits comerciais.
- **Matérias-primas** guardam unidade e custo de compra dos insumos de fabricação.
- A ficha do produto permite cadastrar consumo de cada matéria-prima por produto,
  por m² ou por metro de largura. A composição substitui o custo de material
  anterior; kits de ferragem e acessórios avulsos continuam somados por peça.
- O acabamento do insumo compõe seu custo. Quando há composição, a cor do
  produto identifica o acabamento na proposta, sem acrescentar pintura novamente.
- A produção e seu PDF mostram o consumo das matérias-primas, antes de perdas.
- Cadastros sem composição continuam usando o cálculo anterior. A migração
  classifica os quatro insumos conhecidos de vidro/ACM e preserva as propostas
  antigas, inclusive suas revisões. Kits que continham insumos precisam ser
  revisados para conter apenas produtos antes de novos lançamentos.

`npm run teste:catalogo` verifica migração, composição e restrições em um schema
temporário do PostgreSQL local, removido ao final, sem alterar os dados do sistema.

São três perfis de acesso — Administrador, Vendedor e Produção. O
perfil Produção nunca enxerga valor comercial, nem na tela nem no papel.

## Como está montado

| Pasta | O que tem |
| --- | --- |
| `electron/` | processo principal: conexão, descoberta na rede, migrações, IPC |
| `electron/db/schema.sql` | schema relacional, idempotente, aplicado na 1ª conexão |
| `electron/db/seed-data.ts` | catálogo da empresa e usuários iniciais |
| `src/calc.ts` | motor de cálculo derivado da planilha original |
| `src/screens/` | as telas |
| `src/documentos/` | as folhas A4 de proposta e separação |
| `build/installer.nsh` | página Servidor/Terminal do instalador |
| `build/setup-servidor.ps1` | instala e configura o PostgreSQL no servidor |

O motor de cálculo foi extraído da planilha real da empresa e é conferido por
testes contra a proposta `8026-01-26` — 13 tipologias, 166 peças, 434 m².
**Não altere `src/calc.ts` sem conferir o resultado contra a planilha.**

## Desenvolvimento

```bash
npm install
npm run fetch:pg     # baixa o PostgreSQL embutido (uma vez por máquina)
npm run dev          # roda em desenvolvimento
npm run typecheck
npm run dist         # gera o instalador em release/
```

Testes (exigem um PostgreSQL respondendo em `127.0.0.1:5432`):

```bash
npm run teste              # migração, seed, login, cálculo, revisões e separação (schema temporário)
npm run teste:telas        # navega as telas do perfil e confere menu e console
npm run teste:pdf          # gera os PDFs e analisa fundo, imagens e paginação
npm run teste:atualizacao  # publica uma versão e verifica o aviso e o download
npm run teste:fechar       # confere que a atualização baixada instala ao fechar
npm run teste:progresso    # baixa a release de verdade e amostra a barra na tela
npm run teste:descoberta   # varredura sem servidor: confere a mensagem de erro
npm run teste:config       # tela de configurações: textos do PDF e opção padrão
npm run teste:rodape       # mede o rodapé do login: nada cortado nem quebrado
```

## Publicando uma versão nova

1. Suba o número em `package.json` e rode `npm run dist`.
2. Publique uma release com a etiqueta `vX.Y.Z` e o `.exe` de `release/` anexado.

Os terminais consultam as releases deste repositório e avisam sozinhos que há
versão nova: a faixa aparece, o download começa em segundo plano mostrando a
porcentagem e, ao terminar, o instalador roda quando a pessoa fechar o sistema.

O GitHub limita 60 consultas por hora por endereço de internet e a empresa
inteira sai por um só, então a consulta é reservada no banco (tabela
`atualizacao_cache`) e vale para a rede toda: uma máquina pergunta por hora, as
demais leem a resposta dela.

Também é possível publicar pelo próprio sistema, guardando o instalador no
banco — útil onde não há internet. Detalhes em [INSTALACAO.md](INSTALACAO.md).

## Aviso sobre a senha do banco

`electron/db/credentials.ts` guarda a senha que o aplicativo usa para falar com
o PostgreSQL. Ela é a mesma em todas as máquinas — é isso que permite um
terminal encontrar o servidor sem nenhuma configuração.

Como este repositório é público, essa senha é pública. O banco só é alcançável
pela rede local da empresa, mas quem estiver nessa rede consegue acessá-lo. Se
isso for um problema no seu caso, troque a senha, rode

```sql
ALTER ROLE estrudena WITH PASSWORD '<nova>';
```

no servidor e reinstale os terminais.


## Fluxos de trabalho e proteção de alterações

- `Ctrl+K` pesquisa clientes, produtos, insumos e a revisão vigente das propostas, respeitando as telas disponíveis ao perfil.
- O menu oferece densidade confortável ou compacta. Produtos possuem abas Dados gerais, Composição, Preço e Imagem.
- Fichas e orçamentos mantêm cópias locais por usuário e registro. Use **Recuperar** nos cadastros ou os itens **Continuar…** do Início após navegar ou reabrir. A cópia local não substitui o botão Salvar no servidor. Senhas não são persistidas em rascunhos.
- Propostas emitidas abrem para consulta, com a próxima ação em destaque no cabeçalho (registrar envio, aprovar ou ver o pedido) e as demais em **Mais ações**. **Criar revisão** preserva o conteúdo e gera uma nova revisão em rascunho. **Recalcular com preços atuais** mostra a comparação antes de substituir a referência de preços. **Gerar proposta** grava a revisão e abre a prévia do PDF.
- O schema v5 preserva os produtos, composições, acabamentos, ferragens e parâmetros de custo usados em cada proposta. Registros anteriores são preservados com os valores disponíveis na primeira leitura após a migração; preços históricos que não foram armazenados não podem ser reconstruídos.
- A carteira aprovada e a fábrica usam a revisão aceita vinculada ao pedido de venda. Uma nova revisão em negociação não substitui o contrato em execução. Os relatórios têm filtros de data, vendedor e situação.
- A separação fica dentro do pedido: marque cada linha de produto, matéria-prima e ferragem (ou digite a quantidade parcial) e salve. A primeira gravação inicia a separação; a conclusão exige todas as linhas completas. Prioridade e data de entrega organizam a fila da Produção.
- PDFs abrem em prévia antes do diálogo de gravação. O pedido de produção não exibe preços. A prévia usa os dados já salvos no servidor.
- Conflitos de gravação de orçamento preservam o rascunho e pedem a abertura da versão atual; não sobrescrevem silenciosamente outra sessão.

Validação de cálculo, migração, composições, revisões, concorrência e conferência: `npm run teste:catalogo` (PostgreSQL local; schema temporário isolado e removido ao final).

Validação dos fluxos de interface: execute `npm run build` e `npm run teste:ux`. Requer Playwright disponível no ambiente (ou `PLAYWRIGHT_PATH` apontando para o módulo). A instância Electron e os dados PostgreSQL são isolados; capturas e PDF de teste ficam em `node_modules/.cache/estrudena/`.


## Ciclo comercial e produção (schema v6)

O fluxo de proposta, aceite, pedido, ordem de produção, entregas parciais e instalação está descrito em [docs/fluxo-de-negocio-proposto.md](docs/fluxo-de-negocio-proposto.md). A primeira gravação cria `numero.rev1` e o rascunho é regravado nessa mesma revisão até ser emitido. Uma revisão nova (`numero.revN`) só nasce em **Criar revisão**, a partir de uma proposta emitida, e a anterior fica no histórico. Aprovações são transacionais e idempotentes. Pedidos antigos importados pedem conferência do aceite e da instalação pelo administrador.

`npm run teste:negocio` valida as regras no servidor em um schema temporário. `npm run teste:ux` também percorre aprovação, liberação, fabricação, qualidade, entrega e conclusão pelas telas.

## Situações simplificadas (schema v8)

Menos situações para a mesma operação, sem perder as garantias do servidor (detalhes em [docs/simplificacao-proposta.md](docs/simplificacao-proposta.md)):

- Proposta: Rascunho → Emitida → Enviada → Aprovada ou Perdida. "Em negociação" foi unificada com "Enviada". Uma proposta emitida ou enviada cuja validade passou aparece como **Expirada** automaticamente, sem ação manual.
- Pedido: concluir a separação já leva o pedido à fabricação. **Fabricação concluída e conferida** é uma ação só, que inclui a conferência final de qualidade.
- Entrega: Agendada → Entregue (ou Ocorrência), podendo ser registrada direto como entregue. Entrega confirmada continua imutável.
- Instalação: A agendar → Agendada → Concluída. Pendências são registradas como observação no histórico.
- O pedido se conclui sozinho com a última entrega e, se contratada, a instalação concluída.

A migração v8 converte os registros existentes ("Em análise" → "Enviada", "Em conferência" → "Em fabricação", separação já concluída → "Em fabricação", "Em transporte" → "Agendada", instalação "Em execução"/"Pendência" → "Agendada") e preserva o histórico de eventos. As regras rodam no processo principal de cada computador: atualize o servidor e todos os terminais juntos.


## Configurações da empresa

Configurações possui navegação por assunto, busca por campo, prévia dos dados da empresa e observações, simulação do markup e rateio visual. A barra inferior informa os ajustes pendentes, permite revisar os valores anteriores/novos e salvar ou descartar o rascunho.

A edição aceita vírgula decimal e mantém um rascunho local por usuário. O servidor valida os valores e impede sobrescrever configurações alteradas em outra sessão. Nas listas, adicionar/remover é imediato; a escolha de um novo padrão usa o salvamento do rodapé. Atualizações, exportação e demonstrações ficam na seção Sistema e dados, com ações próprias.

## Matriz de permissões (schema v7)

Em **Gestão → Pessoas e acessos**, administradores podem marcar as permissões de Vendedor e Produção e clicar em **Salvar permissões**. A configuração vale para todos os usuários do perfil e fica no PostgreSQL, com versão, autor, data e histórico das alterações. Gravações concorrentes exigem recarregar a matriz, evitando sobrescrever outra sessão.

Menus, botões, dados comerciais e ações no processo principal usam a mesma política. Toda ação protegida verifica novamente a conta ativa e as permissões no banco; telas abertas atualizam ao receber foco ou em até 15 segundos enquanto visíveis. Liberar uma função também marca suas dependências; remover uma dependência retira as funções relacionadas. Relatórios permitem leitura dos dados comerciais sem conceder edição de propostas.

Administradores mantêm acesso completo e exclusividade sobre usuários e matriz. Uma conta não pode se desativar nem mudar o próprio perfil; o último administrador ativo é preservado. Exclusão exige acesso à área e a permissão de excluir, mantendo as validações de vínculos.

Os padrões preservam os acessos efetivos anteriores: Vendedor trabalha com valores, orçamentos, clientes, aceite inicial e consulta/planejamento de pedidos; Produção consulta e planeja pedidos e executa produção, entrega e instalação, sem valores comerciais. Use **Restaurar padrão** para preencher a matriz e revise antes de salvar.

`npm run teste:permissoes` valida persistência, concessão/revogação, dependências, filtragem, concorrência, auditoria e proteção de administradores em um schema temporário. `npm run teste:ux` também altera a matriz pela tela, testa a API com outro perfil e verifica a atualização da sessão aberta.

## Atualização a partir da 1.3.1

O `electron-updater` aplica instaladores NSIS com **Atualizar e reiniciar**. A instalação ocorre somente por ação explícita, após conferir edições e gravações em andamento. Sair do aplicativo deixa a atualização para depois. A instalação por máquina ainda pode exigir UAC.

O GitHub precisa receber o `.exe`, `latest.yml` e `.exe.blockmap` gerados pelo mesmo build. A consulta das versões mantém o cache compartilhado; o download usa o feed HTTPS da tag selecionada. O canal pelo banco verifica SHA-256 e entrega o arquivo ao updater por um feed temporário restrito a loopback com endereço aleatório. O updater confere SHA-512; o app confere novamente antes de instalar e aceita apenas o caminho registrado no processo principal.

PostgreSQL vai compactado em `resources/pgsql.7z`. O instalador extrai e configura o runtime na instalação/reparação do servidor. A partir do desinstalador da 1.3.1, atualizações preservam `resources/pgsql` ao trocar os arquivos do app e não removem nem reconfiguram seu serviço. A primeira atualização de versões anteriores ainda usa o desinstalador antigo. Consulte [as notas de transição](docs/versao-1.3.1.md).

Testes: `npm run teste:updater` (Electron e banco isolados; instalação interceptada), `npm run teste:pacote` e `node scripts/teste-preservacao-postgres.mjs` (NSIS com arquivos fictícios; sem registro/serviços). Os testes Electron usam `PLAYWRIGHT_PATH` quando o módulo não está no projeto.
