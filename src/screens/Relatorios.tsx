import { useMemo } from 'react'
import { fk, fm, pc } from '../format'
import { useApp } from '../store'
import { Barra, Card, KpiFaixa, muted50 } from '../ui'

export function Relatorios() {
  const app = useApp()
  const { db, motor } = app

  const d = useMemo(() => {
    const calcs = new Map(db.orcamentos.map(o => [o.id, motor.calc(o)]))
    const tot = db.orcamentos.reduce((a, o) => a + (calcs.get(o.id)?.total ?? 0), 0)
    const totCusto = db.orcamentos.reduce((a, o) => a + (calcs.get(o.id)?.custoTotal ?? 0), 0)
    const aprov = db.orcamentos.filter(o => o.status === 'Aprovado')
    const vendaAprov = aprov.reduce((a, o) => a + (calcs.get(o.id)?.total ?? 0), 0)
    const kgAprov = aprov.reduce((a, o) => a + (calcs.get(o.id)?.kg ?? 0), 0)
    const impostoTotal = db.orcamentos.reduce((a, o) => a + (calcs.get(o.id)?.imposto ?? 0), 0)

    const porVendedor = new Map<string, { v: number; c: number; n: number }>()
    for (const o of db.orcamentos) {
      const c = calcs.get(o.id)
      if (!c) continue
      const acc = porVendedor.get(o.vendedor) ?? { v: 0, c: 0, n: 0 }
      acc.v += c.total
      acc.c += c.com1 + c.com2
      acc.n += 1
      porVendedor.set(o.vendedor, acc)
    }

    return { calcs, tot, totCusto, aprov, vendaAprov, kgAprov, impostoTotal, porVendedor }
  }, [db.orcamentos, motor])

  const cfg = db.config
  const rateio = [
    { label: 'Faturamento de material', pct: cfg.impMaterial },
    { label: 'Industrialização', pct: cfg.impIndust },
    { label: 'M.O. de instalação', pct: cfg.impMo }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <KpiFaixa colunas={5} itens={[
        { label: 'Venda em proposta', valor: fk(d.tot), sub: `${db.orcamentos.length} propostas` },
        { label: 'Custo total', valor: fk(d.totCusto), sub: 'MP, frete e imposto' },
        { label: 'Saldo geral', valor: fk(d.tot - d.totCusto), sub: `${pc(d.tot ? (d.tot - d.totCusto) / d.tot * 100 : 0)} de margem média` },
        { label: 'Venda média por kg', valor: fm(d.kgAprov ? d.vendaAprov / d.kgAprov : 0), sub: 'carteira aprovada' },
        { label: 'Fechamento', valor: pc(db.orcamentos.length ? d.aprov.length / db.orcamentos.length * 100 : 0), sub: `${d.aprov.length} de ${db.orcamentos.length}` }
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <Card titulo="Venda, custo e saldo por proposta">
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 660, fontSize: 13 }}>
              <thead><tr>
                <th style={{ paddingLeft: 11 }}>Nº</th><th>Obra</th>
                <th style={{ textAlign: 'right' }}>Venda</th>
                <th style={{ textAlign: 'right' }}>Custo</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th style={{ width: 110 }}>Margem</th>
                <th style={{ paddingRight: 11, textAlign: 'right' }} />
              </tr></thead>
              <tbody>
                {db.orcamentos.map(o => {
                  const c = d.calcs.get(o.id)!
                  return (
                    <tr key={o.id}>
                      <td style={{ paddingLeft: 11, fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap' }}>{o.numero}</td>
                      <td className="trunc" style={{ maxWidth: 190, fontSize: 13 }}>{o.obra}</td>
                      <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm(c.total)}</td>
                      <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap', color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>{fm(c.custoTotal)}</td>
                      <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm(c.margem)}</td>
                      <td><Barra pct={Math.max(2, Math.min(100, c.margemPct))} /></td>
                      <td className="tnum" style={{ paddingRight: 11, textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{pc(c.margemPct)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card titulo="Comissão por vendedor">
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 300, fontSize: 13 }}>
                <thead><tr>
                  <th style={{ paddingLeft: 11 }}>Vendedor</th>
                  <th style={{ textAlign: 'right' }}>Propostas</th>
                  <th style={{ textAlign: 'right' }}>Venda</th>
                  <th style={{ paddingRight: 11, textAlign: 'right' }}>Comissão</th>
                </tr></thead>
                <tbody>
                  {[...d.porVendedor.entries()].sort((a, b) => b[1].v - a[1].v).map(([nome, v]) => (
                    <tr key={nome}>
                      <td style={{ paddingLeft: 11 }}>{nome}</td>
                      <td className="tnum" style={{ textAlign: 'right' }}>{v.n}</td>
                      <td className="tnum" style={{ textAlign: 'right' }}>{fk(v.v)}</td>
                      <td className="tnum" style={{ paddingRight: 11, textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{fm(v.c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card titulo="Rateio do imposto">
            <table className="table" style={{ fontSize: 13 }}>
              <tbody>
                {rateio.map(r => (
                  <tr key={r.label}>
                    <td style={{ paddingLeft: 11 }}>{r.label}</td>
                    <td style={{ width: 80 }}><Barra pct={r.pct} cor="var(--color-accent-700)" /></td>
                    <td className="tnum" style={{ paddingRight: 11, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {fm(d.impostoTotal * r.pct / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 12, lineHeight: 1.4, color: muted50, padding: '8px 11px', borderTop: '1px solid var(--color-divider)' }}>
              Imposto embutido no preço — não aparece no documento do cliente.
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
