import { necessidadesProducao } from './producao'
import { unidadeLabel } from './catalogo'
import { fn } from './format'
import { useApp } from './store'
import type { Orcamento } from './shared/types'

/** Consumo de fabricação; também visível à Produção, sem dados comerciais. */
export function MateriaisDoPedido({ orc, compacto = false }: { orc: Orcamento; compacto?: boolean }) {
  const { db } = useApp()
  const {materiais} = necessidadesProducao(db,orc)
  if (!materiais.length) return null
  return <section className={compacto ? '' : 'card noprint'} style={compacto ? { paddingTop: 12 } : undefined}>
    <div className={compacto ? '' : 'cardhead'} style={compacto ? { fontSize: 11, fontWeight: 600, marginBottom: 6 } : undefined}>
      <span className={compacto ? '' : 'cardtitle'}>Matérias-primas para fabricação</span>
    </div>
    <table className={'table' + (compacto ? ' fluida' : '')} style={{ fontSize: compacto ? 11 : 13 }}>
      <thead><tr><th>Código</th><th>Material</th><th style={{ textAlign: 'right' }}>Consumo total</th></tr></thead>
      <tbody>{materiais.map(({ material, qtd }) => <tr key={material.id}>
        <td style={{ fontFamily: 'var(--font-heading)' }}>{material.cod}</td><td>{material.desc}</td>
        <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fn(qtd, 3)} {unidadeLabel(material.unidade)}</td>
      </tr>)}</tbody>
    </table>
    <div style={{ padding: compacto ? '4px 0' : '8px 12px', fontSize: compacto ? 10 : 12, color: '#5f6368' }}>
      Consumo previsto nas composições, antes de perdas. Ferragens e acessórios constam na lista própria.
    </div>
  </section>
}
