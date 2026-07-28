import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'

export const muted = 'color-mix(in srgb, var(--color-text) 55%, transparent)'
export const muted45 = 'color-mix(in srgb, var(--color-text) 45%, transparent)'
export const muted50 = 'color-mix(in srgb, var(--color-text) 50%, transparent)'
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
  return <span className={'tag tag-' + (p.tipo ?? 'neutral')}>{p.children}</span>
}

export function tagDeStatus(s: string): 'accent' | 'accent-2' | 'neutral' | 'outline' {
  if (s === 'Aprovado') return 'accent'
  if (s === 'Proposta') return 'accent-2'
  if (s === 'Em análise') return 'outline'
  return 'neutral'
}

export function Seg<T extends string>(p: {
  opcoes: { id: T; label: string }[]
  valor: T
  onPick: (v: T) => void
  style?: CSSProperties
  padding?: string
}) {
  return (
    <div className="seg" style={p.style}>
      {p.opcoes.map(o => (
        <label
          key={o.id}
          className={'seg-opt' + (p.valor === o.id ? ' on' : '')}
          style={{ padding: p.padding ?? '3px 9px', fontSize: 13 }}
          onClick={() => p.onPick(o.id)}
        >
          <input type="radio" readOnly checked={p.valor === o.id} />
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

  if (aberto) {
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
      className="input" style={p.style} value={p.valor}
      onChange={e => { if (e.target.value === '__new') setAberto(true); else p.onChange(e.target.value) }}
    >
      {!naLista && (
        <option value={p.valor}>{p.valor ? p.valor : '— escolher —'}</option>
      )}
      {p.opcoes.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      <option value="__new">{p.rotuloAdd}</option>
    </select>
  )
}

/** Botão de excluir com confirmação em dois cliques no próprio rótulo. */
export function BotaoExcluir(p: { onConfirma: () => void; titulo?: string; style?: CSSProperties }) {
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
      {armado ? 'confirmar?' : 'excluir'}
    </button>
  )
}

/** Estrutura padrão dos cadastros: lista à esquerda, ficha à direita. */
export function ListaFicha(p: {
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
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `${p.largura ?? 392}px minmax(0,1fr)`,
      gap: 14, alignItems: 'start'
    }}>
      <div className="card">
        <div style={{
          display: 'flex', alignItems: 'center', height: 34, padding: '0 10px',
          background: 'var(--color-surface)', borderBottom: '1px solid var(--color-divider)'
        }}>
          <input
            className="input" style={{ minHeight: 24, padding: '2px 6px', fontSize: 13 }}
            placeholder={p.placeholder} value={p.filtro} onChange={e => p.onFiltro(e.target.value)}
          />
        </div>
        <div style={{ maxHeight: 'calc(100vh - 214px)', overflowY: 'auto' }}>{p.lista}</div>
        <div style={{
          display: 'flex', alignItems: 'center', height: 32, padding: '0 10px',
          background: 'var(--color-surface)', borderTop: '1px solid var(--color-divider)'
        }}>
          <span style={{ fontSize: 12, letterSpacing: '.01em', color: muted45 }}>{p.resumo}</span>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-secondary"
            style={{ minHeight: 22, padding: '1px 9px', fontSize: 13, background: 'var(--color-bg)' }}
            onClick={p.onNovo}
          >{p.rotuloNovo}</button>
        </div>
      </div>
      {p.ficha}
    </div>
  )
}

export function FichaHead(p: { titulo: string; children?: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, height: 34, padding: '0 12px',
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

export function Campo(p: {
  label: string
  span?: number
  children: ReactNode
  nota?: string
}) {
  return (
    <div className="field" style={p.span ? { gridColumn: `span ${p.span}` } : undefined}>
      <label>{p.label}</label>
      {p.children}
      {p.nota && <div style={{ fontSize: 12, color: muted50, paddingTop: 3 }}>{p.nota}</div>}
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
  return (
    <input
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
