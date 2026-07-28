import { useMemo } from 'react'
import { chamar, ponte } from '../api'
import { margemDoItem, markupDaMargem } from '../calc'
import { fm, fn, num } from '../format'
import { Ico } from '../icons'
import { useApp } from '../store'
import {
  Campo, FichaHead, InputFicha, ListaFicha, Secao, SelectComAdd,
  Vazio, muted45, muted50
} from '../ui'
import { novoId, useCadastro } from './useCadastro'
import type { Material } from '../shared/types'

const DESENHOS = [
  'tip-PA150', 'tip-PA300', 'tip-PA240', 'tip-PA70', 'tip-PA60',
  'tip-JA60', 'tip-JA120', 'tip-JA140', 'tip-JA150',
  'tip-VA100', 'tip-VA80', 'tip-AL01'
]

const MAX_IMG = 400 * 1024

export function Itens() {
  const app = useApp()
  const { db, motor } = app

  const vazio = (): Material => ({
    id: novoId('mat'), cod: '', desc: '', serie: db.series[0] ?? '—', tipo: db.tipos[0] ?? '',
    unidade: 'KG', pesoUnit: 0, larg: 1000, alt: 1000, preco: 0, fc: 1,
    corId: '', kitId: '', aces: [], img: '', imgData: null,
    markup: db.config.markup, imposto: db.config.imposto, comissao: db.config.com1, moM2: db.config.moM2
  })

  const cad = useCadastro(db.materiais, vazio)
  const f = cad.form

  const lista = useMemo(() => {
    const t = cad.filtro.trim().toLowerCase()
    if (!t) return db.materiais
    return db.materiais.filter(m => [m.cod, m.desc, m.tipo, m.serie].join(' ').toLowerCase().includes(t))
  }, [db.materiais, cad.filtro])

  const emUso = f ? db.orcamentos.some(o => o.itens.some(i => i.matId === f.id)) : false
  const existeNoBanco = f ? db.materiais.some(m => m.id === f.id) : false

  const salvar = async () => {
    if (!f) return
    if (!f.cod.trim()) return app.say('Informe o código do item.')
    if (!f.desc.trim()) return app.say('Informe a descrição do item.')
    await app.gravar(() => chamar(ponte().salvarMaterial(f)), `${f.cod} salvo`)
  }

  const excluir = async () => {
    if (!f) return
    await app.gravar(() => chamar(ponte().excluir('materiais', f.id)), `${f.cod} excluído`)
    cad.setForm(null)
  }

  const cor = f ? db.cores.find(c => c.id === f.corId) : undefined
  const kit = f ? db.kits.find(k => k.id === f.kitId) : undefined
  const custoAces = f ? motor.acesCusto(f.aces) : 0
  const custoKit = f ? motor.kitCusto(f.kitId) : 0
  const custoEst = f ? motor.custoBase(f) * (f.unidade === 'M2' ? (f.larg ?? 0) * (f.alt ?? 0) / 1e6 : 1) : 0
  const vendaEst = f && f.markup < 98 ? custoEst / (1 - f.markup / 100) : custoEst
  const margem = f ? margemDoItem(f.markup, f.imposto, f.comissao) : 0

  const enviarImagem = (arquivo: File | undefined) => {
    if (!arquivo || !f) return
    if (arquivo.size > MAX_IMG) return app.say('Imagem acima de 400 KB — reduza o arquivo.')
    const fr = new FileReader()
    fr.onload = () => cad.alterar({ imgData: String(fr.result), img: '' })
    fr.readAsDataURL(arquivo)
  }

  const previa = f ? (f.imgData || (f.img ? `assets/${f.img}.png` : '')) : ''

  return (
    <ListaFicha
      largura={348}
      filtro={cad.filtro} onFiltro={cad.setFiltro}
      placeholder="Filtrar código, descrição ou tipo"
      resumo={`${lista.length} de ${db.materiais.length} itens`}
      rotuloNovo="+ novo item" onNovo={cad.criarNovo}
      lista={lista.map(m => (
        <div
          key={m.id} onClick={() => cad.selecionar(m)}
          className={'linha' + (f?.id === m.id ? ' sel' : '')} style={{ height: 40 }}
        >
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, width: 58, flex: 'none' }}>{m.cod}</span>
          <span style={{
            width: 30, height: 30, flex: 'none', background: '#fff', borderRadius: 12,
            boxShadow: 'var(--el1)', overflow: 'hidden',
            backgroundImage: m.imgData ? `url(${m.imgData})` : m.img ? `url(assets/${m.img}.png)` : undefined,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'contain'
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="trunc" style={{ fontSize: 13, lineHeight: 1.2 }}>{m.desc}</div>
            <div style={{ fontSize: 11, letterSpacing: '.02em', color: 'color-mix(in srgb, var(--color-text) 42%, transparent)' }}>
              {m.tipo} · {m.unidade}
            </div>
          </div>
          <span className="tnum" style={{ fontSize: 13, whiteSpace: 'nowrap', color: 'color-mix(in srgb, var(--color-text) 60%, transparent)' }}>
            {fm(motor.custoBase(m))}
          </span>
        </div>
      ))}
      ficha={f && (
        <div className="card">
          <FichaHead titulo={existeNoBanco ? `Item ${f.cod}` : 'Novo item'}>
            {existeNoBanco && !emUso && (
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 6px' }} onClick={() => void excluir()}>excluir</button>
            )}
            <button className="btn btn-primary" style={{ minHeight: 24, padding: '2px 11px', fontSize: 13 }} onClick={() => void salvar()}>Salvar item</button>
          </FichaHead>

          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '11px 13px' }}>
            <Secao topo>Identificação</Secao>

            <Campo label="Código"><InputFicha valor={f.cod} onChange={v => cad.alterar({ cod: v.toUpperCase() })} /></Campo>
            <Campo label="Descrição" span={3}><InputFicha valor={f.desc} onChange={v => cad.alterar({ desc: v })} /></Campo>

            <Campo label="Tipo de material" span={2}>
              <SelectComAdd
                style={{ minHeight: 28, fontSize: 13 }}
                valor={f.tipo} opcoes={db.tipos.map(t => ({ id: t, label: t }))}
                onChange={v => cad.alterar({ tipo: v })}
                onAdicionar={v => chamar(ponte().listaAdd('tipos', v)).then(app.recarregar)}
                rotuloAdd="+ adicionar novo tipo…" placeholder="Nome do novo tipo" maiuscula
              />
            </Campo>

            <Campo label="Série / linha">
              <SelectComAdd
                style={{ minHeight: 28, fontSize: 13 }}
                valor={f.serie} opcoes={db.series.map(t => ({ id: t, label: t }))}
                onChange={v => cad.alterar({ serie: v })}
                onAdicionar={v => chamar(ponte().listaAdd('series', v)).then(app.recarregar)}
                rotuloAdd="+ adicionar nova série…" placeholder="Nova série" maiuscula
              />
            </Campo>

            <Campo label="Cobrado por">
              <select className="input" style={{ minHeight: 28, fontSize: 13 }} value={f.unidade}
                      onChange={e => cad.alterar({ unidade: e.target.value as Material['unidade'] })}>
                <option value="KG">Quilo (kg)</option>
                <option value="M2">Metro quadrado (m²)</option>
                <option value="UN">Unidade</option>
                <option value="ML">Metro linear</option>
              </select>
            </Campo>

            <Campo
              label="Cor / acabamento" span={2}
              nota={cor
                ? `${cor.nome} — acréscimo ${fm(cor.precoKg)}/kg · ${fm(cor.precoM2)}/m² · kg final ${fm(db.config.precoKg + cor.precoKg)}`
                : 'Sem cor vinculada — o kg fica no preço base.'}
            >
              <select className="input" style={{ minHeight: 28, fontSize: 13 }} value={f.corId}
                      onChange={e => cad.alterar({ corId: e.target.value })}>
                <option value="">— sem cor —</option>
                {db.cores.map(c => <option key={c.id} value={c.id}>{c.cod} · {c.nome}</option>)}
              </select>
            </Campo>

            <Campo
              label="Kit de ferragem" span={2}
              nota={kit ? `${kit.itens.length} peças — ${fm(custoKit)} por unidade` : 'Sem kit — só os acessórios avulsos entram no custo.'}
            >
              <select className="input" style={{ minHeight: 28, fontSize: 13 }} value={f.kitId}
                      onChange={e => cad.alterar({ kitId: e.target.value })}>
                <option value="">— sem kit —</option>
                {db.kits.map(k => <option key={k.id} value={k.id}>{k.cod} · {k.nome}</option>)}
              </select>
            </Campo>

            <Secao>Medidas e custo</Secao>

            <Campo label="Largura padrão (mm)"><InputFicha numero valor={f.larg ?? 0} onChange={v => cad.alterar({ larg: num(v) })} /></Campo>
            <Campo label="Altura padrão (mm)"><InputFicha numero valor={f.alt ?? 0} onChange={v => cad.alterar({ alt: num(v) })} /></Campo>
            <Campo label={f.unidade === 'KG' ? 'Peso bruto por peça (kg)' : 'Peso por peça (kg)'}>
              <InputFicha numero valor={f.pesoUnit} onChange={v => cad.alterar({ pesoUnit: num(v) })} />
            </Campo>
            <Campo label="Fator de correção (FC)"><InputFicha numero valor={f.fc} onChange={v => cad.alterar({ fc: num(v) })} /></Campo>
            <Campo
              span={2}
              label={f.unidade === 'KG' ? 'Custo adicional por peça (R$)'
                : f.unidade === 'M2' ? 'Custo por m² (R$)'
                : f.unidade === 'ML' ? 'Custo por metro linear (R$)' : 'Custo por unidade (R$)'}
            >
              <InputFicha numero valor={f.preco} onChange={v => cad.alterar({ preco: num(v) })} />
            </Campo>
            <Campo label="M.O. instalação (R$/m²)"><InputFicha numero valor={f.moM2} onChange={v => cad.alterar({ moM2: num(v) })} /></Campo>

            <Secao>Acessórios avulsos deste item</Secao>
            <div style={{ gridColumn: '1/-1' }}>
              <table className="table" style={{ fontSize: 13 }}>
                <thead><tr>
                  <th>Cód</th><th>Acessório</th><th>Grupo</th>
                  <th style={{ width: 70, textAlign: 'right' }}>Preço</th>
                  <th style={{ width: 70, textAlign: 'right' }}>Qtd</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Subtotal</th>
                  <th style={{ width: 26 }} />
                </tr></thead>
                <tbody>
                  {f.aces.map((a, i) => {
                    const ac = db.acessorios.find(x => x.id === a.acesId)
                    return (
                      <tr key={a.acesId}>
                        <td style={{ fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap' }}>{ac?.cod ?? '?'}</td>
                        <td style={{ fontSize: 13 }}>{ac?.nome ?? 'acessório removido'}</td>
                        <td style={{ fontSize: 12, color: muted50 }}>{ac?.grupo ?? ''}</td>
                        <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm(ac?.preco ?? 0)}</td>
                        <td>
                          <input className="input tnum" type="number" style={{ minHeight: 22, padding: '1px 5px', fontSize: 13, textAlign: 'right' }}
                                 value={a.qtd}
                                 onChange={e => cad.alterar({ aces: f.aces.map((x, k) => (k === i ? { ...x, qtd: num(e.target.value) } : x)) })} />
                        </td>
                        <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm((ac?.preco ?? 0) * a.qtd)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-ghost" title="Remover" style={{ padding: '1px 3px', border: 0, minHeight: 0 }}
                                  onClick={() => cad.alterar({ aces: f.aces.filter((_, k) => k !== i) })}>{Ico.del2()}</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!f.aces.length && (
                <div style={{ padding: '9px 2px', fontSize: 13, color: muted45 }}>
                  Nenhum acessório avulso — o custo de ferragem vem do kit selecionado acima.
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
                <select
                  className="input" style={{ minHeight: 26, padding: '1px 6px', fontSize: 13, maxWidth: 330 }}
                  value=""
                  onChange={e => {
                    const id = e.target.value
                    if (!id || f.aces.some(a => a.acesId === id)) return
                    cad.alterar({ aces: [...f.aces, { acesId: id, qtd: 1 }] })
                  }}
                >
                  <option value="">— escolher acessório —</option>
                  {db.acessorios.map(a => <option key={a.id} value={a.id}>{a.cod} · {a.nome} · {fm(a.preco)}</option>)}
                </select>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 13, color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>
                  Acessórios avulsos: <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 14, color: 'var(--color-text)' }}>{fm(custoAces)}</strong>
                </span>
              </div>
            </div>

            <Secao>Desenho da tipologia — sai no bloco da proposta</Secao>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 108, height: 136, flex: 'none', background: '#fff', borderRadius: 12,
                boxShadow: 'var(--el1)', overflow: 'hidden',
                backgroundImage: previa ? `url(${previa})` : undefined,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'contain'
              }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
                <Campo label="Desenho do catálogo">
                  <select className="input" style={{ minHeight: 28, fontSize: 13 }} value={f.img}
                          onChange={e => cad.alterar({ img: e.target.value, imgData: null })}>
                    <option value="">— sem desenho —</option>
                    {DESENHOS.map(d => <option key={d} value={d}>{d.replace('tip-', '')}</option>)}
                  </select>
                </Campo>
                <Campo label="Ou enviar imagem do seu computador (PNG/JPG até 400 KB)">
                  <input className="input" type="file" accept="image/png,image/jpeg"
                         style={{ minHeight: 28, fontSize: 13, padding: '4px 6px' }}
                         onChange={e => enviarImagem(e.target.files?.[0])} />
                </Campo>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 12, color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>
                    {f.imgData ? 'Imagem própria enviada.' : f.img ? 'Desenho do catálogo.' : 'Sem desenho — o bloco da proposta sai em branco.'}
                  </span>
                  {(f.img || f.imgData) && (
                    <button className="btn btn-secondary" style={{ minHeight: 24, padding: '2px 9px', fontSize: 13 }}
                            onClick={() => cad.alterar({ img: '', imgData: null })}>remover desenho</button>
                  )}
                </div>
              </div>
            </div>

            <Secao>Encargos e preço</Secao>
            <Campo label="Imposto (%)"><InputFicha numero valor={f.imposto} onChange={v => cad.alterar({ imposto: num(v) })} /></Campo>
            <Campo label="Comissão (%)"><InputFicha numero valor={f.comissao} onChange={v => cad.alterar({ comissao: num(v) })} /></Campo>
            <Campo label="Markup (%)"><InputFicha numero valor={f.markup} onChange={v => cad.alterar({ markup: num(v) })} /></Campo>
            <Campo label="Margem resultante (%)">
              <InputFicha
                numero valor={Math.round(margem * 10) / 10}
                onChange={v => cad.alterar({ markup: markupDaMargem(num(v), f.imposto, f.comissao) })}
              />
            </Campo>

            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 24, background: 'var(--color-surface)', padding: '9px 11px' }}>
              <Resumo label="Custo na medida padrão" valor={fm(custoEst)} />
              <Resumo label="Preço de venda" valor={fm(vendaEst)} />
              <Resumo label="Medida" valor={`${fn(f.larg ?? 0, 0)} × ${fn(f.alt ?? 0, 0)} mm`} />
            </div>
          </div>
        </div>
      ) || <Vazio>Selecione um item na lista ou cadastre um novo.</Vazio>}
    />
  )
}

function Resumo(p: { label: string; valor: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '.02em', color: muted45 }}>{p.label}</div>
      <div className="tnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>{p.valor}</div>
    </div>
  )
}
