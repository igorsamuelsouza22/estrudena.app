import { useEffect, useMemo, useState } from 'react'
import { chamar, ponte } from '../api'
import { fn, hoje, num } from '../format'
import { useAcoes } from '../Shell'
import { SEP_VAZIA, useApp } from '../store'
import { Barra, Tag, Vazio, muted45, tagDeStatus } from '../ui'
import type { Separacao as Sep } from '../shared/types'

export function Separacao() {
  const app = useApp()
  const { db, motor } = app
  const [filtro, setFiltro] = useState('')
  const [rascunho, setRascunho] = useState<Sep | null>(null)

  const pedidos = useMemo(() => {
    const t = filtro.trim().toLowerCase()
    const lista = db.orcamentos.filter(o => {
      if (!o.itens.length) return false
      if (!t) return true
      const cli = db.clientes.find(c => c.id === o.clienteId)?.nome ?? ''
      return [o.numero, cli, o.obra].join(' ').toLowerCase().includes(t)
    })
    // Pendentes primeiro.
    const peso = (id: string) => {
      const s = db.separacoes[id]?.status ?? 'Pendente'
      return s === 'Pendente' ? 0 : s === 'Em separação' ? 1 : 2
    }
    return [...lista].sort((a, b) => peso(a.id) - peso(b.id))
  }, [db.orcamentos, db.clientes, db.separacoes, filtro])

  const o = db.orcamentos.find(x => x.id === app.sepId) ?? pedidos[0]
  const salva = o ? (db.separacoes[o.id] ?? SEP_VAZIA) : SEP_VAZIA
  const sep = rascunho ?? salva

  // Trocar de pedido descarta o rascunho local.
  useEffect(() => { setRascunho(null) }, [o?.id])

  const c = useMemo(() => (o ? motor.calc(o) : null), [o, motor])

  const gravarSep = async (fn2: (s: Sep) => void, msg: string) => {
    if (!o) return
    const novo = structuredClone(sep)
    fn2(novo)
    setRascunho(novo)
    await app.gravar(() => chamar(ponte().salvarSeparacao(o.id, novo)), msg)
    setRascunho(null)
  }

  // Ferragens: explode os kits de todas as tipologias e soma por acessório.
  const ferragens = useMemo(() => {
    if (!c) return []
    const soma = new Map<string, number>()
    for (const r of c.rows) {
      const kit = db.kits.find(k => k.id === r.m?.kitId)
      const pecas = [...(kit?.itens ?? []), ...(r.m?.aces ?? [])]
      for (const it of pecas) soma.set(it.acesId, (soma.get(it.acesId) ?? 0) + it.qtd * r.qtd)
    }
    return [...soma.entries()]
      .map(([id, qtd]) => ({ a: db.acessorios.find(x => x.id === id), qtd }))
      .filter(x => x.a)
      .sort((x, y) => (x.a!.grupo + x.a!.cod).localeCompare(y.a!.grupo + y.a!.cod))
  }, [c, db.kits, db.acessorios])

  useAcoes(
    o ? (
      <button
        className="btn btn-primary"
        onClick={() => app.imprimir({ orcId: o.id, proposta: false, separacao: true })}
      >Salvar pedido em PDF</button>
    ) : null,
    [o?.id]
  )

  if (!o || !c) return <Vazio padding="60px 12px">Nenhum pedido com itens na fábrica.</Vazio>

  const linhas = c.rows.map(r => {
    const feito = sep.conf[String(r.i)] ?? 0
    const falta = Math.max(0, r.qtd - feito)
    return {
      r, feito, falta,
      pct: r.qtd ? Math.min(100, feito / r.qtd * 100) : 0,
      estado: feito <= 0 ? 'Pendente' : falta > 0 ? 'Parcial' : 'Separado'
    }
  })

  const pedTot = linhas.reduce((a, l) => a + l.r.qtd, 0)
  const sepTot = linhas.reduce((a, l) => a + Math.min(l.feito, l.r.qtd), 0)
  const prog = pedTot ? sepTot / pedTot * 100 : 0
  const nOk = linhas.filter(l => l.estado === 'Separado').length
  const nParcial = linhas.filter(l => l.estado === 'Parcial').length
  const nPend = linhas.filter(l => l.estado === 'Pendente').length
  const m2Sep = linhas.reduce((a, l) => a + (l.r.qtd ? l.r.im2 * (Math.min(l.feito, l.r.qtd) / l.r.qtd) : 0), 0)
  const kgSep = linhas.reduce((a, l) => a + (l.r.qtd ? l.r.ikg * (Math.min(l.feito, l.r.qtd) / l.r.qtd) : 0), 0)
  const tudoSeparado = linhas.length > 0 && linhas.every(l => l.falta === 0)

  const resumo = [
    { label: 'Progresso', valor: fn(prog, 0) + '%', obs: `${fn(sepTot, 0)} de ${fn(pedTot, 0)} peças` },
    { label: 'Tipologias OK', valor: String(nOk), obs: `${nParcial} parciais · ${nPend} pendentes` },
    { label: 'm² separados', valor: fn(m2Sep, 2), obs: `de ${fn(c.m2, 2)} m²` },
    { label: 'kg separados', valor: fn(kgSep, 1), obs: `de ${fn(c.kg, 1)} kg` },
    { label: 'Ferragens', valor: String(ferragens.length), obs: 'itens a retirar do estoque' }
  ]

  const setQtd = (i: number, v: number, qtdMax: number) =>
    void gravarSep(s => { s.conf[String(i)] = Math.max(0, Math.min(qtdMax, v)) }, 'Conferência atualizada')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card noprint">
        <div className="cardhead" style={{ height: 34, gap: 10 }}>
          <span className="cardtitle">Pedidos na fábrica</span>
          <input
            className="input"
            style={{ maxWidth: 210, minHeight: 24, padding: '2px 7px', fontSize: 13, background: 'var(--color-bg)' }}
            placeholder="Filtrar nº, cliente ou obra"
            value={filtro} onChange={e => setFiltro(e.target.value)}
          />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: muted45, whiteSpace: 'nowrap' }}>
            pendentes primeiro · {pedidos.length} pedidos
          </span>
        </div>

        <div style={{ maxHeight: 170, overflowY: 'auto', borderBottom: '1px solid var(--color-divider)' }}>
          {pedidos.map(d => {
            const sel = d.id === o.id
            const sd = db.separacoes[d.id] ?? SEP_VAZIA
            const cli = db.clientes.find(x => x.id === d.clienteId)?.nome ?? '—'
            const total = d.itens.reduce((a, i) => a + i.qtd, 0)
            const feito = Object.values(sd.conf).reduce((a, v) => a + v, 0)
            return (
              <div
                key={d.id} onClick={() => app.setSepId(d.id)} className="linha"
                style={{
                  height: 46, padding: '0 11px 0 0', gap: 12,
                  background: sel ? 'color-mix(in srgb, var(--color-text) 5%, transparent)' : undefined
                }}
              >
                <span style={{ width: 3, height: 46, flex: 'none', background: sel ? 'var(--color-accent)' : 'transparent' }} />
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, width: 146, flex: 'none', whiteSpace: 'nowrap' }}>
                  {d.numero}
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: muted45, paddingLeft: 5 }}>{d.rev}</span>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="trunc" style={{ fontSize: 13, lineHeight: 1.2 }}>{d.obra}</div>
                  <div className="trunc" style={{ fontSize: 12, color: muted45 }}>{cli} · {fn(total, 0)} peças</div>
                </div>
                <div style={{ width: 84, flex: 'none' }}>
                  <Barra pct={total ? feito / total * 100 : 0} />
                </div>
                <Tag tipo={sd.status === 'Concluída' ? 'accent' : sd.status === 'Em separação' ? 'accent-2' : 'neutral'}>{sd.status}</Tag>
                <Tag tipo={tagDeStatus(d.status)}>{d.status}</Tag>
              </div>
            )
          })}
        </div>

        {/* Ciclo de vida */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center', padding: '7px 11px',
          background: 'var(--color-surface)', borderBottom: '1px solid var(--color-divider)'
        }}>
          <Tag tipo={sep.status === 'Concluída' ? 'accent' : sep.status === 'Em separação' ? 'accent-2' : 'neutral'}>{sep.status}</Tag>
          <div style={{ flex: 1, minWidth: 20 }} />
          {sep.status === 'Pendente' && (
            <button className="btn btn-primary" style={{ minHeight: 26, padding: '3px 11px', fontSize: 13 }}
                    onClick={() => void gravarSep(s => { s.status = 'Em separação'; s.iniciado = hoje() }, 'Separação iniciada')}>
              Iniciar separação
            </button>
          )}
          {sep.status === 'Em separação' && !tudoSeparado && (
            <button className="btn btn-secondary" style={{ minHeight: 26, padding: '3px 11px', fontSize: 13, background: 'var(--color-bg)' }}
                    onClick={() => void gravarSep(s => {
                      for (const l of linhas) s.conf[String(l.r.i)] = l.r.qtd
                    }, 'Tudo marcado como separado')}>
              Marcar tudo separado
            </button>
          )}
          {sep.status === 'Em separação' && (
            <button className="btn btn-primary" style={{ minHeight: 26, padding: '3px 11px', fontSize: 13 }}
                    disabled={!tudoSeparado}
                    title={tudoSeparado ? '' : 'Só habilita quando tudo estiver separado'}
                    onClick={() => void gravarSep(s => { s.status = 'Concluída'; s.concluido = hoje() }, 'Separação concluída')}>
              Concluir separação
            </button>
          )}
          {sep.status === 'Concluída' && (
            <button className="btn btn-secondary" style={{ minHeight: 26, padding: '3px 11px', fontSize: 13, background: 'var(--color-bg)' }}
                    onClick={() => void gravarSep(s => { s.status = 'Em separação'; s.concluido = '' }, 'Separação reaberta')}>
              Reabrir
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }}>
          {resumo.map(k => (
            <div key={k.label} style={{ padding: '9px 12px 8px', borderLeft: '1px solid color-mix(in srgb, var(--color-text) 9%, transparent)' }}>
              <div className="trunc" style={{ fontSize: 11, letterSpacing: '.02em', color: muted45 }}>{k.label}</div>
              <div className="tnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 22, lineHeight: 1.15 }}>{k.valor}</div>
              <div className="trunc" style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{k.obs}</div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--color-divider)' }}>
          <Barra pct={prog} altura={6} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 11px', borderTop: '1px solid var(--color-divider)' }}>
          <div className="field" style={{ width: 210 }}>
            <label>Separado por</label>
            <input
              className="input" style={{ minHeight: 26, padding: '2px 7px', fontSize: 13 }}
              placeholder="Nome do conferente" value={sep.responsavel}
              onChange={e => setRascunho({ ...sep, responsavel: e.target.value })}
              onBlur={e => void gravarSep(s => { s.responsavel = e.target.value }, 'Conferente gravado')}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Observações da produção</label>
            <input
              className="input" style={{ minHeight: 26, padding: '2px 7px', fontSize: 13 }}
              value={sep.obs}
              onChange={e => setRascunho({ ...sep, obs: e.target.value })}
              onBlur={e => void gravarSep(s => { s.obs = e.target.value }, 'Observações gravadas')}
            />
          </div>
          <button
            className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 7px', alignSelf: 'flex-end', marginBottom: 1 }}
            onClick={() => void gravarSep(s => { s.conf = {} }, 'Conferência zerada')}
          >zerar conferência</button>
        </div>
      </div>

      {/* Conferência das tipologias */}
      <div className="card noprint">
        <div className="cardhead">
          <span className="cardtitle">Conferência das tipologias</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: muted45 }}>{nOk} de {linhas.length} tipologias conferidas</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 1020, fontSize: 13 }}>
            <thead><tr>
              <th style={{ paddingLeft: 11, width: 24 }}>#</th>
              <th style={{ width: 66 }}>Cód</th>
              <th>Descrição / local</th>
              <th style={{ width: 96, textAlign: 'right' }}>Corte L × A</th>
              <th style={{ width: 58, textAlign: 'right' }}>Pedido</th>
              <th style={{ width: 150 }}>Separado</th>
              <th style={{ width: 52, textAlign: 'right' }}>Falta</th>
              <th style={{ width: 88 }}>Andamento</th>
              <th style={{ width: 92 }}>Situação</th>
              <th style={{ paddingRight: 11, width: 96, textAlign: 'right' }}>m² / kg</th>
            </tr></thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.r.i} style={{ background: l.estado === 'Separado' ? 'color-mix(in srgb, #202124 7%, transparent)' : undefined }}>
                  <td className="tnum" style={{ paddingLeft: 11, color: 'color-mix(in srgb, var(--color-text) 38%, transparent)', fontSize: 12 }}>{l.r.i + 1}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', fontSize: 14, whiteSpace: 'nowrap' }}>{l.r.m?.cod ?? '—'}</td>
                  <td style={{ maxWidth: 280 }}>
                    <div className="trunc" style={{ fontSize: 13, lineHeight: 1.25 }}>{l.r.it.desc ?? l.r.m?.desc ?? ''}</div>
                    <div className="trunc" style={{ fontSize: 12, color: muted45 }}>{l.r.it.local}</div>
                  </td>
                  <td className="tnum" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 14, whiteSpace: 'nowrap' }}>
                    {fn(l.r.L, 0)} × {fn(l.r.H, 0)}
                  </td>
                  <td className="tnum" style={{ textAlign: 'right' }}>{fn(l.r.qtd, 0)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button className="btn btn-secondary" title="Menos um"
                              style={{ minHeight: 22, width: 22, padding: 0, fontSize: 14, lineHeight: 1 }}
                              onClick={() => setQtd(l.r.i, l.feito - 1, l.r.qtd)}>−</button>
                      <input
                        className="input tnum" type="number"
                        style={{ width: 52, minHeight: 22, padding: '1px 5px', fontSize: 13, textAlign: 'right' }}
                        value={l.feito}
                        onChange={e => setQtd(l.r.i, num(e.target.value), l.r.qtd)}
                      />
                      <button className="btn btn-secondary" title="Mais um"
                              style={{ minHeight: 22, width: 22, padding: 0, fontSize: 14, lineHeight: 1 }}
                              onClick={() => setQtd(l.r.i, l.feito + 1, l.r.qtd)}>+</button>
                      <button className="btn btn-ghost" title="Marcar quantidade total"
                              style={{ minHeight: 22, padding: '1px 5px', fontSize: 12 }}
                              onClick={() => setQtd(l.r.i, l.r.qtd, l.r.qtd)}>tudo</button>
                    </div>
                  </td>
                  <td className="tnum" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{fn(l.falta, 0)}</td>
                  <td><Barra pct={l.pct} /></td>
                  <td><Tag tipo={l.estado === 'Separado' ? 'accent' : l.estado === 'Parcial' ? 'outline' : 'neutral'}>{l.estado}</Tag></td>
                  <td className="tnum" style={{ paddingRight: 11, textAlign: 'right', fontSize: 12, color: 'color-mix(in srgb, var(--color-text) 55%, transparent)', whiteSpace: 'nowrap' }}>
                    {fn(l.r.im2, 2)} / {fn(l.r.ikg, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ferragens */}
      <div className="card noprint">
        <div className="cardhead">
          <span className="cardtitle">Ferragens e vedação a retirar do estoque</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: muted45 }}>somatório dos kits de todas as tipologias</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 660, fontSize: 13 }}>
            <thead><tr>
              <th style={{ paddingLeft: 11 }}>Cód</th><th>Acessório</th><th>Grupo</th><th>Fornecedor</th>
              <th style={{ paddingRight: 11, textAlign: 'right' }}>Quantidade</th>
            </tr></thead>
            <tbody>
              {ferragens.map(f => (
                <tr key={f.a!.id}>
                  <td style={{ paddingLeft: 11, fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap' }}>{f.a!.cod}</td>
                  <td style={{ fontSize: 13 }}>{f.a!.nome}</td>
                  <td style={{ fontSize: 12, color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>{f.a!.grupo}</td>
                  <td style={{ fontSize: 12, color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>{f.a!.fornecedor}</td>
                  <td className="tnum" style={{ paddingRight: 11, textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 15, whiteSpace: 'nowrap' }}>
                    {fn(f.qtd, 1)} {f.a!.unidade}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ferragens.length && (
          <Vazio padding="20px 12px">Nenhum kit de ferragem vinculado às tipologias deste pedido.</Vazio>
        )}
      </div>
    </div>
  )
}
