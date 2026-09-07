import { ehMateriaPrima, unidadeLabel } from '../catalogo'
import { fm, fn, num } from '../format'
import { useApp } from '../store'
import { Secao, muted50 } from '../ui'
import type { ComponenteMaterial, Material } from '../shared/types'

export function ComposicaoProduto({ produto, onChange }: {
  produto: Material
  onChange: (itens: ComponenteMaterial[]) => void
}) {
  const { db, motor } = useApp()
  const itens = produto.composicao ?? []
  const disponiveis = db.materiais.filter(ehMateriaPrima).filter(m => !itens.some(it => it.materialId === m.id))
  const calculados = motor.composicaoProduto(produto)
  const alterar = (i: number, patch: Partial<ComponenteMaterial>) =>
    onChange(itens.map((it, k) => k === i ? { ...it, ...patch } : it))

  return <>
    <Secao>Composição de matérias-primas</Secao>
    <div style={{ gridColumn: '1/-1' }}>
      <p style={{ fontSize: 12, color: muted50, margin: '0 0 10px', lineHeight: 1.5 }}>
        Informe o consumo na unidade de compra de cada material. A base define se ele é fixo por produto,
        por m² ou por metro de largura. Ferragens e acessórios são somados separadamente.
      </p>
      {!!itens.length && <p className="notice">Na medida de {fn(produto.larg ?? 0, 0)} × {fn(produto.alt ?? 0, 0)} mm: {calculados.map((c, i) => `${c.material.cod}: ${fn(c.qtd, 3)} ${unidadeLabel(c.material.unidade)} (${itens[i].base === 'UN' ? 'fixo por peça' : itens[i].base === 'M2' ? 'acompanha largura e altura' : 'acompanha a largura'})`).join(' · ')}. Altere as medidas abaixo para simular o consumo.</p>}
      {calculados.some(c => c.material.preco <= 0) && <p className="notice warning">Há matérias-primas sem custo de compra. Confira os preços antes de utilizar este produto em uma proposta.</p>}
      {!!itens.length && <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ fontSize: 13 }}>
          <thead><tr>
            <th>Matéria-prima</th><th style={{ width: 85 }}>Consumo</th><th>Un.</th><th>Base</th>
            <th style={{ textAlign: 'right' }}>Custo / un.</th><th style={{ textAlign: 'right' }}>Subtotal</th><th />
          </tr></thead>
          <tbody>{itens.map((it, i) => {
            const c = calculados[i]
            return <tr key={it.materialId}>
              <td><strong>{c.material.cod}</strong><div style={{ fontSize: 12, color: muted50 }}>{c.material.desc}</div></td>
              <td><input aria-label={`Consumo de ${c.material.cod}`} className="input tnum" type="number" min="0.0001" step="0.0001"
                style={{ minHeight: 28, width: 85 }} value={it.qtd} onChange={e => alterar(i, { qtd: num(e.target.value) })} /></td>
              <td>{unidadeLabel(c.material.unidade)}</td>
              <td><select aria-label={`Base de consumo de ${c.material.cod}`} className="input" style={{ minHeight: 28, fontSize: 12 }}
                value={it.base} onChange={e => alterar(i, { base: e.target.value as ComponenteMaterial['base'] })}>
                <option value="UN">Por produto</option><option value="M2">Por m² do produto</option><option value="ML">Por metro de largura</option>
              </select></td>
              <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm(motor.custoMateriaPrima(c.material))}</td>
              <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm(c.custo)}
                <div style={{ fontSize: 11, color: muted50 }}>{fn(c.qtd, 3)} {unidadeLabel(c.material.unidade)}</div>
              </td>
              <td><button type="button" className="btn btn-ghost" aria-label={`Remover ${c.material.cod} da composição`}
                style={{ padding: '2px 5px', minHeight: 24 }} onClick={() => onChange(itens.filter((_, k) => k !== i))}>×</button></td>
            </tr>
          })}</tbody>
        </table>
      </div>}
      {!itens.length && <div style={{ padding: 12, background: 'var(--color-surface)', borderRadius: 6, fontSize: 13, lineHeight: 1.5 }}>
        Sem composição. O custo usa os parâmetros de medidas e custo abaixo.
        Ao adicionar matérias-primas, a composição passa a determinar o custo do produto.
      </div>}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 10 }}>
        <select aria-label="Adicionar matéria-prima à composição" className="input" value="" disabled={!disponiveis.length}
          style={{ minHeight: 30, fontSize: 13, flex: 1, minWidth: 0 }} onChange={e => {
            if (e.target.value) onChange([...itens, { materialId: e.target.value, qtd: 1, base: 'UN' }])
          }}>
          <option value="">{disponiveis.length ? '+ Adicionar matéria-prima' : 'Nenhuma matéria-prima disponível para adicionar'}</option>
          {disponiveis.map(m => <option key={m.id} value={m.id}>{m.cod} · {m.desc} · {fm(motor.custoMateriaPrima(m))}/{unidadeLabel(m.unidade)}</option>)}
        </select>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: muted50 }}>Materiais na medida padrão</div>
          <strong className="tnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>{fm(calculados.reduce((s, it) => s + it.custo, 0))}</strong>
        </div>
      </div>
    </div>
  </>
}
