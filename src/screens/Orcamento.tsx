import { useMemo, useState } from 'react'
import { chamar, ponte } from '../api'
import { fm, fn, num, pc } from '../format'
import { Ico } from '../icons'
import { useAcoes } from '../Shell'
import { useApp } from '../store'
import { Campo, Card, SelectComAdd, Tag, muted45, muted50, tagDeStatus } from '../ui'
import { ModalGerarProposta } from './ModalGerarProposta'
import { PickerItens } from './PickerItens'
import type { Orcamento as TipoOrcamento, OrcItem } from '../shared/types'

const estiloCelula = { minHeight: 22, padding: '1px 4px', fontSize: 13 }

export function Orcamento() {
  const app = useApp()
  const { db, motor, q, setQ, verCustos } = app
  const [selLinha, setSelLinha] = useState(-1)
  const [picker, setPicker] = useState(false)
  const [salvando, setSalvando] = useState(false)
  // Orçamento já gravado, aguardando a escolha dos documentos a emitir.
  const [gerado, setGerado] = useState<TipoOrcamento | null>(null)

  const t = useMemo(() => motor.calc(q), [motor, q])

  /** Grava e devolve o orçamento já com id e número definitivos. */
  const salvar = async (status?: typeof q.status): Promise<TipoOrcamento | null> => {
    if (!q.clienteId) { app.say('Escolha o cliente antes de salvar.'); return null }
    setSalvando(true)
    try {
      const gravado = await chamar(ponte().salvarOrcamento(status ? { ...q, status } : q))
      setQ(() => gravado)
      await app.recarregar()
      app.say(`${gravado.numero} ${gravado.rev} salvo`)
      return gravado
    } catch (e) {
      app.say(e instanceof Error ? e.message : 'Não consegui salvar.')
      return null
    } finally {
      setSalvando(false)
    }
  }

  useAcoes(
    <>
      <button className="btn btn-secondary" disabled={salvando} onClick={() => void salvar()}>Salvar rascunho</button>
      <button
        className="btn btn-primary" disabled={salvando}
        onClick={async () => {
          const gravado = await salvar(q.status === 'Rascunho' ? 'Proposta' : q.status)
          if (gravado) setGerado(gravado)
        }}
      >Gerar Proposta</button>
    </>,
    [q, salvando]
  )

  const clienteEscolhido = db.clientes.some(c => c.id === q.clienteId)
  const instalador = db.instaladores.find(i => i.id === q.instaladorId)

  const alterarItem = (i: number, patch: Partial<OrcItem>) =>
    setQ(x => ({ ...x, itens: x.itens.map((it, k) => (k === i ? { ...it, ...patch } : it)) }))

  const inserirMaterial = (matId: string, qtd: number) => {
    const m = db.materiais.find(x => x.id === matId)
    if (!m) return
    const cor = db.cores.find(c => c.id === m.corId)
    setQ(x => ({
      ...x,
      itens: [...x.itens, {
        matId, qtd, local: '', desc: null, serie: null,
        perfil: cor?.nome ?? '—', vidro: '—', detalhe: null,
        larg: m.larg, alt: m.alt, markup: null, fc: m.fc || 1
      }]
    }))
  }

  // Atalhos "+ CÓD" dos itens já usados na grade.
  const recentes = useMemo(() => {
    const vistos: string[] = []
    for (const it of q.itens) if (!vistos.includes(it.matId)) vistos.push(it.matId)
    return vistos.slice(-3).map(id => db.materiais.find(m => m.id === id)).filter(Boolean)
  }, [q.itens, db.materiais])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* a) Identificação da proposta */}
      <Card
        titulo="Identificação da proposta"
        direita={<span style={{ fontSize: 12, letterSpacing: '.02em', color: muted45 }}>{q.rev} · {q.data}</span>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '10px 14px', padding: 11 }}>
          <Campo label="Número (automático)">
            <div style={{
              minHeight: 27, display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--font-heading)', fontSize: 16, letterSpacing: '.01em'
            }}>
              {q.numero}
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, letterSpacing: '.02em', color: muted45 }}>{q.rev}</span>
            </div>
          </Campo>

          <Campo label="Cliente" span={2}>
            {/* Sem a opção vazia explícita, um clienteId que não casa com
                nenhuma opção faria o navegador exibir a primeira da lista — o
                campo pareceria preenchido enquanto o orçamento segue sem
                cliente. Acontece ao cadastrar o primeiro cliente com um
                orçamento já aberto. */}
            <select
              className="input" style={estiloCelula}
              value={clienteEscolhido ? q.clienteId : ''}
              onChange={e => {
                const c = db.clientes.find(x => x.id === e.target.value)
                setQ(x => ({
                  ...x, clienteId: e.target.value,
                  cidade: c?.cidade ?? x.cidade, contato: c?.contato ?? x.contato
                }))
              }}
            >
              {!clienteEscolhido && (
                <option value="">
                  {db.clientes.length ? '— escolher cliente —' : '— cadastre um cliente —'}
                </option>
              )}
              {db.clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>

          <Campo label="Obra" span={2}>
            <input className="input" style={estiloCelula} value={q.obra}
                   onChange={e => setQ(x => ({ ...x, obra: e.target.value }))} />
          </Campo>

          <Campo label="Cidade">
            <input className="input" style={estiloCelula} value={q.cidade}
                   onChange={e => setQ(x => ({ ...x, cidade: e.target.value }))} />
          </Campo>

          <Campo label="Contato">
            <input className="input" style={estiloCelula} value={q.contato}
                   onChange={e => setQ(x => ({ ...x, contato: e.target.value }))} />
          </Campo>

          <Campo label="Prazo de entrega" span={2}>
            <SelectComAdd
              style={estiloCelula}
              valor={q.prazo}
              opcoes={db.prazosEntrega.map(v => ({ id: v, label: v }))}
              onChange={v => setQ(x => ({ ...x, prazo: v }))}
              onAdicionar={v => chamar(ponte().listaAdd('prazosEntrega', v)).then(app.recarregar)}
              rotuloAdd="+ adicionar prazo…"
              placeholder="Novo prazo de entrega"
              maiuscula
            />
          </Campo>

          <Campo label="Condição de pagamento" span={2}>
            <SelectComAdd
              style={estiloCelula}
              valor={q.condPag}
              opcoes={db.condicoesPag.map(v => ({ id: v, label: v }))}
              onChange={v => setQ(x => ({ ...x, condPag: v }))}
              onAdicionar={v => chamar(ponte().listaAdd('condicoesPag', v)).then(app.recarregar)}
              rotuloAdd="+ adicionar condição…"
              placeholder="Nova condição de pagamento"
              maiuscula
            />
          </Campo>

          <Campo label="Situação">
            <div style={{ height: 27, display: 'flex', alignItems: 'center' }}>
              <Tag tipo={tagDeStatus(q.status)}>{q.status}</Tag>
            </div>
          </Campo>
        </div>
      </Card>

      {/* b) Grade + rail de fechamento */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 14, alignItems: 'start' }}>
        <div className="card" style={{ minWidth: 0 }}>
          <div className="cardhead" style={{ height: 32 }}>
            <span className="cardtitle">Itens da proposta</span>
            <span className="tnum" style={{ fontSize: 12, color: muted45 }}>
              {q.itens.length} linhas · {fn(t.pecas, 0)} peças
            </span>
            <div style={{ flex: 1 }} />
            {recentes.map(m => (
              <button
                key={m!.id} className="btn btn-secondary" title="Repetir este item"
                style={{ minHeight: 22, padding: '1px 7px', fontSize: 12, background: 'var(--color-bg)' }}
                onClick={() => inserirMaterial(m!.id, 1)}
              >+ {m!.cod}</button>
            ))}
            <button
              className="btn btn-primary" style={{ minHeight: 24, padding: '2px 11px', fontSize: 13 }}
              onClick={() => setPicker(true)}
            >+ Inserir item</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 840, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: 24, paddingLeft: 11 }}>#</th>
                  <th style={{ width: 66 }}>Cód</th>
                  <th>Descrição / local</th>
                  <th style={{ width: 66, textAlign: 'right' }}>L mm</th>
                  <th style={{ width: 66, textAlign: 'right' }}>A mm</th>
                  <th style={{ width: 50, textAlign: 'right' }}>Qtd</th>
                  <th style={{ width: 56, textAlign: 'right' }}>m²</th>
                  <th style={{ width: 60, textAlign: 'right' }}>kg</th>
                  <th style={{ width: 54, textAlign: 'right' }}>MKU</th>
                  <th style={{ width: 92, textAlign: 'right' }}>Unitário</th>
                  <th style={{ width: 106, textAlign: 'right' }}>Total</th>
                  <th style={{ width: 50, paddingRight: 6 }} />
                </tr>
              </thead>
              <tbody>
                {t.rows.map(r => (
                  <tr
                    key={r.i}
                    style={{ background: selLinha === r.i ? 'color-mix(in srgb, #202124 11%, transparent)' : undefined }}
                    onClick={() => setSelLinha(r.i)}
                  >
                    <td className="tnum" style={{ paddingLeft: 11, color: 'color-mix(in srgb, var(--color-text) 38%, transparent)', fontSize: 12 }}>{r.i + 1}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontSize: 14, whiteSpace: 'nowrap' }}>{r.m?.cod ?? '—'}</td>
                    <td>
                      <input
                        className="input cellinput"
                        value={r.it.desc ?? r.m?.desc ?? ''}
                        onChange={e => alterarItem(r.i, { desc: e.target.value })}
                      />
                      <input
                        className="input cellinput sub" placeholder="local / tipologia"
                        value={r.it.local}
                        onChange={e => alterarItem(r.i, { local: e.target.value })}
                      />
                    </td>
                    <td>
                      <input className="input cellinput" type="number" style={{ textAlign: 'right' }}
                             value={r.it.larg ?? r.m?.larg ?? 0}
                             onChange={e => alterarItem(r.i, { larg: num(e.target.value) })} />
                    </td>
                    <td>
                      <input className="input cellinput" type="number" style={{ textAlign: 'right' }}
                             value={r.it.alt ?? r.m?.alt ?? 0}
                             onChange={e => alterarItem(r.i, { alt: num(e.target.value) })} />
                    </td>
                    <td>
                      <input className="input cellinput" type="number" style={{ textAlign: 'right' }}
                             value={r.it.qtd}
                             onChange={e => alterarItem(r.i, { qtd: num(e.target.value) })} />
                    </td>
                    <td className="tnum" style={{ textAlign: 'right', color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}>{fn(r.im2, 2)}</td>
                    <td className="tnum" style={{ textAlign: 'right', color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}>{fn(r.ikg, 1)}</td>
                    <td>
                      <input className="input cellinput" type="number" style={{ textAlign: 'right' }}
                             value={r.mkuPct}
                             onChange={e => alterarItem(r.i, { markup: num(e.target.value) })} />
                    </td>
                    <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm(r.unit)}</td>
                    <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{fm(r.venda)}</td>
                    <td style={{ paddingRight: 6, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-ghost" title="Duplicar linha" style={{ padding: '1px 3px', border: 0, minHeight: 0 }}
                        onClick={e => {
                          e.stopPropagation()
                          setQ(x => ({ ...x, itens: [...x.itens.slice(0, r.i + 1), structuredClone(x.itens[r.i]), ...x.itens.slice(r.i + 1)] }))
                        }}
                      >{Ico.dup()}</button>
                      <button
                        className="btn btn-ghost" title="Excluir linha" style={{ padding: '1px 3px', border: 0, minHeight: 0 }}
                        onClick={e => {
                          e.stopPropagation()
                          setQ(x => ({ ...x, itens: x.itens.filter((_, k) => k !== r.i) }))
                          setSelLinha(-1)
                        }}
                      >{Ico.del()}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--color-surface)' }}>
                  <td colSpan={5} style={{ padding: '7px 8px 7px 11px', fontFamily: 'var(--font-heading)', fontSize: 12, letterSpacing: '.02em' }}>Total da grade</td>
                  <td className="tnum" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{fn(t.pecas, 0)}</td>
                  <td className="tnum" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{fn(t.m2, 2)}</td>
                  <td className="tnum" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{fn(t.kg, 1)}</td>
                  <td colSpan={2} />
                  <td className="tnum" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 15, whiteSpace: 'nowrap' }}>{fm(t.vendaMat)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {!q.itens.length && (
            <div style={{ padding: '30px 12px', textAlign: 'center', fontSize: 13, color: muted45 }}>
              Grade vazia — clique em <strong>Inserir item</strong> para escolher perfis, vidro ou ACM do catálogo.
            </div>
          )}
        </div>

        {/* Rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card titulo="Fechamento" altura={29}>
            <div style={{ padding: '7px 10px 9px' }}>
              {([
                ['Markup', 'markup', '%'],
                ['Margem alvo', '__margem', '%'],
                ['Imposto', 'imposto', '%'],
                ['Comissão 1', 'com1', '%'],
                ['Comissão 2', 'com2', '%'],
                ['Perda', 'perda', '%'],
                ['Desconto', 'desconto', '%']
              ] as const).map(([label, campo, un]) => (
                <LinhaNum
                  key={campo} label={label} un={un}
                  valor={campo === '__margem' ? Math.round(t.margemPct * 10) / 10 : (q[campo] as number)}
                  onChange={v => {
                    if (campo === '__margem') {
                      const mku = motor.markupParaMargem(q, v)
                      setQ(x => ({ ...x, markup: mku, itens: x.itens.map(i => ({ ...i, markup: null })) }))
                    } else {
                      setQ(x => ({ ...x, [campo]: v }))
                    }
                  }}
                />
              ))}
              <div style={{
                fontSize: 12, lineHeight: 1.4, color: muted50,
                borderTop: '1px solid var(--color-divider)', marginTop: 6, paddingTop: 6
              }}>
                Markup e margem estão ligados — editar um recalcula o outro sobre imposto,
                comissão, frete e instalação.
              </div>
            </div>
          </Card>

          <Card titulo="Instalação e encargos" altura={29}>
            <div style={{ padding: '7px 10px 9px' }}>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 8,
                borderBottom: '1px solid var(--color-divider)', marginBottom: 5
              }}>
                <span style={{ fontSize: 13, color: 'color-mix(in srgb, var(--color-text) 75%, transparent)' }}>Equipe de instalação</span>
                <select
                  className="input" style={{ minHeight: 26, padding: '1px 6px', fontSize: 13 }}
                  value={q.instaladorId}
                  onChange={e => {
                    const inst = db.instaladores.find(i => i.id === e.target.value)
                    setQ(x => ({
                      ...x, instaladorId: e.target.value,
                      moM2: inst ? inst.precoM2 : x.moM2,
                      moHora: inst ? inst.diaria : x.moHora
                    }))
                  }}
                >
                  <option value="">— sem equipe definida —</option>
                  {db.instaladores.filter(i => i.ativo || i.id === q.instaladorId).map(i => (
                    <option key={i.id} value={i.id}>{i.cod} · {i.nome}</option>
                  ))}
                </select>
                <span style={{ fontSize: 12, color: muted50, lineHeight: 1.35 }}>
                  {instalador
                    ? `${instalador.tipo} · ${fm(instalador.precoM2)}/m² · diária ${fm(instalador.diaria)} · ${instalador.equipe} pessoas`
                    : 'Escolha uma equipe para puxar R$/m² e diária do cadastro.'}
                </span>
              </div>

              {([
                ['Instalação R$/m²', 'moM2'],
                ['Diárias', 'moHoras'],
                ['R$ / diária', 'moHora'],
                ['% sobre material', 'moPct'],
                ['Valor fixo', 'moFixo'],
                ['Km', 'km'],
                ['R$ / km', 'moKm'],
                ['Frete', 'frete'],
                ['Terceiros', 'terceiros'],
                ['Outros', 'outros']
              ] as const).map(([label, campo]) => (
                <LinhaNum
                  key={campo} label={label} largura={90}
                  valor={q[campo] as number}
                  onChange={v => setQ(x => ({ ...x, [campo]: v }))}
                />
              ))}
            </div>
          </Card>

          <Card titulo="Apuração" altura={29}>
            <div style={{ padding: '8px 10px 10px' }}>
              {[
                ['Venda de material', fm(t.vendaMat), false],
                ['Instalação e encargos', fm(t.mo), false],
                ['Subtotal', fm(t.subtotal), false],
                ['Desconto', '− ' + fm(t.desc), false],
                ...(verCustos ? [
                  ['Custo de material', fm(t.custoMat), true],
                  ['Custos fixos e M.O.', fm(t.custoMO + t.fixos + t.perda), true],
                  ['Imposto e comissões', fm(t.imposto + t.com1 + t.com2), true],
                  ['Custo total', fm(t.custoTotal), true]
                ] as [string, string, boolean][] : [])
              ].map(([label, valor, fraco]) => (
                <div key={label as string} style={{
                  display: 'flex', alignItems: 'baseline', gap: 8, height: 23,
                  borderBottom: '1px solid color-mix(in srgb, var(--color-text) 7%, transparent)'
                }}>
                  <span style={{ flex: 1, fontSize: 13, color: fraco ? muted50 : undefined }}>{label}</span>
                  <span className="tnum" style={{ fontSize: 13, color: fraco ? muted50 : undefined }}>{valor}</span>
                </div>
              ))}

              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, letterSpacing: '.02em', color: muted, marginTop: 10 }}>
                Valor da proposta
              </div>
              <div className="tnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 29, lineHeight: 1.05 }}>{fm(t.total)}</div>

              {verCustos && (
                <>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    background: 'var(--color-surface)', marginTop: 9, padding: '6px 8px'
                  }}>
                    <span style={{ fontSize: 13 }}>Margem líquida</span>
                    <span className="tnum" style={{
                      fontFamily: 'var(--font-heading)', fontSize: 19,
                      color: t.margemPct < 0 ? '#b3261e' : 'var(--color-text)'
                    }}>{pc(t.margemPct)}</span>
                  </div>
                  <div className="tnum" style={{ textAlign: 'right', fontSize: 12, color: muted50, paddingTop: 3 }}>{fm(t.margem)}</div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {picker && (
        <PickerItens
          onFechar={() => setPicker(false)}
          onInserir={inserirMaterial}
          jaNaGrade={q.itens}
        />
      )}

      {gerado && (
        <ModalGerarProposta
          numero={gerado.numero} rev={gerado.rev}
          onFechar={() => { setGerado(null); app.irPara('lista') }}
          onConfirmar={({ proposta, separacao }) => {
            setGerado(null)
            if (proposta || separacao) {
              app.imprimir({ orcId: gerado.id, proposta, separacao })
            }
            app.irPara('lista')
          }}
        />
      )}
    </div>
  )
}

const muted = 'color-mix(in srgb, var(--color-text) 55%, transparent)'

function LinhaNum(p: {
  label: string
  valor: number
  onChange: (v: number) => void
  un?: string
  largura?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 27 }}>
      <span style={{ flex: 1, fontSize: 13, color: 'color-mix(in srgb, var(--color-text) 75%, transparent)' }}>{p.label}</span>
      <input
        className="input tnum" type="number"
        style={{ width: p.largura ?? 76, minHeight: 24, padding: '1px 6px', fontSize: 13, textAlign: 'right' }}
        value={p.valor}
        onChange={e => p.onChange(num(e.target.value))}
      />
      {p.un !== undefined && <span style={{ width: 14, fontSize: 12, color: muted45 }}>{p.un}</span>}
    </div>
  )
}
