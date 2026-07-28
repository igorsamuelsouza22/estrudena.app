import { useMemo } from 'react'
import { chamar, ponte } from '../api'
import { fm, fn, num } from '../format'
import { Ico } from '../icons'
import { useApp } from '../store'
import { Campo, FichaHead, InputFicha, ListaFicha, Secao, Vazio, muted45, muted50 } from '../ui'
import { novoId, useCadastro } from './useCadastro'
import type { KitVenda } from '../shared/types'

export function KitsVenda() {
  const app = useApp()
  const { db, motor } = app

  const vazio = (): KitVenda => ({ id: novoId('kv'), cod: '', nome: '', descricao: '', itens: [] })
  const cad = useCadastro(db.kitsVenda, vazio)
  const f = cad.form

  const lista = useMemo(() => {
    const t = cad.filtro.trim().toLowerCase()
    if (!t) return db.kitsVenda
    return db.kitsVenda.filter(k => [k.cod, k.nome, k.descricao].join(' ').toLowerCase().includes(t))
  }, [db.kitsVenda, cad.filtro])

  const existe = f ? db.kitsVenda.some(k => k.id === f.id) : false
  const r = f ? motor.kitVendaResumo(f) : null

  const lancar = () => {
    if (!f) return
    app.setQ(q => ({
      ...q,
      itens: [
        ...q.itens,
        ...f.itens.flatMap(it => {
          const m = db.materiais.find(x => x.id === it.matId)
          if (!m) return []
          const cor = db.cores.find(c => c.id === m.corId)
          return [{
            matId: m.id, qtd: it.qtd, larg: m.larg, alt: m.alt,
            local: f.nome, desc: null, serie: null,
            perfil: cor?.nome ?? '—', vidro: '—', detalhe: null,
            markup: null, fc: m.fc || 1
          }]
        })
      ]
    }))
    app.irPara('novo')
    app.say(`${f.cod} lançado no orçamento`)
  }

  return (
    <ListaFicha
      filtro={cad.filtro} onFiltro={cad.setFiltro}
      placeholder="Filtrar kit de venda"
      resumo={`${lista.length} de ${db.kitsVenda.length} kits`}
      rotuloNovo="+ novo kit" onNovo={cad.criarNovo}
      lista={lista.map(k => {
        const rk = motor.kitVendaResumo(k)
        return (
          <div key={k.id} onClick={() => cad.selecionar(k)}
               className={'linha' + (f?.id === k.id ? ' sel' : '')} style={{ height: 44 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, lineHeight: 1.15 }}>{k.cod}</div>
              <div className="trunc" style={{ fontSize: 12, color: muted50 }}>{k.nome}</div>
            </div>
            <div style={{ textAlign: 'right', flex: 'none' }}>
              <div className="tnum" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{fm(rk.venda)}</div>
              <div style={{ fontSize: 11, letterSpacing: '.01em', color: 'color-mix(in srgb, var(--color-text) 42%, transparent)' }}>
                {fn(rk.pecas, 0)} peças
              </div>
            </div>
          </div>
        )
      })}
      ficha={f && r ? (
        <div className="card">
          <FichaHead titulo={existe ? `Kit ${f.cod}` : 'Novo kit de venda'}>
            {existe && (
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 6px' }}
                      onClick={() => void app.gravar(() => chamar(ponte().excluir('kitsVenda', f.id)), 'Kit excluído').then(() => cad.setForm(null))}>
                excluir
              </button>
            )}
            <button className="btn btn-secondary" style={{ minHeight: 24, padding: '2px 10px', fontSize: 13, background: 'var(--color-bg)' }}
                    onClick={lancar}>Lançar no orçamento</button>
            <button className="btn btn-primary" style={{ minHeight: 24, padding: '2px 11px', fontSize: 13 }}
                    onClick={() => {
                      if (!f.cod.trim()) return app.say('Informe o código do kit.')
                      void app.gravar(() => chamar(ponte().salvarKitVenda(f)), `${f.cod} salvo`)
                    }}>Salvar kit</button>
          </FichaHead>

          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '11px 13px' }}>
            <Campo label="Código"><InputFicha valor={f.cod} onChange={v => cad.alterar({ cod: v.toUpperCase() })} /></Campo>
            <Campo label="Nome do kit" span={3}><InputFicha valor={f.nome} onChange={v => cad.alterar({ nome: v })} /></Campo>
            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label>Descrição comercial</label>
              <InputFicha valor={f.descricao} onChange={v => cad.alterar({ descricao: v })} />
            </div>

            <Secao topo>Itens do kit</Secao>
            <div style={{ gridColumn: '1/-1' }}>
              <table className="table" style={{ fontSize: 13 }}>
                <thead><tr>
                  <th>Cód</th><th>Descrição</th><th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Medida</th>
                  <th style={{ width: 74, textAlign: 'right' }}>Qtd</th>
                  <th style={{ width: 96, textAlign: 'right' }}>Unitário</th>
                  <th style={{ width: 104, textAlign: 'right' }}>Subtotal</th>
                  <th style={{ width: 26 }} />
                </tr></thead>
                <tbody>
                  {f.itens.map((it, i) => {
                    const m = db.materiais.find(x => x.id === it.matId)
                    const custo = m ? motor.custoBase(m) * (m.unidade === 'M2' ? (m.larg ?? 0) * (m.alt ?? 0) / 1e6 : 1) : 0
                    const mku = (m?.markup ?? db.config.markup) / 100
                    const unit = mku < 0.98 ? custo / (1 - mku) : custo
                    return (
                      <tr key={it.matId}>
                        <td style={{ fontFamily: 'var(--font-heading)', fontSize: 14, whiteSpace: 'nowrap' }}>{m?.cod ?? '?'}</td>
                        <td style={{ fontSize: 13, maxWidth: 230 }}>{m?.desc ?? 'item removido'}</td>
                        <td style={{ fontSize: 12, color: muted50 }}>{m?.tipo ?? ''}</td>
                        <td className="tnum" style={{ textAlign: 'right', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {fn(m?.larg ?? 0, 0)} × {fn(m?.alt ?? 0, 0)}
                        </td>
                        <td>
                          <input className="input tnum" type="number" style={{ minHeight: 22, padding: '1px 5px', fontSize: 13, textAlign: 'right' }}
                                 value={it.qtd}
                                 onChange={e => cad.alterar({ itens: f.itens.map((x, k) => (k === i ? { ...x, qtd: num(e.target.value) } : x)) })} />
                        </td>
                        <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm(unit)}</td>
                        <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{fm(unit * it.qtd)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-ghost" title="Remover" style={{ padding: '1px 3px', border: 0, minHeight: 0 }}
                                  onClick={() => cad.alterar({ itens: f.itens.filter((_, k) => k !== i) })}>{Ico.del2()}</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!f.itens.length && (
                <div style={{ padding: '14px 2px', fontSize: 13, color: muted45 }}>Kit sem itens — escolha tipologias do catálogo abaixo.</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 9 }}>
                <select className="input" style={{ minHeight: 26, padding: '1px 6px', fontSize: 13, maxWidth: 360 }} value=""
                        onChange={e => {
                          const id = e.target.value
                          if (!id || f.itens.some(x => x.matId === id)) return
                          cad.alterar({ itens: [...f.itens, { matId: id, qtd: 1 }] })
                        }}>
                  <option value="">— escolher item do catálogo —</option>
                  {db.materiais.map(m => <option key={m.id} value={m.id}>{m.cod} · {m.desc}</option>)}
                </select>
              </div>
            </div>

            <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, background: 'var(--color-surface)', padding: '10px 11px' }}>
              {[
                ['Venda do kit', fm(r.venda)],
                ['Custo', fm(r.custo)],
                ['Margem bruta', r.venda ? fn((r.venda - r.custo) / r.venda * 100, 1) + '%' : '0,0%'],
                ['m²', fn(r.m2, 2)],
                ['kg', fn(r.kg, 1)],
                ['Peças', fn(r.pecas, 0)]
              ].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 11, letterSpacing: '.02em', color: muted45 }}>{l}</div>
                  <div className="tnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 19 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : <Vazio>Selecione um kit de venda ou cadastre um novo.</Vazio>}
    />
  )
}
