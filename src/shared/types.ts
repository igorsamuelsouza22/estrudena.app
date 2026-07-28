export type Perfil = 'Administrador' | 'Vendedor' | 'Produção'
export type Unidade = 'KG' | 'M2' | 'UN' | 'ML'
export type UnidadeAces = 'UN' | 'ML'
export type StatusOrc = 'Rascunho' | 'Proposta' | 'Em análise' | 'Aprovado' | 'Perdido'
export type StatusSep = 'Pendente' | 'Em separação' | 'Concluída'

export interface Config {
  precoKg: number; perda: number; moKg: number; moM2: number; moHora: number; moKm: number
  markup: number; imposto: number; com1: number; com2: number
  impMaterial: number; impIndust: number; impMo: number
  validade: number; condPag: string; prazo: string
  empresa: string; endereco: string; endereco2: string
  fone: string; email: string; site: string
  observacoes: string[]
}

export interface AcesRef { acesId: string; qtd: number }

export interface Material {
  id: string; cod: string; desc: string; serie: string; tipo: string
  unidade: Unidade
  pesoUnit: number; larg: number | null; alt: number | null; preco: number; fc: number
  corId: string; kitId: string
  aces: AcesRef[]
  img: string; imgData: string | null
  markup: number; imposto: number; comissao: number; moM2: number
}

export interface Cor {
  id: string; cod: string; nome: string; acabamento: string; fornecedor: string
  precoKg: number; precoM2: number; ativo: boolean
}

export interface Acessorio {
  id: string; cod: string; nome: string; grupo: string; fornecedor: string
  unidade: UnidadeAces; preco: number; ativo: boolean
}

export interface Kit { id: string; cod: string; nome: string; aplicacao: string; itens: AcesRef[] }

export interface KitVendaItem { matId: string; qtd: number }
export interface KitVenda { id: string; cod: string; nome: string; descricao: string; itens: KitVendaItem[] }

export interface Instalador {
  id: string; cod: string; nome: string; tipo: string; doc: string
  responsavel: string; fone: string; regiao: string
  precoM2: number; diaria: number; equipe: number; ativo: boolean; obs: string
}

export interface Cliente {
  id: string; nome: string; razao: string; cnpj: string; endereco: string
  cidade: string; contato: string; fone: string; email: string
}

export interface Usuario {
  id: string; nome: string; usuario: string; perfil: Perfil; ativo: boolean
  criadoEm?: string
}

export interface OrcItem {
  matId: string; qtd: number
  larg: number | null; alt: number | null
  local: string; desc: string | null; serie: string | null
  perfil: string; vidro: string; detalhe: string | null
  markup: number | null; fc: number
}

export interface Orcamento {
  id: string; numero: string; rev: string; status: StatusOrc; data: string
  vendedor: string; enviadaEm: string
  clienteId: string; obra: string; cidade: string; contato: string
  prazo: string; condPag: string; instaladorId: string
  itens: OrcItem[]
  moM2: number; moHoras: number; moHora: number; moPct: number; moFixo: number
  km: number; moKm: number
  frete: number; terceiros: number; outros: number
  markup: number; imposto: number; com1: number; com2: number; perda: number; desconto: number
}

export interface Separacao {
  status: StatusSep
  conf: Record<string, number>
  responsavel: string; obs: string; iniciado: string; concluido: string
}

export interface DB {
  config: Config
  materiais: Material[]
  cores: Cor[]
  acessorios: Acessorio[]
  kits: Kit[]
  kitsVenda: KitVenda[]
  instaladores: Instalador[]
  clientes: Cliente[]
  usuarios: Usuario[]
  orcamentos: Orcamento[]
  separacoes: Record<string, Separacao>
  series: string[]
  tipos: string[]
  acesGrupos: string[]
  acabamentos: string[]
  condicoesPag: string[]
  prazosEntrega: string[]
  fornecedores: string[]
  tiposEquipe: string[]
  seq: number
}

/** Estado da conexão reportado pelo processo principal. */
export interface ConnState {
  status: 'desconectado' | 'procurando' | 'conectado' | 'erro'
  host: string
  porta: number
  mensagem: string
  modoServidor: boolean
}

export interface LoginResult {
  ok: boolean
  erro?: string
  usuario?: Usuario
}

/** Retorno da consulta de CNPJ, já pronto para preencher a ficha do cliente. */
export interface DadosCnpj {
  cnpj: string
  razao: string
  nome: string
  endereco: string
  cidade: string
  fone: string
  email: string
}

/** Uma versão do sistema disponível, seja no servidor ou numa release. */
export interface VersaoPublicada {
  versao: string
  publicadoEm: string
  publicadoPor: string
  notas: string
  arquivo: string
  tamanho: number
  sha256: string
  /** Ausente quando veio do banco do servidor. */
  origem?: 'github'
  /** Endereço do instalador, quando a origem é o GitHub. */
  url?: string
}

/** Resposta da checagem de atualização feita na abertura do sistema. */
export interface EstadoAtualizacao {
  versaoLocal: string
  /** Repositório configurado para atualização, vazio se não houver. */
  repo: string
  disponivel: VersaoPublicada | null
  /** true quando a versão disponível é mais nova que a instalada nesta máquina. */
  temNova: boolean
}
