import { useMemo } from 'react'
import { fk, fm, fn, pc } from '../format'
import { useApp } from '../store'
import { Barra, Card, KpiFaixa, Tag, muted45, tagDeStatus } from '../ui'

export function Dashboard() {
  const app = useApp()
  const { db, motor, verCustos } = app

  const dados = useMemo(() => {
    const calcs = new Map(db.orcamentos.map(o => [o.id, motor.calc(o)]))
    const aprov = db.orcamentos.filter(o => o.status === 'Aprovado')
    const abertos = db.orcamentos.filter(o => o.status === 'Rascunho' || o.status === 'Em análise')
    const vendaAprov = aprov.reduce((a, o) => a + (calcs.get(o.id)?.total ?? 0), 0)
    const margemAprov = aprov.reduce((a, o) => a + (calcs.get(o.id)?.margem ?? 0), 0)
    const kgAprov = aprov.reduce((a, o) => a + (calcs.get(o.id)?.kg ?? 0), 0)
    const m2Aprov = aprov.reduce((a, o) => a + (calcs.get(o.id)?.m2 ?? 0), 0)

    // Margem média por tipo de material, ponderada pela venda.
    const porTipo = new Map<string, { venda: number; margem: number }>()
    for (const o of db.orcamentos) {
      const c = calcs.get(o.id)
      if (!c) continue
      for (const r of c.rows) {
        const t = r.m?.tipo ?? 'DIVERSOS'
        const acc = porTipo.get(t) ?? { venda: 0, margem: 0 }
        acc.venda += r.venda
        acc.margem += r.venda - r.cm
        porTipo.set(t, acc)
      }
    }
    const margemTipo = [...porTipo.entries()]
      .map(([tipo, v]) => ({ tipo, pct: v.venda ? v.margem / v.venda * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6)

    const fila = aprov.map(o => {
      const sep = app.sepDe(o.id)
      const pedido = o.itens.reduce((a, i) => a + (i.qtd || 0), 0)
      const feito = Object.values(sep.conf).reduce((a, v) => a + v, 0)
      return {
        o,
        prog: pedido ? Math.min(100, feito / pedido * 100) : 0,
        sit: sep.status
      }
    })

    return { calcs, aprov, abertos, vendaAprov, margemAprov, kgAprov, m2Aprov, margemTipo, fila }
  }, [db, motor, app])

  const metricas = [
    { label: 'Carteira aprovada', valor: fk(dados.vendaAprov), sub: `${dados.aprov.length} propostas fechadas` },
    { label: 'Margem da carteira', valor: pc(dados.vendaAprov ? dados.margemAprov / dados.vendaAprov * 100 : 0), sub: `${fk(dados.margemAprov)} de saldo` },
    { label: 'Em negociação', valor: fk(dados.abertos.reduce((a, o) => a + (dados.calcs.get(o.id)?.total ?? 0), 0)), sub: `${dados.abertos.length} propostas abertas` },
    { label: 'Venda por kg', valor: fm(dados.kgAprov ? dados.vendaAprov / dados.kgAprov : 0), sub: `${fn(dados.kgAprov, 0)} kg confirmados` },
    { label: 'm² aprovados', valor: fn(dados.m2Aprov, 0), sub: 'esquadrias e vidro' },
    { label: 'Taxa de fechamento', valor: pc(db.orcamentos.length ? dados.aprov.length / db.orcamentos.length * 100 : 0), sub: `${dados.aprov.length} de ${db.orcamentos.length}` }
  ].filter(m => verCustos || !['Carteira aprovada', 'Margem da carteira', 'Em negociação', 'Venda por kg'].includes(m.label))

  const recentes = db.orcamentos.slice(0, 6)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <KpiFaixa colunas={metricas.length} itens={metricas} />

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0,1.75fr) minmax(0,1fr)',
        gap: 14, alignItems: 'start'
      }}>
        <Card
          titulo="Carteira de propostas"
          direita={
            <a href="#" style={{ fontSize: 12, letterSpacing: '.02em' }}
               onClick={e => { e.preventDefault(); app.irPara('lista') }}>abrir lista</a>
          }
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 560, fontSize: 13 }}>
              <thead><tr>
                <th style={{ paddingLeft: 11 }}>Nº</th>
                <th>Cliente / obra</th>
                <th>Vendedor</th>
                <th style={{ textAlign: 'right' }}>Itens</th>
                {verCustos && <th style={{ textAlign: 'right' }}>Venda</th>}
                {verCustos && <th style={{ textAlign: 'right' }}>Margem</th>}
                <th style={{ paddingRight: 11 }}>Situação</th>
              </tr></thead>
              <tbody>
                {recentes.map(o => {
                  const c = dados.calcs.get(o.id)!
                  const cliente = db.clientes.find(x => x.id === o.clienteId)?.nome ?? '—'
                  return (
                    <tr
                      key={o.id} style={{ cursor: 'pointer' }}
                      onClick={() => {
                        // Produção não abre orçamento — vai direto para a separação.
                        if (app.perfil === 'Produção') { app.setSepId(o.id); app.irPara('separacao') }
                        else app.abrirOrc(o)
                      }}
                    >
                      <td style={{ paddingLeft: 11, fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap' }}>{o.numero}</td>
                      <td style={{ maxWidth: 240 }}>
                        <div className="trunc">{cliente}</div>
                        <div className="trunc" style={{ fontSize: 12, color: muted45 }}>{o.obra}</div>
                      </td>
                      <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{o.vendedor}</td>
                      <td className="tnum" style={{ textAlign: 'right' }}>{o.itens.length}</td>
                      {verCustos && <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm(c.total)}</td>}
                      {verCustos && <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{pc(c.margemPct)}</td>}
                      <td style={{ paddingRight: 11 }}><Tag tipo={tagDeStatus(o.status)}>{o.status}</Tag></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {verCustos && (
            <Card titulo="Margem por material">
              <table className="table" style={{ fontSize: 13 }}>
                <tbody>
                  {dados.margemTipo.map(t => (
                    <tr key={t.tipo}>
                      <td style={{ paddingLeft: 11, fontFamily: 'var(--font-heading)', letterSpacing: '.01em', whiteSpace: 'nowrap' }}>{t.tipo}</td>
                      <td style={{ width: 96 }}><Barra pct={t.pct} /></td>
                      <td className="tnum" style={{ paddingRight: 11, textAlign: 'right', width: 52 }}>{pc(t.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <Card titulo="Fila de produção">
            <table className="table" style={{ fontSize: 13 }}>
              <tbody>
                {dados.fila.map(f => (
                  <tr key={f.o.id} style={{ cursor: 'pointer' }}
                      onClick={() => { app.setSepId(f.o.id); app.irPara('separacao') }}>
                    <td style={{ paddingLeft: 11, fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap' }}>{f.o.numero}</td>
                    <td className="trunc" style={{ maxWidth: 150, fontSize: 13, color: 'color-mix(in srgb, var(--color-text) 60%, transparent)' }}>{f.o.obra}</td>
                    <td style={{ width: 66 }}><Barra pct={f.prog} /></td>
                    <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontSize: 13 }}>{fn(f.prog, 0)}%</td>
                    <td style={{ paddingRight: 11, textAlign: 'right', fontSize: 12, whiteSpace: 'nowrap', color: 'var(--color-accent-700)' }}>{f.sit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  )
}
