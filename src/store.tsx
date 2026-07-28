import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode
} from 'react'
import { chamar, ponte } from './api'
import { Motor } from './calc'
import { hoje } from './format'
import type { DB, Orcamento, Perfil, Separacao, Usuario } from './shared/types'

export type Tela =
  | 'dashboard' | 'novo' | 'lista' | 'clientes' | 'separacao'
  | 'itens' | 'cores' | 'acessorios' | 'kits' | 'kitsvenda' | 'instaladores'
  | 'relatorios' | 'usuarios' | 'config'

/** Documentos a gerar em PDF para um orçamento. */
export interface PedidoImpressao {
  orcId: string
  proposta: boolean
  separacao: boolean
}

interface Ctx {
  db: DB
  motor: Motor
  user: Usuario
  perfil: Perfil
  verCustos: boolean
  tela: Tela
  irPara: (t: Tela) => void
  flash: string
  say: (m: string) => void
  recarregar: () => Promise<void>
  /** Executa uma gravação, avisa e recarrega. Erros viram flash. */
  gravar: (fn: () => Promise<unknown>, msg: string) => Promise<boolean>
  q: Orcamento
  setQ: (fn: (q: Orcamento) => Orcamento) => void
  abrirOrc: (o: Orcamento) => void
  novoOrc: () => void
  sepId: string
  setSepId: (id: string) => void
  pedidoImpressao: PedidoImpressao | null
  imprimir: (p: PedidoImpressao) => void
  encerrarImpressao: () => void
  sepDe: (id: string) => Separacao
  sair: () => void
}

const C = createContext<Ctx | null>(null)
export const useApp = (): Ctx => {
  const v = useContext(C)
  if (!v) throw new Error('useApp fora do provider')
  return v
}

export const SEP_VAZIA: Separacao = {
  status: 'Pendente', conf: {}, responsavel: '', obs: '', iniciado: '', concluido: ''
}

/** Orçamento novo, herdando os parâmetros globais. */
export function orcamentoEmBranco(db: DB, user: Usuario): Orcamento {
  const c = db.config
  return {
    id: '', numero: '(automático)', rev: 'Rev. 00', status: 'Rascunho',
    data: hoje(), vendedor: user.nome, enviadaEm: '',
    clienteId: db.clientes[0]?.id ?? '',
    obra: '', cidade: db.clientes[0]?.cidade ?? '', contato: db.clientes[0]?.contato ?? '',
    prazo: c.prazo, condPag: c.condPag,
    instaladorId: db.instaladores[0]?.id ?? '',
    itens: [],
    moM2: c.moM2, moHoras: 0, moHora: c.moHora, moPct: 0, moFixo: 0, km: 0, moKm: c.moKm,
    frete: 0, terceiros: 0, outros: 0,
    markup: c.markup, imposto: c.imposto, com1: c.com1, com2: c.com2, perda: c.perda, desconto: 0
  }
}

export function Provider(p: {
  db: DB
  user: Usuario
  onRecarregar: () => Promise<void>
  onSair: () => void
  children: ReactNode
}) {
  const [tela, setTela] = useState<Tela>('dashboard')
  const [flash, setFlash] = useState('')
  const [q, setQState] = useState<Orcamento>(() => orcamentoEmBranco(p.db, p.user))
  const [sepId, setSepId] = useState('')
  const [pedidoImpressao, setPedidoImpressao] = useState<PedidoImpressao | null>(null)
  const timer = useRef<number>()

  const say = useCallback((m: string) => {
    setFlash(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFlash(''), 2600)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Sem seleção prévia, cai no primeiro pedido aprovado.
  useEffect(() => {
    if (!sepId && p.db.orcamentos.length) {
      const alvo = p.db.orcamentos.find(o => o.status === 'Aprovado') ?? p.db.orcamentos[0]
      setSepId(alvo.id)
    }
  }, [p.db.orcamentos, sepId])

  const motor = useMemo(() => new Motor(p.db), [p.db])

  const gravar = useCallback(async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn()
      await p.onRecarregar()
      say(msg)
      return true
    } catch (e) {
      say(e instanceof Error ? e.message : 'Falha ao gravar no banco.')
      return false
    }
  }, [p, say])

  const valor: Ctx = {
    db: p.db,
    motor,
    user: p.user,
    perfil: p.user.perfil,
    verCustos: p.user.perfil !== 'Produção',
    tela,
    irPara: setTela,
    flash,
    say,
    recarregar: p.onRecarregar,
    gravar,
    q,
    setQ: fn => setQState(atual => fn(atual)),
    abrirOrc: o => { setQState(structuredClone(o)); setTela('novo') },
    novoOrc: () => { setQState(orcamentoEmBranco(p.db, p.user)); setTela('novo') },
    sepId, setSepId,
    pedidoImpressao,
    imprimir: setPedidoImpressao,
    encerrarImpressao: () => setPedidoImpressao(null),
    sepDe: id => p.db.separacoes[id] ?? SEP_VAZIA,
    sair: p.onSair
  }

  return <C.Provider value={valor}>{p.children}</C.Provider>
}

/** Grava a separação e devolve o objeto atualizado, para o chamador reagir. */
export async function patchSeparacao(
  id: string, atual: Separacao, fn: (s: Separacao) => void
): Promise<Separacao> {
  const novo = structuredClone(atual)
  fn(novo)
  await chamar(ponte().salvarSeparacao(id, novo))
  return novo
}
