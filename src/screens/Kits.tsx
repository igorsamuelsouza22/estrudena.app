import { useMemo } from 'react'
import { chamar, ponte } from '../api'
import { fm, fn, num } from '../format'
import { Ico } from '../icons'
import { useApp } from '../store'
import { Campo, FichaHead, InputFicha, ListaFicha, Secao, Vazio, muted45, muted50 } from '../ui'
import { novoId, useCadastro } from './useCadastro'
import type { Kit } from '../shared/types'

export function Kits() {
  const app = useApp()
  const { db, motor } = app

  const vazio = (): Kit => ({ id: novoId('kit'), cod: '', nome: '', aplicacao: '', itens: [] })
  const cad = useCadastro(db.kits, vazio)
  const f = cad.form

  const lista = useMemo(() => {
    const t = cad.filtro.trim().toLowerCase()
    if (!t) return db.kits
    return db.kits.filter(k => [k.cod, k.nome, k.aplicacao].join(' ').toLowerCase().includes(t))
  }, [db.kits, cad.filtro])

  const usos = f ? db.materiais.filter(m => m.kitId === f.id) : []
  const existe = f ? db.kits.some(k => k.id === f.id) : false
  const custoDoForm = f ? motor.acesCusto(f.itens) : 0

  return (
    <ListaFicha
      filtro={cad.filtro} onFiltro={cad.setFiltro}
      placeholder="Filtrar kit ou aplicação"
      resumo={`${lista.length} de ${db.kits.length} kits`}
      rotuloNovo="+ novo kit" onNovo={cad.criarNovo}
      lista={lista.map(k => (
        <div key={k.id} onClick={() => cad.selecionar(k)}
             className={'linha' + (f?.id === k.id ? ' sel' : '')} style={{ height: 40 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, width: 74, flex: 'none' }}>{k.cod}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="trunc" style={{ fontSize: 13, lineHeight: 1.2 }}>{k.nome}</div>
            <div style={{ fontSize: 11, letterSpacing: '.02em', color: 'color-mix(in srgb, var(--color-text) 42%, transparent)' }}>
              {k.itens.length} peças
            </div>
          </div>
          <span className="tnum" style={{ fontSize: 13, whiteSpace: 'nowrap', color: 'color-mix(in srgb, var(--color-text) 60%, transparent)' }}>
            {fm(motor.acesCusto(k.itens))}
          </span>
        </div>
      ))}
      ficha={f ? (
        <div className="card">
          <FichaHead titulo={existe ? `Kit ${f.cod}` : 'Novo kit de ferragem'}>
            {existe && !usos.length && (
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 6px' }}
                      onClick={() => void app.gravar(() => chamar(ponte().excluir('kits', f.id)), 'Kit excluído').then(() => cad.setForm(null))}>
                excluir
              </button>
            )}
            <button className="btn btn-primary" style={{ minHeight: 24, padding: '2px 11px', fontSize: 13 }}
                    onClick={() => {
                      if (!f.cod.trim()) return app.say('Informe o código do kit.')
                      void app.gravar(() => chamar(ponte().salvarKit(f)), `${f.cod} salvo`)
                    }}>Salvar kit</button>
          </FichaHead>

          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '11px 13px' }}>
            <Campo label="Código"><InputFicha valor={f.cod} onChange={v => cad.alterar({ cod: v.toUpperCase() })} /></Campo>
            <Campo label="Nome do kit" span={3}><InputFicha valor={f.nome} onChange={v => cad.alterar({ nome: v })} /></Campo>
            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label>Aplicação</label>
              <InputFicha valor={f.aplicacao} onChange={v => cad.alterar({ aplicacao: v })} />
            </div>

            <Secao topo>Composição do kit</Secao>
            <div style={{ gridColumn: '1/-1' }}>
              <table className="table" style={{ fontSize: 13 }}>
                <thead><tr>
                  <th>Cód</th><th>Acessório</th><th>Grupo</th>
                  <th style={{ width: 70, textAlign: 'right' }}>Custo</th>
                  <th style={{ width: 74, textAlign: 'right' }}>Qtd</th>
                  <th style={{ width: 34 }}>Un</th>
                  <th style={{ width: 84, textAlign: 'right' }}>Subtotal</th>
                  <th style={{ width: 26 }} />
                </tr></thead>
                <tbody>
                  {f.itens.map((it, i) => {
                    const a = db.acessorios.find(x => x.id === it.acesId)
                    return (
                      <tr key={it.acesId}>
                        <td style={{ fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap' }}>{a?.cod ?? '?'}</td>
                        <td style={{ fontSize: 13 }}>{a?.nome ?? 'acessório removido'}</td>
                        <td style={{ fontSize: 12, color: muted50 }}>{a?.grupo ?? ''}</td>
                        <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm(a?.preco ?? 0)}</td>
                        <td>
                          <input className="input tnum" type="number" style={{ minHeight: 22, padding: '1px 5px', fontSize: 13, textAlign: 'right' }}
                                 value={it.qtd}
                                 onChange={e => cad.alterar({ itens: f.itens.map((x, k) => (k === i ? { ...x, qtd: num(e.target.value) } : x)) })} />
                        </td>
                        <td style={{ fontSize: 12, color: muted50 }}>{a?.unidade ?? ''}</td>
                        <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm((a?.preco ?? 0) * it.qtd)}</td>
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
                <div style={{ padding: '14px 2px', fontSize: 13, color: muted45 }}>Kit sem peças — escolha acessórios abaixo.</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 9 }}>
                <select className="input" style={{ minHeight: 26, padding: '1px 6px', fontSize: 13, maxWidth: 340 }} value=""
                        onChange={e => {
                          const id = e.target.value
                          if (!id || f.itens.some(x => x.acesId === id)) return
                          cad.alterar({ itens: [...f.itens, { acesId: id, qtd: 1 }] })
                        }}>
                  <option value="">— escolher acessório —</option>
                  {db.acessorios.map(a => <option key={a.id} value={a.id}>{a.cod} · {a.nome} · {fm(a.preco)}</option>)}
                </select>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 13, color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>
                  Custo do kit por unidade: <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 16, color: 'var(--color-text)' }}>{fm(custoDoForm)}</strong>
                </span>
              </div>
            </div>

            <div style={{ gridColumn: '1/-1', background: 'var(--color-surface)', padding: '9px 11px' }}>
              <div style={{ fontSize: 11, letterSpacing: '.02em', color: muted45 }}>Itens que usam este kit</div>
              <div style={{ fontSize: 13, paddingTop: 2 }}>
                {usos.length ? usos.map(m => m.cod).join(' · ') : 'Nenhum item vinculado — pode excluir.'}
              </div>
            </div>
          </div>
        </div>
      ) : <Vazio>Selecione um kit ou cadastre um novo.</Vazio>}
    />
  )
}
