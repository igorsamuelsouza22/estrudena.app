# Sistema Estrudena — instalação

Orçamento, proposta comercial e separação de material.
Aplicativo Windows com banco de dados PostgreSQL compartilhado na rede local.

---

## Como funciona

Um computador da empresa é o **Servidor**: ele guarda o banco de dados.
Todos os outros são **Terminais**: rodam o mesmo programa e leem/gravam no banco
do servidor pela rede.

O mesmo arquivo `Sistema-Estrudena-Setup-1.2.3.exe` instala os dois. A única
escolha durante a instalação é essa. Não há nada para configurar depois.

```
        ┌──────────────────────────┐
        │  PC SERVIDOR             │
        │  Sistema Estrudena       │
        │  + PostgreSQL (serviço)  │  ← instalar como "Servidor"
        └───────────┬──────────────┘
                    │ rede local (porta 5432)
        ┌───────────┼───────────┬───────────────┐
        │           │           │               │
   ┌────┴────┐ ┌────┴────┐ ┌────┴────┐    ┌─────┴────┐
   │Terminal │ │Terminal │ │Terminal │ …  │ Terminal │  ← instalar como "Terminal"
   └─────────┘ └─────────┘ └─────────┘    └──────────┘
```

---

## Antes de repassar o instalador

O que a pessoa do outro lado vai encontrar:

- **Aviso azul do Windows** — "O Windows protegeu o computador". O instalador
  não tem assinatura digital, então o SmartScreen desconfia. É preciso clicar em
  **Mais informações** → **Executar assim mesmo**. Não é vírus; é a ausência de
  certificado. Avise antes, senão a pessoa desiste na hora.
- **Pedido de administrador** — o instalador precisa de permissão de
  administrador nas duas modalidades (Servidor e Terminal), porque grava em
  `Arquivos de Programas`. Em empresa com TI, quem instala precisa ter esse
  acesso.
- **Tamanho** — 108 MB. Não passa por e-mail; use pen drive, WeTransfer, Google
  Drive ou a rede interna.
- **Windows** — 64 bits, Windows 10 ou 11.
- **Antivírus** — instalador sem assinatura que cria serviço e regra de firewall
  às vezes é barrado. Se acontecer, libere o arquivo na quarentena.

Tudo o que o sistema precisa para rodar já vai dentro do `.exe`, inclusive o
PostgreSQL e as bibliotecas do Visual C++ — não é preciso instalar mais nada,
nem ter internet na máquina de destino.

Para acabar com o aviso do SmartScreen seria necessário um **certificado de
assinatura de código** em nome da Estrudena (EV ou OV, contratado de uma
autoridade certificadora, com custo anual). Com ele em mãos, é só configurar no
`electron-builder.yml` e reassinar — o resto do projeto não muda.

## Passo 1 — instalar o servidor

Escolha o computador que fica **ligado durante o expediente**. De preferência um
que não seja desligado no meio do dia.

1. Copie `Sistema-Estrudena-Setup-1.2.3.exe` para esse computador.
2. Clique com o botão direito → **Executar como administrador**.
3. Na tela **Função desta máquina**, escolha **Servidor**.
4. Avance até o fim.

O instalador faz sozinho, sem perguntar mais nada:

- instala o PostgreSQL (já vem dentro do `.exe`, não precisa de internet);
- cria o banco `estrudena` e o serviço do Windows `EstrudenaDB`, que sobe junto
  com o computador;
- libera a porta 5432 no firewall **apenas para quem está na mesma rede local**;
- cria as três contas de acesso.

O relatório da instalação fica em `C:\ProgramData\Estrudena\instalacao.log`.
Os dados ficam em `C:\ProgramData\Estrudena\pgdata`.

> Não há comando para digitar em momento nenhum. Se algo der errado, o
> instalador avisa e o log diz o passo exato — e o roteiro ainda tenta sozinho
> um caminho alternativo antes de desistir (outro locale para o banco, outra
> conta para o serviço, `netsh` no lugar do cmdlet de firewall).

> Se este computador trocar de IP com frequência, peça ao responsável pela rede
> para reservar um IP fixo para ele no roteador. Não é obrigatório — os
> terminais procuram o servidor de novo sozinhos —, mas deixa a abertura do
> sistema mais rápida.

## Passo 2 — instalar os terminais

Em cada uma das outras máquinas:

1. Execute o mesmo `Sistema-Estrudena-Setup-1.2.3.exe`.
2. Escolha **Terminal**.
3. Avance até o fim.

Ao abrir o programa pela primeira vez, ele varre a rede local, encontra o
servidor e grava o endereço. Da segunda vez em diante entra direto.

Se o servidor estiver desligado ou em outra rede, aparece um campo para digitar
o endereço manualmente (ex.: `192.168.0.10`). Só é preciso usar isso se a busca
automática falhar.

---

## Passo 3 — primeiro acesso

Três contas já vêm criadas:

| Login      | Nome     | Perfil        | Senha inicial |
| ---------- | -------- | ------------- | ------------- |
| `wilson`   | Wilson   | Administrador | `estrudena`   |
| `ana`      | Ana      | Administrador | `estrudena`   |
| `producao` | Produção | Produção      | `estrudena`   |

**Troque as senhas no primeiro dia.** Entre como `wilson` →
**Usuários** → **editar** → preencha o campo Senha → **Salvar usuário**.

### O que cada perfil enxerga

| Tela              | Administrador | Vendedor | Produção |
| ----------------- | :-----------: | :------: | :------: |
| Visão geral       | ● | ● | ● |
| Orçamento         | ● | ● | — |
| Propostas         | ● | ● | ● |
| Clientes          | ● | ● | — |
| Separação         | ● | ● | ● |
| Itens e materiais | ● | ● | — |
| Custo e margem    | ● | ● | — |
| Relatórios        | ● | — | — |
| Usuários          | ● | — | — |
| Configurações     | ● | — | — |

O perfil **Produção** nunca vê valor de venda, custo ou margem — nem na tela,
nem no pedido de separação impresso.

---

## Como sai o PDF

Os documentos são gerados em dois lugares, sempre abrindo a janela do Windows
para escolher onde gravar:

- **No orçamento** — ao clicar em **Gerar Proposta**, o sistema salva e pergunta
  quais documentos emitir: a **proposta comercial** (do cliente, com valores) e o
  **pedido de separação** (da fábrica, sem valor nenhum). Dá para marcar os dois;
  saem um de cada vez. Em seguida a tela vai para **Propostas**.
- **Na lista de propostas** — o botão **salvar pdf** de cada linha emite a
  proposta comercial daquele documento. O botão **separação** abre a tela de
  conferência, que tem seu próprio **Salvar pedido em PDF**.

## Dados iniciais

O catálogo da empresa já vem carregado: 19 itens (perfis, vidro, ACM,
contramarco), 8 cores, 12 acessórios, 6 kits de ferragem, 5 kits de venda e 4
equipes de instalação, com os preços da planilha original.

Clientes e propostas começam vazios. Para treinar a equipe com dados de
demonstração — incluindo a proposta real `8026-01-26` da Porto Bay —, entre como
administrador e use **Configurações → Carregar dados de exemplo**.

---

## Atualizar para uma versão nova

O terminal cuida disso sozinho. Ao abrir o sistema — e a cada 30 minutos, ou
quando a janela volta ao foco — ele confere se há versão nova. Havendo, **já
baixa o instalador em segundo plano** e mostra a faixa:

> **Versão X.Y.Z disponível** · Baixando 45% · 48 de 108 MB · *agora não*

com uma barra de progresso na base da faixa. Ao terminar:

> **Versão X.Y.Z disponível** · Baixado — instala em menos de um minuto ·
> *agora não* · **Instalar agora**

São dois caminhos, e nenhum deles interrompe o trabalho:

- **Instalar agora** — o instalador abre na hora (já está baixado), o Windows
  pede a confirmação de administrador e pronto.
- **agora não** — a faixa some e a pessoa continua trabalhando. **Ao fechar o
  sistema**, ele pergunta se quer instalar a atualização que já está baixada.
  Aí ninguém perde nada, porque já estava saindo mesmo.

A instalação nunca acontece sozinha, por dois motivos: ela troca arquivos em uso
e fecharia o sistema no meio de um orçamento, e o Windows sempre vai pedir a
confirmação de administrador de qualquer forma.

**Atualizar não é reinstalar.** O instalador troca os arquivos no lugar,
preserva o banco de dados, os atalhos e a pasta — e, por ser atualização, nem
pergunta de novo se a máquina é Servidor ou Terminal: ele reconhece sozinho.

Há dois caminhos para a versão nova chegar. Os terminais consultam os dois e
ficam com a mais recente.

### Pelo GitHub (quem desenvolve publica direto)

1. Publique uma release no repositório com a etiqueta no formato `v1.2.3` e o
   `Sistema-Estrudena-Setup-1.2.3.exe` anexado.
2. Uma única vez, em **Configurações → Atualização do sistema**, preencha o campo
   **Repositório no GitHub** com `usuario/repositorio`.

Pronto — daí em diante nenhuma ação é necessária na Estrudena.

> O repositório precisa ser **público**. Num repositório privado, o aplicativo
> precisaria carregar um token de acesso embutido, que qualquer pessoa com o
> arquivo instalado conseguiria extrair.
>
> O GitHub limita **60 consultas por hora para cada endereço de internet**, e
> todas as máquinas da empresa saem pelo mesmo endereço. Por isso o sistema
> consulta no máximo **uma vez por hora para a rede inteira**: a primeira
> máquina que precisar consulta e guarda a resposta no banco, e as demais leem
> de lá. Não importa se são 3 ou 30 terminais.
>
> Lembre que o instalador contém a senha que o sistema usa para falar com o
> banco. Num repositório público qualquer pessoa pode baixá-lo — o banco só é
> alcançável pela rede local da empresa, mas quem estiver nessa rede (um
> visitante no Wi-Fi, por exemplo) passaria a ter acesso aos dados. Se isso
> incomodar, use o caminho pelo servidor.

### Pelo servidor (sem internet nenhuma)

1. Quem desenvolve entrega o `.exe` por pen drive, e-mail ou nuvem.
2. **No PC servidor**, um administrador abre **Configurações → Atualização do
   sistema**, informa a versão, escreve uma linha sobre o que mudou e clica em
   **Escolher instalador e publicar**.

O instalador fica guardado dentro do banco, e o download é conferido por soma de
verificação antes de abrir. Convém remover do histórico as versões antigas: cada
uma ocupa uns 110 MB no banco.

## Consulta de CNPJ

No cadastro de clientes, o primeiro campo é o **CNPJ**. Ao completar os 14
dígitos, o sistema consulta a Receita Federal pela BrasilAPI e preenche razão
social, nome fantasia, endereço, cidade e telefone. Só preenche campos vazios —
nada do que já foi digitado se perde.

É o único ponto do sistema que usa internet, e é opcional: sem conexão aparece
um aviso e o cadastro segue à mão, como sempre.

## Dia a dia

- **Backup**: no servidor, `Configurações → Exportar JSON` gera um arquivo com
  tudo. Para um backup completo do banco, o comando abaixo, rodado no servidor:

  ```bash
  "C:\Program Files\Sistema Estrudena\resources\pgsql\bin\pg_dump.exe" -h 127.0.0.1 -U estrudena -d estrudena -F c -f backup-estrudena.dump
  ```

- **Atualizar o sistema**: veja a seção abaixo — os terminais avisam sozinhos.

- **Desinstalar**: em Aplicativos do Windows. No servidor, ele pergunta se deve
  apagar também o banco de dados — responda **Não** se quiser reinstalar depois
  sem perder as propostas.

---

## Se der problema

| Sintoma | O que fazer |
| --- | --- |
| Terminal não acha o servidor | A mensagem na tela diz em quais redes ele procurou (ex.: *procurou em 192.168.15.0/24*). Se o IP do servidor não começa com esses mesmos três números, as duas máquinas estão em redes diferentes — é o caso de uma no Wi-Fi e a outra no cabo. |
| Não acha, e as duas estão na mesma rede | Provavelmente o firewall do servidor. Veja o item abaixo sobre rede "Pública". No servidor, confira também em Serviços do Windows se `EstrudenaDB` está *Em execução*. |
| "Não encontrei o servidor" mesmo com tudo ligado | Digite o IP do servidor no campo que aparece. Descubra o IP rodando `ipconfig` no servidor. |
| A instalação do servidor falhou | Leia `C:\ProgramData\Estrudena\instalacao.log` — a última linha diz onde parou. O programa em si já está instalado; dá para refazer só a parte do banco com o comando abaixo, num PowerShell **como administrador**, sem reinstalar nada. |
| Um usuário não consegue entrar | Como administrador, confira em **Usuários** se a conta está *Ativa*, e redefina a senha. |

**Só para suporte** — na operação normal ninguém digita nada. Se for preciso
refazer a configuração do banco sem reinstalar, num PowerShell como
administrador:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Program Files\Sistema Estrudena\resources\setup-servidor.ps1" -PgRoot "C:\Program Files\Sistema Estrudena\resources\pgsql"
```

É idempotente: se o cluster já existir, os dados são preservados e o roteiro só
reconfere serviço, rede e firewall. O parâmetro `-SomenteBanco` refaz apenas a
parte de dados, sem tocar em serviço nem firewall.

### Servidores instalados até a versão 1.2.2

Até a 1.2.2 a regra de firewall era criada só para os perfis *Domínio* e
*Particular*. O Windows classifica como **Pública** toda rede em que ninguém
respondeu ao aviso de descoberta, que é o caso da maioria das redes de
escritório — e nessas o banco subia normalmente, escutava na rede e mesmo assim
nenhum terminal o encontrava, porque o Windows descartava a conexão antes de ela
chegar no PostgreSQL.

Reinstalar o servidor com a versão nova já corrige. Para corrigir na hora, sem
reinstalar, num PowerShell **como administrador** no PC servidor:

```bash
netsh advfirewall firewall delete rule name="Sistema Estrudena - PostgreSQL"; netsh advfirewall firewall add rule name="Sistema Estrudena - PostgreSQL" dir=in action=allow protocol=TCP localport=5432 profile=any remoteip=localsubnet
```

`remoteip=localsubnet` mantém a abertura restrita a quem está na mesma rede
física; o `pg_hba.conf` também só atende faixas privadas e exige senha, então a
porta não fica exposta à internet.

Para conferir em qual perfil cada placa está:

```bash
powershell -NoProfile -Command "Get-NetConnectionProfile | Select-Object InterfaceAlias, NetworkCategory"
```

---

## Para quem for dar manutenção no código

```bash
npm install          # dependências
npm run fetch:pg     # baixa o PostgreSQL embutido (uma vez por máquina de build)
npm run dev          # roda em desenvolvimento
npm run typecheck    # confere tipos do app e do processo principal
npm run dist         # gera o instalador em release/
```

Testes contra um banco real (é preciso ter um PostgreSQL respondendo em
`127.0.0.1:5432` com a role e o banco `estrudena`):

```bash
npm run teste                 # 50 verificações: migração, seed, login, cálculo, gravação
npm run teste:telas           # navega as telas do perfil e confere menu, título e console
npm run teste:fluxo           # orçamento → Gerar Proposta → modal → PDFs → Propostas
npm run teste:pdf             # gera os dois PDFs e analisa fundo, imagens e paginação
npm run teste:atualizacao     # publica uma versão, o terminal avisa e baixa de volta
npm run capturas              # fotografa cada tela do sistema
```

`analisar-pdf.mjs` abre um PDF já gerado e mostra quantas imagens ele embute e
que retângulos de cor pinta — foi assim que apareceram o fundo cinza herdado da
janela e os desenhos que não entravam no papel.

`teste:telas` aceita o usuário: `node scripts/diagnostico.mjs producao estrudena`
percorre só o que o perfil Produção enxerga.

Se os testes de tela saírem sem nenhuma saída, geralmente há uma instância do
Electron pendurada de uma execução anterior segurando o *single instance lock* —
encerre os processos `electron` e rode de novo.

**Estrutura**

| Pasta | O que tem |
| --- | --- |
| `electron/` | processo principal: conexão, descoberta na rede, migrações, IPC |
| `electron/db/schema.sql` | schema relacional (idempotente, aplicado na 1ª conexão) |
| `electron/db/seed-data.ts` | catálogo da empresa e usuários iniciais |
| `src/calc.ts` | motor de cálculo derivado da planilha — não alterar sem conferir a planilha |
| `src/screens/` | as 15 telas |
| `build/installer.nsh` | página Servidor/Terminal do instalador |
| `build/setup-servidor.ps1` | instala e configura o PostgreSQL no servidor |

A senha que o aplicativo usa para falar com o banco está em
`electron/db/credentials.ts`. É a mesma em todas as máquinas — é isso que
permite o terminal achar o servidor sem configuração. Para trocá-la, altere o
arquivo, rode `ALTER ROLE estrudena WITH PASSWORD '<nova>';` no servidor e
reinstale os terminais.

