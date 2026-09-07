import type { PoliticaPermissoes } from '../permissoes'
export type Perfil = 'Administrador' | 'Vendedor' | 'Produção'
export type Unidade = 'KG' | 'M2' | 'UN' | 'ML'
export type UnidadeAces = 'UN' | 'ML'
export type StatusOrc = 'Rascunho' | 'Proposta' | 'Enviada' | 'Em análise' | 'Aprovado' | 'Perdido' | 'Expirada' | 'Substituída'
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

export type CategoriaItem = 'produto' | 'materia_prima'
export interface ComponenteMaterial {
  materialId: string
  qtd: number
  /** Consumo por produto, por m² do produto ou por metro de largura. */
  base: 'UN' | 'M2' | 'ML'
}

export interface Material {
  atualizadoEm?: string
  id: string; cod: string; desc: string; serie: string; tipo: string
  categoria: CategoriaItem
  composicao: ComponenteMaterial[]
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

export type ReferenciaPrecos = Pick<DB, 'config' | 'materiais' | 'cores' | 'acessorios' | 'kits'> & { capturadoEm: string }

export interface Orcamento {
  origemId?: string
  emitidaEm?: string
  validadeAte?: string
  rascunhoId?: string
  referenciaPrecos?: ReferenciaPrecos
  atualizadoEm?: string
  entregaPrevista?: string
  prioridade?: 'Normal' | 'Alta' | 'Urgente'
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
  versao?: number
  insumos?: Record<string, number>
  status: StatusSep
  conf: Record<string, number>
  responsavel: string; obs: string; iniciado: string; concluido: string
}

export interface DB {
  permissoes?: PoliticaPermissoes
  pedidos?: PedidoVenda[]
  eventos?: EventoNegocio[]
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


export type EtapaProducao = 'Aguardando liberação' | 'Materiais pendentes' | 'Em separação' | 'Em fabricação' | 'Em conferência' | 'Pronta para expedição' | 'Concluída'
export interface EntregaPedido {
  id: string; status: 'Programada' | 'Em transporte' | 'Entregue' | 'Ocorrência'
  data: string; responsavel: string; comprovante: string; quantidades: Record<string, number>
}
export interface PedidoVenda {
  legado?: boolean
  ordemProducaoId?: string
  id: string; numero: string; orcamentoId: string; versao: number
  status: 'Confirmado' | 'Liberado' | 'Em execução' | 'Concluído' | 'Cancelado'
  proposta: Orcamento; cliente?: Cliente; total: number
  aprovadoEm: string; aprovadoPor: string; evidencia: string
  etapa: EtapaProducao; entregaPrevista: string; prioridade: 'Normal' | 'Alta' | 'Urgente'
  instalacao: 'Não contratada' | 'A programar' | 'Programada' | 'Em execução' | 'Concluída' | 'Pendência'
  instalacaoData: string; instalacaoResponsavel: string
  compradosProntos: number[]; entregas: EntregaPedido[]
  revisoesAnteriores: { proposta: Orcamento; etapa: EtapaProducao; motivo: string; data: string }[]
}
export interface EventoNegocio {
  id: string; numero: string; data: string; autor: string; acao: string; detalhe: string
}
export interface ComandoNegocio {
  acao: 'enviar' | 'negociar' | 'aprovar' | 'recusar' | 'expirar' | 'liberar' | 'planejar' | 'fabricar' | 'conferir' | 'expedir' | 'entrega' | 'instalacao' | 'concluir' | 'cancelar' | 'regularizar'
  id: string; versao?: number; atualizadoEm?: string
  motivo?: string; responsavel?: string; data?: string; evidencia?: string
  instalacaoContratada?: boolean; medidasConferidas?: boolean; requisitosConferidos?: boolean
  compradosProntos?: number[]; impactoConfirmado?: boolean
  prioridade?: PedidoVenda['prioridade']; entrega?: EntregaPedido
  instalacao?: PedidoVenda['instalacao']
}
export const nomeProposta = (o: Pick<Orcamento, 'numero' | 'rev'>) => `${o.numero}.rev${Number(o.rev.replace(/\D/g, '')) || 1}`
