import { pode as verificarPermissao, PERMISSAO_TELA, type Permissao } from './permissoes'
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode
} from 'react'
import { chamar, ponte } from './api'
import { guardarLocal, lerLocal, chaveOrcamento } from './rascunhos'
import { Motor } from './calc'
import { hoje } from './format'
import type { DB, Orcamento, Perfil, Separacao, Usuario } from './shared/types'

export type Tela =
  | 'pedidos' | 'dashboard' | 'novo' | 'lista' | 'clientes' | 'separacao'
  | 'apoio' | 'itens' | 'materiasprimas' | 'cores' | 'acessorios' | 'kits' | 'kitsvenda' | 'instaladores'
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
  pode: (p:Permissao) => boolean
  tela: Tela
  irPara: (t: Tela, registroId?: string) => void
  registroId: string
  gravando: boolean
  rascunhos: Orcamento[]
  removerRascunho: (o: Orcamento) => void
  flash: string
  say: (m: string) => void
  recarregar: () => Promise<void>
  /** Executa uma gravação, avisa e recarrega. Erros viram flash. */
  gravar: (fn: () => Promise<unknown>, msg: string) => Promise<boolean>
  q: Orcamento
  setQ: (fn: (q: Orcamento) => Orcamento) => void
  abrirOrc: (o: Orcamento) => void
  novoOrc: (clienteId?: string) => void
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
    rascunhoId: crypto.randomUUID(), id: '', numero: '(automático)', rev: 'rev1', status: 'Rascunho',
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
  const [registroId, setRegistroId] = useState('')
  const [gravando, setGravando] = useState(false)
  const trava = useRef(false)
  const chave = `estrudena:orcamentos:${p.user.id}`
  const [rascunhos, setRascunhos] = useState<Orcamento[]>(() => lerLocal(chave, []))
  const rascunhosRef = useRef(rascunhos); rascunhosRef.current = rascunhos
  const [q, setQState] = useState<Orcamento>(() => orcamentoEmBranco(p.db, p.user))
  const qRef = useRef(q); qRef.current = q
  const removerRascunho = (o: Orcamento) => {
    const nova = rascunhosRef.current.filter(x => chaveOrcamento(x) !== chaveOrcamento(o))
    rascunhosRef.current = nova; guardarLocal(chave, nova); setRascunhos(nova)
  }
  const [sepId, setSepId] = useState('')
  const [pedidoImpressao, setPedidoImpressao] = useState<PedidoImpressao | null>(null)
  const timer = useRef<number>()

  const say = useCallback((m: string) => {
    setFlash(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFlash(''), 15000)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const motor = useMemo(() => new Motor(p.db), [p.db])

  const gravar = useCallback(async (fn: () => Promise<unknown>, msg: string) => {
    if (trava.current) return false
    trava.current = true; setGravando(true)
    let escrito = false
    try {
      await fn()
      escrito = true
      await p.onRecarregar()
      say(msg)
      return true
    } catch (e) {
      say(escrito ? 'Gravado no servidor, mas a atualização da tela falhou. Use Reconectar para atualizar.' : (e instanceof Error ? e.message : 'Falha ao gravar no banco. Tente salvar novamente.'))
      return escrito
    } finally {
      trava.current = false; setGravando(false)
    }
  }, [p, say])

  const usuarioAtual = p.db.usuarios.find(u=>u.id===p.user.id) || p.user
  const pode = (permissao:Permissao) => verificarPermissao(p.db.permissoes?.matriz,usuarioAtual.perfil,permissao)
  useEffect(()=>{
    const atualizar=()=>{if(document.visibilityState==='visible')void p.onRecarregar().catch(()=>{})}
    const timer=window.setInterval(atualizar,15000)
    window.addEventListener('focus',atualizar)
    return ()=>{window.clearInterval(timer);window.removeEventListener('focus',atualizar)}
  },[p.onRecarregar])
  const valor: Ctx = {
    db: p.db,
    motor,
    user: usuarioAtual,
    perfil: usuarioAtual.perfil,
    verCustos: pode('valores'), pode,
    tela,
    irPara: (t, id = '') => { const permissao=PERMISSAO_TELA[t]; if(permissao&&!pode(permissao)){say('Seu perfil não tem acesso a esta área.');return} setRegistroId(id); setTela(t) },
    registroId, gravando, rascunhos, removerRascunho,
    flash,
    say,
    recarregar: p.onRecarregar,
    gravar,
    q,
    setQ: fn => {
      const novo = fn(qRef.current)
      qRef.current = novo; setQState(novo)
      const nova = [...rascunhosRef.current.filter(x => chaveOrcamento(x) !== chaveOrcamento(novo)), novo]
      rascunhosRef.current = nova; setRascunhos(nova)
      if (!guardarLocal(chave, nova)) say('Não foi possível proteger o rascunho neste computador. Salve no servidor antes de sair.')
    },
    abrirOrc: o => { if(!pode('orcamentos'))return say('Seu perfil não tem acesso aos orçamentos.'); const novo = structuredClone(o); qRef.current = novo; setQState(novo); setTela('novo') },
    novoOrc: clienteId => {
      if(!pode('orcamentos'))return say('Seu perfil não pode criar orçamentos.')
      const c = p.db.clientes.find(c => c.id === clienteId)
      const novo = { ...orcamentoEmBranco(p.db, p.user), ...(c ? { clienteId: c.id, cidade: c.cidade, contato: c.contato } : {}) }
      qRef.current = novo; setQState(novo); setTela('novo')
    },
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
