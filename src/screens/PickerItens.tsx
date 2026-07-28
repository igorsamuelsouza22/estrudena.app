import { useMemo, useState } from 'react'
import { fm, fn, num } from '../format'
import { useApp } from '../store'
import { Seg, Vazio, muted45 } from '../ui'
import type { OrcItem } from '../shared/types'

/**
 * Modal "Inserir item no orçamento". Permanece aberto para inserções em série;
 * Enter na busca insere o primeiro da lista.
 */
export function PickerItens(p: {
  onFechar: () => void
  onInserir: (matId: string, qtd: number) => void
  jaNaGrade: OrcItem[]
}) {
  const app = useApp()
  const { db, motor } = app
  const [modo, setModo] = useState<'itens' | 'kits'>('itens')
  const [busca, setBusca] = useState('')
  const [qtd, setQtd] = useState(1)
  const [tipo, setTipo] = useState('__todos')

  const contagem = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of p.jaNaGrade) m.set(it.matId, (m.get(it.matId) ?? 0) + 1)
    return m
  }, [p.jaNaGrade])

  const termo = busca.trim().toLowerCase()

  const lista = useMemo(() => db.materiais.filter(m => {
    if (tipo !== '__todos' && m.tipo !== tipo) return false
    if (!termo) return true
    return [m.cod, m.desc, m.tipo, m.serie].join(' ').toLowerCase().includes(termo)
  }), [db.materiais, tipo, termo])

  const kits = useMemo(() => db.kitsVenda.filter(k => {
    if (!termo) return true
    return [k.cod, k.nome, k.descricao].join(' ').toLowerCase().includes(termo)
  }), [db.kitsVenda, termo])

  const inserirKit = (kitId: string) => {
    const k = db.kitsVenda.find(x => x.id === kitId)
    if (!k) return
    for (const it of k.itens) p.onInserir(it.matId, it.qtd * qtd)
    app.say(`${k.cod} lançado na grade`)
  }

  const primeiro = () => {
    if (modo === 'itens' && lista[0]) { p.onInserir(lista[0].id, qtd); app.say(`${lista[0].cod} inserido`) }
    if (modo === 'kits' && kits[0]) inserirKit(kits[0].id)
  }

  return (
    <div className="dialog-backdrop noprint" style={{ zIndex: 60 }} onMouseDown={e => { if (e.target === e.currentTarget) p.onFechar() }}>
      <div className="dialog" style={{
        width: 'min(920px, 94vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', animation: 'eIn .16s ease'
      }}>
        <div style={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 12, height: 56,
          padding: '0 20px', borderBottom: '1px solid var(--color-divider)'
        }}>
          <span style={{ fontSize: 16, color: '#202124' }}>Inserir item no orçamento</span>
          <div style={{ flex: 1 }} />
          <span className="tnum" style={{ fontSize: 12, color: '#5f6368' }}>
            {modo === 'itens' ? `${lista.length} de ${db.materiais.length} itens` : `${kits.length} kits de venda`}
          </span>
          <button className="btn btn-ghost" onClick={p.onFechar}>Fechar</button>
        </div>

        <div style={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px',
          background: 'var(--color-surface)', borderBottom: '1px solid var(--color-divider)'
        }}>
          <Seg
            style={{ background: 'var(--color-bg)' }} padding="4px 11px"
            opcoes={[{ id: 'itens', label: 'Itens do catálogo' }, { id: 'kits', label: 'Kits de venda' }]}
            valor={modo} onPick={setModo}
          />
          <input
            className="input" autoFocus
            style={{ flex: 1, minHeight: 30, fontSize: 14, background: 'var(--color-bg)' }}
            placeholder="Buscar código, descrição ou série — Enter insere o primeiro da lista"
            value={busca} onChange={e => setBusca(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); primeiro() } }}
          />
          <span style={{ fontSize: 12, letterSpacing: '.02em', color: muted45 }}>Qtd</span>
          <input
            className="input tnum" type="number"
            style={{ width: 66, minHeight: 30, fontSize: 14, textAlign: 'right', background: 'var(--color-bg)' }}
            value={qtd} onChange={e => setQtd(Math.max(1, num(e.target.value)))}
          />
        </div>

        {modo === 'itens' && (
          <>
            <div style={{ flex: 'none', padding: '8px 12px', borderBottom: '1px solid var(--color-divider)' }}>
              <Seg
                style={{ flexWrap: 'wrap' }}
                opcoes={[{ id: '__todos', label: 'Todos' }, ...db.tipos.map(t => ({ id: t, label: t }))]}
                valor={tipo} onPick={setTipo}
              />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <table className="table" style={{ fontSize: 13 }}>
                <thead><tr>
                  <th style={{ paddingLeft: 12 }}>Cód</th>
                  <th>Descrição</th>
                  <th>Tipo / série</th>
                  <th>Cor / kit</th>
                  <th style={{ textAlign: 'right' }}>Medida padrão</th>
                  <th style={{ textAlign: 'right' }}>Custo</th>
                  <th style={{ paddingRight: 12 }} />
                </tr></thead>
                <tbody>
                  {lista.map(m => {
                    const cor = db.cores.find(c => c.id === m.corId)
                    const kit = db.kits.find(k => k.id === m.kitId)
                    const n = contagem.get(m.id) ?? 0
                    return (
                      <tr key={m.id} style={{ cursor: 'pointer' }}
                          onClick={() => { p.onInserir(m.id, qtd); app.say(`${m.cod} inserido`) }}>
                        <td style={{ paddingLeft: 12, fontFamily: 'var(--font-heading)', fontSize: 14, whiteSpace: 'nowrap' }}>{m.cod}</td>
                        <td style={{ fontSize: 13, maxWidth: 250 }}>{m.desc}</td>
                        <td style={{ fontSize: 12, color: muted45, whiteSpace: 'nowrap' }}>{m.tipo} · {m.serie}</td>
                        <td style={{ fontSize: 12, color: muted45, whiteSpace: 'nowrap' }}>
                          {[cor?.cod, kit?.cod].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontSize: 13 }}>
                          {m.larg ?? 0} × {m.alt ?? 0}
                        </td>
                        <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm(motor.custoBase(m))}</td>
                        <td style={{ paddingRight: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--color-accent-700)', paddingRight: 7 }}>
                            {n ? `${n}× na grade` : ''}
                          </span>
                          <button className="btn btn-secondary" style={{ minHeight: 22, padding: '1px 9px', fontSize: 13 }}>inserir</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!lista.length && <Vazio padding="34px 12px">Nenhum item do catálogo bate com essa busca.</Vazio>}
            </div>
          </>
        )}

        {modo === 'kits' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <table className="table" style={{ fontSize: 13 }}>
              <thead><tr>
                <th style={{ paddingLeft: 12 }}>Cód</th>
                <th>Kit de venda</th>
                <th>Composição</th>
                <th style={{ textAlign: 'right' }}>m²</th>
                <th style={{ textAlign: 'right' }}>Venda</th>
                <th style={{ paddingRight: 12 }} />
              </tr></thead>
              <tbody>
                {kits.map(k => {
                  const r = motor.kitVendaResumo(k)
                  const composicao = k.itens
                    .map(i => `${db.materiais.find(m => m.id === i.matId)?.cod ?? '?'}×${i.qtd}`)
                    .join(' ')
                  return (
                    <tr key={k.id} style={{ cursor: 'pointer' }} onClick={() => inserirKit(k.id)}>
                      <td style={{ paddingLeft: 12, fontFamily: 'var(--font-heading)', fontSize: 14, whiteSpace: 'nowrap' }}>{k.cod}</td>
                      <td style={{ maxWidth: 230 }}>
                        <div style={{ fontSize: 13 }}>{k.nome}</div>
                        <div style={{ fontSize: 12, color: 'color-mix(in srgb, var(--color-text) 48%, transparent)' }}>{fn(r.pecas, 0)} peças</div>
                      </td>
                      <td style={{ fontSize: 12, fontFamily: 'var(--font-heading)', letterSpacing: '.01em', color: 'var(--color-accent-700)' }}>{composicao}</td>
                      <td className="tnum" style={{ textAlign: 'right' }}>{fn(r.m2, 2)}</td>
                      <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{fm(r.venda)}</td>
                      <td style={{ paddingRight: 12, textAlign: 'right' }}>
                        <button className="btn btn-secondary" style={{ minHeight: 22, padding: '1px 9px', fontSize: 13 }}>inserir kit</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!kits.length && <Vazio padding="34px 12px">Nenhum kit de venda bate com essa busca.</Vazio>}
          </div>
        )}

        <div style={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px',
          background: 'var(--color-surface)', borderTop: '1px solid var(--color-divider)'
        }}>
          <span style={{ fontSize: 12, letterSpacing: '.02em', color: muted45 }}>
            A grade continua atualizando atrás — insira vários e feche ao final
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" style={{ minHeight: 26, padding: '3px 12px', fontSize: 13 }} onClick={p.onFechar}>Concluir</button>
        </div>
      </div>
    </div>
  )
}
