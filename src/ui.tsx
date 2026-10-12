import { type CSSProperties, type ReactNode, Children, cloneElement, isValidElement, createContext, useContext, useId, useEffect, useRef, useState } from 'react'
import { useApp } from './store'
import { usePendenciaAtualizacao } from './atualizacao'

export const muted = '#5f6368'
export const muted45 = '#5f6368'
export const muted50 = '#5f6368'
export const divInterna = '1px solid color-mix(in srgb, var(--color-text) 9%, transparent)'

export function Card(p: {
  titulo?: string
  direita?: ReactNode
  children: ReactNode
  style?: CSSProperties
  altura?: number
  className?: string
}) {
  return (
    <div className={'card ' + (p.className ?? '')} style={p.style}>
      {p.titulo !== undefined && (
        <div className="cardhead" style={p.altura ? { height: p.altura } : undefined}>
          <span className="cardtitle">{p.titulo}</span>
          <div style={{ flex: 1 }} />
          {p.direita}
        </div>
      )}
      {p.children}
    </div>
  )
}

export function Tag(p: { children: ReactNode; tipo?: 'accent' | 'accent-2' | 'neutral' | 'outline' }) {
  return <span data-status={typeof p.children === 'string' ? p.children : undefined} className={'tag tag-' + (p.tipo ?? 'neutral')}>{p.children}</span>
}

/** Nome exibido para a situação gravada: "Proposta" é a revisão emitida; entrega e instalação são agendadas. */
const ROTULO_STATUS: Record<string, string> = { Proposta: 'Emitida', Programada: 'Agendada', 'A programar': 'A agendar' }
export const rotuloStatus = (s: string) => ROTULO_STATUS[s] ?? s

/** Selo de situação: a cor segue o valor gravado, o texto segue o rótulo. */
export function StatusTag(p: { status: string }) {
  return <span data-status={p.status} className="tag tag-neutral">{rotuloStatus(p.status)}</span>
}

export interface ItemMenu { rotulo: string; onClick: () => void }

/** Ações secundárias recolhidas num menu, para deixar um botão principal por vez. */
export function MaisAcoes(p: { itens: (ItemMenu | false | null | undefined)[]; alinhar?: 'esquerda' | 'direita'; disabled?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const itens = p.itens.filter((x): x is ItemMenu => !!x)
  useEffect(() => {
    if (!aberto) return
    ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setAberto(false); ref.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus() }
    }
    document.addEventListener('mousedown', fora)
    ref.current?.addEventListener('keydown', tecla)
    const no = ref.current
    return () => { document.removeEventListener('mousedown', fora); no?.removeEventListener('keydown', tecla) }
  }, [aberto])
  if (!itens.length) return null
  return <div className="more-actions" ref={ref}>
    <button className="btn btn-secondary" aria-haspopup="menu" aria-expanded={aberto} disabled={p.disabled} onClick={() => setAberto(v => !v)}>Mais ações<span aria-hidden="true"> ▾</span></button>
    {aberto && <div role="menu" className={'more-actions-menu' + (p.alinhar === 'esquerda' ? ' left' : '')}>
      {itens.map(i => <button key={i.rotulo} role="menuitem" className="btn btn-ghost" onClick={() => { setAberto(false); i.onClick() }}>{i.rotulo}</button>)}
    </div>}
  </div>
}

export function Seg<T extends string>(p: {
  opcoes: { id: T; label: string }[]
  valor: T
  onPick: (v: T) => void
  style?: CSSProperties
  padding?: string
}) {
  const grupo = useId()
  return (
    <div className="seg" style={p.style}>
      {p.opcoes.map(o => (
        <label
          key={o.id}
          className={'seg-opt' + (p.valor === o.id ? ' on' : '')}
          style={{ padding: p.padding ?? '3px 9px', fontSize: 13 }}
        >
          <input type="radio" name={grupo} onChange={() => p.onPick(o.id)} checked={p.valor === o.id} />
          {o.label}
        </label>
      ))}
    </div>
  )
}

export function Barra(p: { pct: number; largura?: number | string; altura?: number; cor?: string }) {
  return (
    <div className="barra" style={{ width: p.largura, height: p.altura ?? 5 }}>
      <div
        style={{
          width: Math.max(0, Math.min(100, p.pct)) + '%',
          height: p.altura ?? 5,
          background: p.cor ?? 'var(--color-accent)'
        }}
      />
    </div>
  )
}

/**
 * Select com "+ adicionar" como última opção: escolhe-la abre um campo inline
 * com ok/✕; Enter confirma, Esc cancela. O valor entra na lista compartilhada
 * e já fica selecionado.
 */
export function SelectComAdd(p: {
  valor: string
  opcoes: { id: string; label: string }[]
  onChange: (v: string) => void
  onAdicionar: (v: string) => Promise<void> | void
  rotuloAdd: string
  placeholder: string
  maiuscula?: boolean
  style?: CSSProperties
}) {
  const campo = useContext(ContextoCampo)
  const permiteAdicionar = useApp().pode('config')
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (aberto) ref.current?.focus() }, [aberto])

  const confirmar = async () => {
    const v = p.maiuscula ? texto.trim().toUpperCase() : texto.trim()
    if (!v) return
    await p.onAdicionar(v)
    p.onChange(v)
    setTexto('')
    setAberto(false)
  }

  if (aberto && permiteAdicionar) {
    return (
      <div style={{ display: 'flex', gap: 5 }}>
        <input
          ref={ref} className="input" style={p.style} placeholder={p.placeholder}
          value={texto} onChange={e => setTexto(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); void confirmar() }
            if (e.key === 'Escape') { setTexto(''); setAberto(false) }
          }}
        />
        <button className="btn btn-primary" style={{ ...p.style, padding: '2px 9px' }} onClick={() => void confirmar()}>ok</button>
        <button className="btn btn-secondary" style={{ ...p.style, padding: '2px 8px' }} onClick={() => { setTexto(''); setAberto(false) }}>✕</button>
      </div>
    )
  }

  // Um valor fora da lista faria o navegador exibir a primeira opção como se
  // estivesse escolhida, escondendo o estado real. Acontece quando o item foi
  // removido da lista em Configurações, ou quando o campo ainda está vazio.
  // A opção avulsa mantém o campo honesto e preserva o valor já gravado.
  const naLista = p.opcoes.some(o => o.id === p.valor)

  return (
    <select
      id={campo?.id} aria-label={campo?.label}
      className="input" style={p.style} value={p.valor}
      onChange={e => { if (e.target.value === '__new') setAberto(true); else p.onChange(e.target.value) }}
    >
      {!naLista && (
        <option value={p.valor}>{p.valor ? p.valor : '— escolher —'}</option>
      )}
      {p.opcoes.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      {permiteAdicionar && <option value="__new">{p.rotuloAdd}</option>}
    </select>
  )
}

/** Botão de excluir com confirmação em dois cliques no próprio rótulo. */
export function BotaoExcluir(p: { onConfirma: () => void; titulo?: string; rotulo?: string; style?: CSSProperties }) {
  const [armado, setArmado] = useState(false)
  useEffect(() => {
    if (!armado) return
    const t = setTimeout(() => setArmado(false), 3000)
    return () => clearTimeout(t)
  }, [armado])
  return (
    <button
      className="btn btn-ghost"
      title={p.titulo}
      style={{ fontSize: 13, padding: '1px 5px', color: armado ? 'var(--color-accent-800)' : 'inherit', ...p.style }}
      onClick={e => {
        e.stopPropagation()
        if (armado) { setArmado(false); p.onConfirma() } else setArmado(true)
      }}
    >
      {armado ? 'Confirmar?' : p.rotulo ?? 'excluir'}
    </button>
  )
}

/** Estrutura padrão dos cadastros: lista à esquerda, ficha à direita. */
export function ListaFicha(p: {
  galeria?: boolean
  navegacao?: boolean
  selecionado?: string
  cad?: { erros: string[]; pendente: boolean; protegido: boolean; descartar: () => void; duplicar: () => void;
    recuperaveis: { id: string }[]; recuperar: (id: string) => void }

  largura?: number
  filtro: string
  onFiltro: (v: string) => void
  placeholder: string
  resumo: string
  rotuloNovo: string
  onNovo: () => void
  lista: ReactNode
  ficha: ReactNode
}) {
  const paginas = p.navegacao !== false
  const [fichaAberta, setFichaAberta] = useState(!paginas || !!p.selecionado)
  useEffect(() => { if(p.selecionado) setFichaAberta(true) }, [p.selecionado])
  return (
    <div className={'lista-ficha'+(paginas?' catalog-mode':'')} style={{
      display: 'grid',
      gridTemplateColumns: `${p.largura ?? 392}px minmax(0,1fr)`,
      gap: 14, alignItems: 'start'
    }}>
      {(!paginas || !fichaAberta) && <div className={p.galeria?'catalog-list':'card'}>
        <div style={{
          display: 'flex', alignItems: 'center', minHeight: 48, padding: '6px 10px',
          background: 'var(--color-surface)', borderBottom: '1px solid var(--color-divider)'
        }}>
          <input
            className="input" style={{ minHeight: 24, padding: '2px 6px', fontSize: 13 }}
            aria-label={p.placeholder} placeholder={p.placeholder} value={p.filtro} onChange={e => p.onFiltro(e.target.value)}
          />
        </div>
        <div className={p.galeria?'catalog-gallery':undefined} onClick={e=>{if(paginas&&(e.target as HTMLElement).closest('button,[role=button]'))setFichaAberta(true)}} style={paginas?undefined:{ maxHeight: 'calc(100vh - 214px)', overflowY: 'auto' }}>{p.lista}</div>
        <div style={{
          display: 'flex', alignItems: 'center', minHeight: 48, padding: '6px 10px',
          background: 'var(--color-surface)', borderTop: '1px solid var(--color-divider)'
        }}>
          <span style={{ fontSize: 12, letterSpacing: '.01em', color: muted45 }}>{p.resumo}</span>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-secondary"
            style={{ minHeight: 22, padding: '1px 9px', fontSize: 13, background: 'var(--color-bg)' }}
            onClick={()=>{p.onNovo();setFichaAberta(true)}}
          >{p.rotuloNovo}</button>
        </div>
      </div>}
      {(!paginas || fichaAberta) && <div className="catalog-detail" style={{ minWidth: 0 }}>
        {paginas&&<button className="btn btn-ghost back-button" onClick={()=>setFichaAberta(false)}>{p.galeria?'← Catálogo de produtos':'← Voltar à lista'}</button>}
        {p.cad && <div className="draftbar">
          <span role="status">{!p.cad.protegido ? 'Armazenamento local indisponível. Salve antes de sair.' : p.cad.pendente ? 'Alterações pendentes · cópia local protegida' : 'Dados salvos no servidor'}</span>
          <div style={{ flex: 1 }} />
          {!!p.cad.recuperaveis.length && <select className="input" aria-label="Recuperar rascunho de cadastro" value="" style={{ maxWidth: 185 }} onChange={e => p.cad?.recuperar(e.target.value)}>
            <option value="">Recuperar ({p.cad.recuperaveis.length})</option>
            {p.cad.recuperaveis.map(x => <option key={x.id} value={x.id}>{(x as { cod?: string; nome?: string }).cod || (x as { nome?: string }).nome || 'Novo registro'}</option>)}
          </select>}
          <button className="btn btn-secondary" onClick={p.cad.duplicar}>Duplicar</button>
          {p.cad.pendente && <BotaoExcluir rotulo="Descartar" titulo="Descartar alterações desta ficha" onConfirma={p.cad.descartar} />}
        </div>}
        {!!p.cad?.erros.length && <div className="notice warning" style={{ marginBottom: 10 }}>{p.cad.erros.map(e => <div key={e}>{e}</div>)}</div>}
        {p.ficha}
      </div>}
    </div>
  )
}

export function FichaHead(p: { titulo: string; children?: ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 9, minHeight: 48, padding: '6px 12px',
      background: 'var(--color-surface)', borderBottom: '1px solid var(--color-divider)'
    }}>
      <span className="cardtitle">{p.titulo}</span>
      <div style={{ flex: 1 }} />
      {p.children}
    </div>
  )
}

export function Secao(p: { children: ReactNode; topo?: boolean }) {
  return <div className="secao" style={{ marginTop: p.topo ? 0 : 3 }}>{p.children}</div>
}

const ContextoCampo = createContext<{ id: string; label: string } | null>(null)

export function Campo(p: {
  label: string
  span?: number
  children: ReactNode
  nota?: string
  erro?: string
}) {
  const id = useId()
  return (
    <div className="field" style={p.span ? { gridColumn: `span ${p.span}` } : undefined}>
      <label htmlFor={id}>{p.label}</label>
      <ContextoCampo.Provider value={{ id, label: p.label }}>
        {Children.map(p.children, filho => isValidElement(filho) && typeof filho.type === 'string' && ['input', 'select', 'textarea'].includes(filho.type)
          ? cloneElement(filho as React.ReactElement<any>, { id, 'aria-label': p.label, 'aria-invalid': !!p.erro, 'aria-describedby': p.nota || p.erro ? id + '-nota' : undefined }) : filho)}
      </ContextoCampo.Provider>
      {p.erro && <div id={id + '-nota'} className="field-error" role="alert">{p.erro}</div>}
      {p.nota && <div id={id + '-nota'} style={{ fontSize: 12, color: muted50, paddingTop: 3 }}>{p.nota}</div>}
    </div>
  )
}

/** Input de texto/número da ficha (28px), controlado por string para não brigar com o cursor. */
export function InputFicha(p: {
  valor: string | number
  onChange: (v: string) => void
  numero?: boolean
  direita?: boolean
  placeholder?: string
  style?: CSSProperties
}) {
  const campo = useContext(ContextoCampo)
  return (
    <input
      id={campo?.id} aria-label={campo?.label}
      className="input"
      type={p.numero ? 'number' : 'text'}
      style={{
        minHeight: 28, fontSize: 13,
        textAlign: p.direita || p.numero ? 'right' : 'left',
        ...p.style
      }}
      placeholder={p.placeholder}
      value={p.valor}
      onChange={e => p.onChange(e.target.value)}
    />
  )
}

export function KpiFaixa(p: { colunas: number; itens: { label: string; valor: string; sub: string }[] }) {
  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: `repeat(${p.colunas},1fr)` }}>
      {p.itens.map((m, i) => (
        <div key={i} style={{ padding: '10px 12px 9px', borderLeft: divInterna }}>
          <div className="trunc" style={{ fontSize: 11, letterSpacing: '.02em', color: muted45 }}>{m.label}</div>
          <div className="tnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 23, lineHeight: 1.15 }}>{m.valor}</div>
          <div className="trunc" style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{m.sub}</div>
        </div>
      ))}
    </div>
  )
}

export function Vazio(p: { children: ReactNode; padding?: string }) {
  return (
    <div style={{ padding: p.padding ?? '30px 12px', textAlign: 'center', fontSize: 13, color: muted45 }}>
      {p.children}
    </div>
  )
}

/** Foco contido, Escape e retorno ao controle que abriu o diálogo. */
export function useFocoModal(onFechar: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const fechar = useRef(onFechar); fechar.current = onFechar
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    const node = ref.current
    const seletor = 'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'
    ;(node?.querySelector<HTMLElement>(seletor) ?? node)?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); fechar.current(); return }
      if (e.key !== 'Tab' || !node) return
      const itens = [...node.querySelectorAll<HTMLElement>(seletor)].filter(x => x.getClientRects().length)
      const primeiro = itens[0], ultimo = itens.at(-1)
      if (!primeiro) { e.preventDefault(); return }
      if (e.shiftKey && (document.activeElement === primeiro || !node.contains(document.activeElement))) { e.preventDefault(); ultimo?.focus() }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus() }
    }
    node?.addEventListener('keydown', tecla)
    return () => { node?.removeEventListener('keydown', tecla); anterior?.focus() }
  }, [])
  return ref
}
export function Modal(p: { titulo: string; onFechar: () => void; children: ReactNode; largura?: number }) {
  usePendenciaAtualizacao(`janela “${p.titulo}” aberta`,true)
  const ref = useFocoModal(p.onFechar)
  const id = useId()
  return <div className="modal-backdrop"><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} className="modal-panel" style={{ maxWidth: p.largura ?? 720 }}>
    <div className="modal-head"><h2 id={id}>{p.titulo}</h2><button className="btn btn-ghost" aria-label="Fechar diálogo" onClick={p.onFechar}>×</button></div>
    <div className="modal-body">{p.children}</div>
  </div></div>
}
