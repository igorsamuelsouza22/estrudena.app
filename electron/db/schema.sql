-- Sistema Estrudena — schema relacional
-- Executado automaticamente na primeira conexão. Idempotente.

CREATE TABLE IF NOT EXISTS schema_versao (
  versao      integer PRIMARY KEY,
  aplicado_em timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- parâmetros
CREATE TABLE IF NOT EXISTS config (
  id           boolean PRIMARY KEY DEFAULT true CHECK (id),
  preco_kg     numeric(14,4) NOT NULL DEFAULT 35.25,
  perda        numeric(9,4)  NOT NULL DEFAULT 0,
  mo_kg        numeric(14,4) NOT NULL DEFAULT 4.73,
  mo_m2        numeric(14,4) NOT NULL DEFAULT 170.24,
  mo_hora      numeric(14,4) NOT NULL DEFAULT 780,
  mo_km        numeric(14,4) NOT NULL DEFAULT 4.20,
  markup       numeric(9,4)  NOT NULL DEFAULT 52,
  imposto      numeric(9,4)  NOT NULL DEFAULT 7,
  com1         numeric(9,4)  NOT NULL DEFAULT 5,
  com2         numeric(9,4)  NOT NULL DEFAULT 0,
  imp_material numeric(9,4)  NOT NULL DEFAULT 50,
  imp_indust   numeric(9,4)  NOT NULL DEFAULT 40,
  imp_mo       numeric(9,4)  NOT NULL DEFAULT 10,
  validade     integer       NOT NULL DEFAULT 15,
  cond_pag     text          NOT NULL DEFAULT 'A COMBINAR',
  prazo        text          NOT NULL DEFAULT 'A COMBINAR',
  empresa      text          NOT NULL DEFAULT 'ESTRUDENA',
  endereco     text          NOT NULL DEFAULT '',
  endereco2    text          NOT NULL DEFAULT '',
  fone         text          NOT NULL DEFAULT '',
  email        text          NOT NULL DEFAULT '',
  site         text          NOT NULL DEFAULT '',
  observacoes  text[]        NOT NULL DEFAULT '{}',
  seq          integer       NOT NULL DEFAULT 0
);

-- Repositório de onde os terminais buscam atualização.
-- Coluna acrescentada depois da primeira versão, por isso o ADD COLUMN.
ALTER TABLE config ADD COLUMN IF NOT EXISTS github_repo text NOT NULL
  DEFAULT 'igorsamuelsouza22/estrudena.app';

-- Listas gerenciáveis (séries, tipos, grupos, acabamentos, fornecedores...)
CREATE TABLE IF NOT EXISTS listas (
  categoria text    NOT NULL,
  valor     text    NOT NULL,
  ordem     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (categoria, valor)
);

-- ---------------------------------------------------------------- cadastros
CREATE TABLE IF NOT EXISTS cores (
  id         text PRIMARY KEY,
  cod        text NOT NULL,
  nome       text NOT NULL,
  acabamento text NOT NULL DEFAULT '',
  fornecedor text NOT NULL DEFAULT '',
  preco_kg   numeric(14,4) NOT NULL DEFAULT 0,
  preco_m2   numeric(14,4) NOT NULL DEFAULT 0,
  ativo      boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS acessorios (
  id         text PRIMARY KEY,
  cod        text NOT NULL,
  nome       text NOT NULL,
  grupo      text NOT NULL DEFAULT '',
  fornecedor text NOT NULL DEFAULT '',
  unidade    text NOT NULL DEFAULT 'UN' CHECK (unidade IN ('UN','ML')),
  preco      numeric(14,4) NOT NULL DEFAULT 0,
  ativo      boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS kits (
  id        text PRIMARY KEY,
  cod       text NOT NULL,
  nome      text NOT NULL,
  aplicacao text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS kit_itens (
  kit_id  text NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  aces_id text NOT NULL REFERENCES acessorios(id) ON DELETE RESTRICT,
  qtd     numeric(14,4) NOT NULL DEFAULT 0,
  ordem   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (kit_id, aces_id)
);

CREATE TABLE IF NOT EXISTS materiais (
  id        text PRIMARY KEY,
  cod       text NOT NULL,
  descricao text NOT NULL,
  serie     text NOT NULL DEFAULT '—',
  tipo      text NOT NULL DEFAULT '',
  unidade   text NOT NULL DEFAULT 'KG' CHECK (unidade IN ('KG','M2','UN','ML')),
  peso_unit numeric(14,4) NOT NULL DEFAULT 0,
  larg      integer,
  alt       integer,
  preco     numeric(14,4) NOT NULL DEFAULT 0,
  fc        numeric(9,4)  NOT NULL DEFAULT 1,
  cor_id    text REFERENCES cores(id) ON DELETE SET NULL,
  kit_id    text REFERENCES kits(id)  ON DELETE SET NULL,
  img       text NOT NULL DEFAULT '',
  img_data  text,
  markup    numeric(9,4) NOT NULL DEFAULT 52,
  imposto   numeric(9,4) NOT NULL DEFAULT 7,
  comissao  numeric(9,4) NOT NULL DEFAULT 5,
  mo_m2     numeric(14,4) NOT NULL DEFAULT 170.24
);

CREATE TABLE IF NOT EXISTS material_acessorios (
  material_id text NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  aces_id     text NOT NULL REFERENCES acessorios(id) ON DELETE RESTRICT,
  qtd         numeric(14,4) NOT NULL DEFAULT 0,
  ordem       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (material_id, aces_id)
);

CREATE TABLE IF NOT EXISTS kits_venda (
  id        text PRIMARY KEY,
  cod       text NOT NULL,
  nome      text NOT NULL,
  descricao text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS kit_venda_itens (
  kit_id      text NOT NULL REFERENCES kits_venda(id) ON DELETE CASCADE,
  material_id text NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
  qtd         numeric(14,4) NOT NULL DEFAULT 1,
  ordem       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (kit_id, material_id)
);

CREATE TABLE IF NOT EXISTS instaladores (
  id          text PRIMARY KEY,
  cod         text NOT NULL,
  nome        text NOT NULL,
  tipo        text NOT NULL DEFAULT 'Própria',
  doc         text NOT NULL DEFAULT '',
  responsavel text NOT NULL DEFAULT '',
  fone        text NOT NULL DEFAULT '',
  regiao      text NOT NULL DEFAULT '',
  preco_m2    numeric(14,4) NOT NULL DEFAULT 0,
  diaria      numeric(14,4) NOT NULL DEFAULT 0,
  equipe      integer NOT NULL DEFAULT 1,
  ativo       boolean NOT NULL DEFAULT true,
  obs         text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS clientes (
  id       text PRIMARY KEY,
  nome     text NOT NULL,
  razao    text NOT NULL DEFAULT '',
  cnpj     text NOT NULL DEFAULT '',
  endereco text NOT NULL DEFAULT '',
  cidade   text NOT NULL DEFAULT '',
  contato  text NOT NULL DEFAULT '',
  fone     text NOT NULL DEFAULT '',
  email    text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS usuarios (
  id         text PRIMARY KEY,
  nome       text NOT NULL,
  usuario    text NOT NULL UNIQUE,
  senha_hash text NOT NULL,
  perfil     text NOT NULL CHECK (perfil IN ('Administrador','Vendedor','Produção')),
  ativo      boolean NOT NULL DEFAULT true,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- documentos
CREATE TABLE IF NOT EXISTS orcamentos (
  id            text PRIMARY KEY,
  numero        text NOT NULL,
  rev           text NOT NULL DEFAULT 'Rev. 00',
  status        text NOT NULL DEFAULT 'Rascunho'
                CHECK (status IN ('Rascunho','Proposta','Em análise','Aprovado','Perdido')),
  data          text NOT NULL DEFAULT '',
  vendedor      text NOT NULL DEFAULT '',
  enviada_em    text NOT NULL DEFAULT '',
  cliente_id    text REFERENCES clientes(id) ON DELETE RESTRICT,
  obra          text NOT NULL DEFAULT '',
  cidade        text NOT NULL DEFAULT '',
  contato       text NOT NULL DEFAULT '',
  prazo         text NOT NULL DEFAULT '',
  cond_pag      text NOT NULL DEFAULT '',
  instalador_id text REFERENCES instaladores(id) ON DELETE SET NULL,
  mo_m2         numeric(14,4) NOT NULL DEFAULT 0,
  mo_horas      numeric(14,4) NOT NULL DEFAULT 0,
  mo_hora       numeric(14,4) NOT NULL DEFAULT 0,
  mo_pct        numeric(9,4)  NOT NULL DEFAULT 0,
  mo_fixo       numeric(14,4) NOT NULL DEFAULT 0,
  km            numeric(14,4) NOT NULL DEFAULT 0,
  mo_km         numeric(14,4) NOT NULL DEFAULT 0,
  frete         numeric(14,4) NOT NULL DEFAULT 0,
  terceiros     numeric(14,4) NOT NULL DEFAULT 0,
  outros        numeric(14,4) NOT NULL DEFAULT 0,
  markup        numeric(9,4)  NOT NULL DEFAULT 52,
  imposto       numeric(9,4)  NOT NULL DEFAULT 7,
  com1          numeric(9,4)  NOT NULL DEFAULT 5,
  com2          numeric(9,4)  NOT NULL DEFAULT 0,
  perda         numeric(9,4)  NOT NULL DEFAULT 0,
  desconto      numeric(9,4)  NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orcamentos_numero_idx ON orcamentos (numero);
CREATE INDEX IF NOT EXISTS orcamentos_status_idx ON orcamentos (status);

CREATE TABLE IF NOT EXISTS orcamento_itens (
  orcamento_id text    NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  ordem        integer NOT NULL,
  material_id  text    NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
  qtd          numeric(14,4) NOT NULL DEFAULT 1,
  larg         integer,
  alt          integer,
  local        text NOT NULL DEFAULT '',
  descricao    text,
  serie        text,
  perfil       text NOT NULL DEFAULT '',
  vidro        text NOT NULL DEFAULT '—',
  detalhe      text,
  markup       numeric(9,4),
  fc           numeric(9,4) NOT NULL DEFAULT 1,
  PRIMARY KEY (orcamento_id, ordem)
);

CREATE TABLE IF NOT EXISTS separacoes (
  orcamento_id text PRIMARY KEY REFERENCES orcamentos(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'Pendente'
               CHECK (status IN ('Pendente','Em separação','Concluída')),
  responsavel  text NOT NULL DEFAULT '',
  obs          text NOT NULL DEFAULT '',
  iniciado     text NOT NULL DEFAULT '',
  concluido    text NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------- versões
-- O instalador de cada versão fica guardado aqui. É o único canal que todas as
-- máquinas já enxergam, então serve de servidor de atualização sem exigir
-- internet, pasta compartilhada ou hospedagem externa.
CREATE TABLE IF NOT EXISTS versoes (
  versao        text PRIMARY KEY,
  publicado_em  timestamptz NOT NULL DEFAULT now(),
  publicado_por text NOT NULL DEFAULT '',
  notas         text NOT NULL DEFAULT '',
  arquivo       text NOT NULL,
  tamanho       bigint NOT NULL,
  sha256        text NOT NULL,
  conteudo      bytea NOT NULL
);

-- Resposta mais recente do GitHub sobre a última release.
--
-- O GitHub permite 60 consultas por hora por IP, e todas as máquinas da empresa
-- saem pelo mesmo IP. Sem este cache, poucos terminais consultando de tempos em
-- tempos esgotariam a cota e a atualização pararia de chegar. Assim é uma
-- consulta por hora para a rede inteira, independente de quantos terminais.
CREATE TABLE IF NOT EXISTS atualizacao_cache (
  id            boolean PRIMARY KEY DEFAULT true CHECK (id),
  verificado_em timestamptz NOT NULL DEFAULT to_timestamp(0),
  versao        text NOT NULL DEFAULT '',
  arquivo       text NOT NULL DEFAULT '',
  url           text NOT NULL DEFAULT '',
  tamanho       bigint NOT NULL DEFAULT 0,
  notas         text NOT NULL DEFAULT '',
  publicado_em  text NOT NULL DEFAULT ''
);
INSERT INTO atualizacao_cache (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS separacao_conf (
  orcamento_id text    NOT NULL REFERENCES separacoes(orcamento_id) ON DELETE CASCADE,
  ordem        integer NOT NULL,
  separado     numeric(14,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (orcamento_id, ordem)
);
