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
- **Mantém os cadastros** que alimentam o cálculo: itens, cores, acessórios,
  kits de ferragem e de venda, instaladores, clientes, usuários e parâmetros.

São 15 telas e três perfis de acesso — Administrador, Vendedor e Produção. O
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
npm run teste              # migração, seed, login, cálculo, gravação
npm run teste:telas        # navega as telas do perfil e confere menu e console
npm run teste:fluxo        # orçamento → proposta → PDFs → lista
npm run teste:pdf          # gera os PDFs e analisa fundo, imagens e paginação
npm run teste:atualizacao  # publica uma versão e verifica o aviso e o download
npm run teste:fechar       # confere que a atualização baixada instala ao fechar
npm run teste:progresso    # baixa a release de verdade e amostra a barra na tela
npm run teste:descoberta   # varredura sem servidor: confere a mensagem de erro
npm run teste:config       # tela de configurações: textos do PDF e opção padrão
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
