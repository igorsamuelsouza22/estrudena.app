import { nomeProposta } from '../shared/types'
import { usePendenciaAtualizacao } from '../atualizacao'
import { capturarPrecos, ampliarReferencia } from '../historico'
import { proxRev } from '../calc'
import { ClienteRapido } from './ClienteRapido'
import { useMemo, useState } from 'react'
import { ehProduto } from '../catalogo'
import { chamar, ponte } from '../api'
import { fm, fn, num, pc, hoje } from '../format'
import { Ico } from '../icons'
import { useAcoes } from '../Shell'
import { useApp } from '../store'
import { Campo, Card, Modal, SelectComAdd, Tag, muted45, muted50, tagDeStatus } from '../ui'
import { ModalGerarProposta } from './ModalGerarProposta'
import { PickerItens } from './PickerItens'
import type { Orcamento as TipoOrcamento, OrcItem } from '../shared/types'

const estiloCelula = { minHeight: 22, padding: '1px 4px', fontSize: 13 }

export function Orcamento() {
  const app = useApp()
  const { db, motor, q, setQ, verCustos } = app
  const [clienteRapido, setClienteRapido] = useState(false)
  const [comparar, setComparar] = useState(false)
  const [erro, setErro] = useState('')
  const leitura = !!q.id && q.status !== 'Rascunho'
  const [etapa, setEtapa] = useState(leitura ? 3 : 1)
  const [picker, setPicker] = useState(false)
  const [salvando, setSalvando] = useState(false)
  usePendenciaAtualizacao('orçamento com alterações não salvas',!leitura&&app.rascunhos.some(r=>(r.id||r.rascunhoId)===(q.id||q.rascunhoId)),salvando)
  // Orçamento já gravado, aguardando a escolha dos documentos a emitir.
  const [gerado, setGerado] = useState<TipoOrcamento | null>(null)

  const t = useMemo(() => motor.calc(q), [motor, q])

  /** Grava e devolve o orçamento já com id e número definitivos. */
  const salvar = async (status?: typeof q.status): Promise<TipoOrcamento | null> => {
    if (salvando) return null
    if (!q.clienteId) { setEtapa(1); setErro('Escolha o cliente antes de salvar.'); return null }
    if (q.itens.some(i => !Number.isFinite(i.qtd) || i.qtd <= 0 || (i.larg ?? 0) < 0 || (i.alt ?? 0) < 0)) { setEtapa(2); setErro('Confira as quantidades e medidas: não podem ser negativas e a quantidade deve ser maior que zero.'); return null }
    if (status && status !== 'Rascunho' && !q.itens.length) { setEtapa(2); setErro('Insira pelo menos um produto antes de gerar a proposta.'); return null }
    setErro('')
    setSalvando(true)
    try {
      const gravado = await chamar(ponte().salvarOrcamento({ ...q, referenciaPrecos: q.referenciaPrecos ?? capturarPrecos(db, q.itens.map(it => it.matId)), ...(status ? { status } : {}) }))
      setQ(() => gravado)
      app.removerRascunho(q)
      app.removerRascunho(gravado)
      try { await app.recarregar() } catch { app.say('Gravado no servidor. Use Reconectar para atualizar a lista.'); return gravado }
      app.say(`${nomeProposta(gravado)} salvo`)
      return gravado
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar. Tente novamente; seus dados foram mantidos.')
      return null
    } finally {
      setSalvando(false)
    }
  }

  const gerar = async () => {
    if (leitura) { app.imprimir({ orcId: q.id, proposta: true, separacao: false }); return }
    const gravado = await salvar(q.status === 'Rascunho' ? 'Proposta' : q.status)
    if (gravado) setGerado(gravado)
  }

  useAcoes(
    <>
      {!leitura && <button className="btn btn-secondary" disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar rascunho'}</button>}
      {leitura && <button className="btn btn-secondary" disabled={salvando} onClick={async () => {
        setSalvando(true)
        try { app.abrirOrc({ ...structuredClone(q), origemId: q.id, rascunhoId: crypto.randomUUID(), id: '', rev: proxRev(q.rev), status: 'Rascunho', data: hoje(), vendedor: app.user.nome, enviadaEm: '' }) }
        catch (e) { app.say(e instanceof Error ? e.message : 'Falha ao criar revisão.') } finally { setSalvando(false) }
      }}>Criar revisão</button>}
      {leitura && <button className="btn btn-primary" disabled={salvando} onClick={() => void gerar()}>Visualizar PDF</button>}
    </>,
    [q, salvando, etapa]
  )

  const clienteEscolhido = db.clientes.some(c => c.id === q.clienteId)
  const instalador = db.instaladores.find(i => i.id === q.instaladorId)

  const alterarItem = (i: number, patch: Partial<OrcItem>) =>
    setQ(x => ({ ...x, itens: x.itens.map((it, k) => (k === i ? { ...it, ...patch } : it)) }))

  const inserirMaterial = (matId: string, qtd: number) => {
    const m = db.materiais.find(x => x.id === matId)
    if (!ehProduto(m)) return app.say('Adicione um produto pronto. Matérias-primas entram na composição do produto.')
    const cor = db.cores.find(c => c.id === m.corId)
    setQ(x => ({
      ...x,
      referenciaPrecos: ampliarReferencia(db, x, [matId]),
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
    return vistos.map(id => db.materiais.find(m => m.id === id)).filter(ehProduto).slice(-3)
  }, [q.itens, db.materiais])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button className="btn btn-ghost back-button" style={{alignSelf:'flex-start'}} onClick={()=>app.irPara('lista')}>← Orçamentos</button>
      <div className="budget-steps" aria-label="Etapas do orçamento">{['Cliente e obra','Produtos','Revisar e gerar'].map((nome,i)=><button key={nome} aria-current={etapa===i+1?'step':undefined} onClick={()=>setEtapa(i+1)}><span>{i+1}</span>{nome}</button>)}</div>
      {!leitura&&q.id&&<div className="notice">Ao salvar alterações, uma nova revisão será criada. {nomeProposta(q)} permanece no histórico.</div>}
      {leitura && <div className="notice">{nomeProposta(q)} · {q.status}. Esta revisão foi emitida. Crie uma revisão para alterar.</div>}
      {erro && <div className="notice warning" role="alert">{erro} <button className="btn btn-secondary" onClick={() => void salvar()}>Tentar salvar novamente</button></div>}
      <fieldset disabled={leitura || salvando} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div hidden={etapa!==1}>
      <Card
        titulo="Cliente e obra"
        direita={<span style={{ fontSize: 12, letterSpacing: '.02em', color: muted45 }}>{q.rev} · {q.data}</span>}
      >
        <div className="budget-form">
          <Campo label="Número (automático)">
            <div style={{
              minHeight: 27, display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--font-heading)', fontSize: 16, letterSpacing: '.01em'
            }}>
              {nomeProposta(q)}
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, letterSpacing: '.02em', color: muted45 }}>{q.rev}</span>
            </div>
          </Campo>

          <Campo label="Cliente *" span={2} erro={!q.clienteId && erro ? 'Escolha ou cadastre um cliente.' : undefined}>
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
            {app.pode('clientes') && <button className="btn btn-ghost" onClick={() => setClienteRapido(true)}>+ Cadastrar cliente</button>}
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

          <Campo label="Situação">
            <div style={{ height: 27, display: 'flex', alignItems: 'center' }}>
              <Tag tipo={tagDeStatus(q.status)}>{q.status}</Tag>
            </div>
          </Campo>
        </div>
      </Card>

      </div>
      {/* Produtos e condições comerciais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <div className="card" hidden={etapa!==2} style={{ minWidth: 0 }}>
          <div className="cardhead" style={{ height: 32 }}>
            <span className="cardtitle">Produtos desta obra</span>
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
            >+ Inserir produto</button>
          </div>

          {t.rows.map(r=><div className="budget-product" key={r.i}>
            {r.m?.imgData||r.m?.img?<img className="product-art" src={r.m.imgData||`assets/${r.m.img}.png`} alt={r.m.desc}/>:<div className="product-art" style={{display:'grid',placeItems:'center'}}>{Ico.itens(36)}</div>}
            <div><h3>{r.it.desc??r.m?.desc??'Produto'}</h3><small>{r.m?.cod} · {r.m?.serie}</small>
              <div className="product-dimensions">
                <label>Largura (mm)<input className="input" type="number" min="0" aria-label={`Largura da linha ${r.i+1}`} value={r.it.larg??r.m?.larg??0} onChange={e=>alterarItem(r.i,{larg:num(e.target.value)})}/></label>
                <label>Altura (mm)<input className="input" type="number" min="0" aria-label={`Altura da linha ${r.i+1}`} value={r.it.alt??r.m?.alt??0} onChange={e=>alterarItem(r.i,{alt:num(e.target.value)})}/></label>
                <label>Quantidade<input className="input" type="number" min="1" aria-label={`Quantidade da linha ${r.i+1}`} value={r.it.qtd} onChange={e=>alterarItem(r.i,{qtd:num(e.target.value)})}/></label>
              </div>
              <details className="product-details"><summary>Descrição, local e preço</summary><div className="product-details-grid">
                <Campo label={`Descrição da linha ${r.i+1}`}><input className="input" value={r.it.desc??r.m?.desc??''} onChange={e=>alterarItem(r.i,{desc:e.target.value})}/></Campo>
                <Campo label={`Local da linha ${r.i+1}`}><input className="input" placeholder="Ex.: sala" value={r.it.local} onChange={e=>alterarItem(r.i,{local:e.target.value})}/></Campo>
                <Campo label={`Markup da linha ${r.i+1}`}><input className="input" type="number" value={r.mkuPct} onChange={e=>alterarItem(r.i,{markup:num(e.target.value)})}/></Campo>
                <div><small>Unitário: {fm(r.unit)}<br/>{fn(r.im2,2)} m² · {fn(r.ikg,1)} kg</small></div>
              </div></details>
            </div>
            <div className="product-price"><small>Subtotal</small><strong>{fm(r.venda)}</strong><div style={{display:'flex',gap:6,marginTop:16}}><button className="btn btn-ghost" title="Duplicar linha" onClick={()=>setQ(x=>({...x,itens:[...x.itens.slice(0,r.i+1),structuredClone(x.itens[r.i]),...x.itens.slice(r.i+1)]}))}>{Ico.dup()}</button><button className="btn btn-ghost" title="Excluir linha" onClick={()=>setQ(x=>({...x,itens:x.itens.filter((_,k)=>k!==r.i)}))}>{Ico.del()}</button></div></div>
          </div>)}
          <div className="toolbar" style={{padding:'18px 24px',borderTop:'1px solid var(--color-divider)'}}><small style={{flex:1}}>Os insumos são calculados pela composição dos produtos.</small><strong className="tnum">{fm(t.vendaMat)}</strong></div>
          {!q.itens.length && (
            <div style={{ padding: '30px 12px', textAlign: 'center', fontSize: 13, color: muted45 }}>
              Nenhum produto adicionado. Clique em <strong>Inserir produto</strong> para escolher portas, janelas e outros produtos de venda.
            </div>
          )}
        </div>

        <div hidden={etapa!==3}>
          <div className="budget-review"><Card titulo="Condições comerciais"><div className="budget-form">
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

          </div><div style={{padding:'0 22px 22px'}}><strong>{db.clientes.find(c=>c.id===q.clienteId)?.nome||'Cliente a definir'}</strong><p className="muted">{q.obra||'Obra a definir'} · {q.cidade}</p><button className="btn btn-ghost" onClick={()=>setEtapa(1)}>Editar dados da obra</button></div></Card>
          <aside className="review-summary"><small>Total da proposta</small><strong className="tnum">{fm(t.total)}</strong><p><span>Produtos</span><b>{fn(t.pecas,0)} peças</b></p><p><span>Desconto</span><b>{pc(q.desconto)}</b></p><p><span>Instalação e encargos</span><b>{fm(t.mo)}</b></p>{verCustos&&<><hr/><p><span>Margem estimada</span><b style={{color:t.margemPct<0?'var(--brand-red)':undefined}}>{pc(t.margemPct)}</b></p><small>Informação interna, não aparece no PDF.</small></>}</aside></div>

        <div className="budget-details">
          <details><summary>Margem, impostos e descontos</summary><Card titulo="Fechamento" altura={29}>
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

          </details><details><summary>Instalação e encargos</summary><Card titulo="Instalação e encargos" altura={29}>
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

          </details><details><summary>Apuração detalhada</summary><Card titulo="Apuração" altura={29}>
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
          </Card></details>
        </div>
        </div>
      </div>
      </fieldset>
      <div className="budget-footer"><small role="status">{salvando?'Salvando no servidor…':leitura?'Revisão emitida · valores preservados':'Rascunho · alterações protegidas localmente ao editar'}</small><div>{etapa>1&&<button className="btn btn-secondary" onClick={()=>setEtapa(x=>x-1)}>Voltar</button>}{etapa<3?<button className="btn btn-primary" onClick={()=>setEtapa(x=>x+1)}>Continuar →</button>:<button className="btn btn-primary" disabled={salvando} onClick={()=>void gerar()}>{leitura?'Visualizar PDF':'Gerar proposta'}</button>}</div></div>
      {!leitura&&etapa===3&&<details><summary>Atualizar os custos deste rascunho</summary><p className="muted">{q.referenciaPrecos?`Preços preservados em ${new Date(q.referenciaPrecos.capturadoEm).toLocaleDateString('pt-BR')}`:'Preços atuais do catálogo'}</p><button className="btn btn-secondary" onClick={()=>setComparar(true)}>Recalcular com preços atuais</button></details>}


      {clienteRapido && <ClienteRapido onFechar={() => setClienteRapido(false)} onCriado={c => { setQ(x => ({ ...x, clienteId: c.id, cidade: c.cidade, contato: c.contato })); setClienteRapido(false) }} />}
      {comparar && <Modal titulo="Comparar com os preços atuais" onFechar={() => setComparar(false)}>
        <p>Confira o efeito de atualizar custos, acabamentos, ferragens e composição deste rascunho. Medidas, quantidades e condições comerciais serão mantidas.</p>
        <table className="table"><thead><tr><th>Indicador</th><th>Preservado</th><th>Atual</th><th>Diferença</th></tr></thead><tbody>
          {(['custoTotal', 'total', 'margem'] as const).map((k, i) => { const atual = motor.calc({ ...q, referenciaPrecos: undefined }); return <tr key={k}><td>{['Custo total', 'Valor da proposta', 'Margem em reais'][i]}</td><td>{fm(t[k])}</td><td>{fm(atual[k])}</td><td>{fm(atual[k] - t[k])}</td></tr> })}
        </tbody></table><div className="toolbar"><button className="btn btn-primary" onClick={() => { setQ(x => ({ ...x, referenciaPrecos: capturarPrecos(db, q.itens.map(it => it.matId)) })); setComparar(false); app.say('Preços atuais aplicados ao rascunho. Salve para gravar a alteração.') }}>Aplicar ao rascunho</button><button className="btn btn-secondary" onClick={() => setComparar(false)}>Manter valores</button></div>
      </Modal>}
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
        aria-label={p.label} className="input tnum" type="number"
        style={{ width: p.largura ?? 76, minHeight: 24, padding: '1px 6px', fontSize: 13, textAlign: 'right' }}
        value={p.valor}
        onChange={e => p.onChange(num(e.target.value))}
      />
      {p.un !== undefined && <span style={{ width: 14, fontSize: 12, color: muted45 }}>{p.un}</span>}
    </div>
  )
}
