import { necessidadesProducao } from '../producao'
import { useMemo, useState } from 'react'
import { chamar, ponte } from '../api'
import { fn, hoje, num } from '../format'
import { unidadeLabel } from '../catalogo'
import { catalogoDoPedido, propostasVigentes } from '../historico'
import { guardarLocal, lerLocal } from '../rascunhos'
import { useAcoes } from '../Shell'
import { SEP_VAZIA, useApp } from '../store'
import { Barra, Campo, Card, Tag, Vazio, BotaoExcluir } from '../ui'
import type { Separacao as Sep, Orcamento } from '../shared/types'

export function Separacao() {
  const app = useApp()
  const { db, motor } = app
  const [filtro, setFiltro] = useState('')
  const [somentePendentes, setSomentePendentes] = useState(true)
  const [aba, setAba] = useState('Produtos')
  const chave = `estrudena:producao:${app.user.id}`
  const [rascunhos, setRascunhos] = useState<Record<string, Sep>>(() => lerLocal(chave, {}))
  const [erroLocal, setErroLocal] = useState(false)
  // Revisões ainda em negociação não substituem uma ordem já aprovada na fábrica.
  const elegiveis = (db.pedidos || []).filter(p=>!['Cancelado','Concluído'].includes(p.status)&&['Materiais pendentes','Em separação'].includes(p.etapa)).map(p=>({...p.proposta, entregaPrevista:p.entregaPrevista, prioridade:p.prioridade}))
  const pedidos = elegiveis.filter(o => (!somentePendentes || db.separacoes[o.id]?.status !== 'Concluída') && [o.numero, o.obra, db.clientes.find(c => c.id === o.clienteId)?.nome].join(' ').toLowerCase().includes(filtro.toLowerCase()))
    .sort((a, b) => ({ Urgente: 0, Alta: 1, Normal: 2 }[a.prioridade ?? 'Normal'] - { Urgente: 0, Alta: 1, Normal: 2 }[b.prioridade ?? 'Normal']) || (a.entregaPrevista || '9999').localeCompare(b.entregaPrevista || '9999'))
  const o = elegiveis.find(x => x.id === app.sepId)
  const salva = o ? db.separacoes[o.id] ?? SEP_VAZIA : SEP_VAZIA
  const sep = o ? rascunhos[o.id] ?? salva : salva
  const pendente = JSON.stringify(sep) !== JSON.stringify(salva)
  const c = useMemo(() => o ? motor.calc(o) : null, [o, motor])
  const catalogo = o ? catalogoDoPedido(db, o) : db
  const {materiais,ferragens} = o ? necessidadesProducao(db,o) : {materiais:[],ferragens:[]}
  const alterar = (patch: Partial<Sep>) => { if (!o) return; setRascunhos(ant => { const prox = { ...ant, [o.id]: { ...sep, ...patch } }; setErroLocal(!guardarLocal(chave, prox)); return prox }) }
  const salvar = async (patch: Partial<Sep> = {}) => {
    if (!o) return
    const novo = { ...sep, ...patch }; alterar(patch)
    if (await app.gravar(() => chamar(ponte().salvarSeparacao(o.id, novo)), 'Conferência salva')) {
      setRascunhos(ant => { const prox = { ...ant }; delete prox[o.id]; guardarLocal(chave, prox); return prox })
    }
  }
  const planejar = async (patch: Partial<Orcamento>) => { const p = db.pedidos?.find(p=>p.orcamentoId===o?.id); if(p) await app.gravar(()=>chamar(ponte().negocio({acao:'planejar',id:p.id,versao:p.versao,data:patch.entregaPrevista||p.entregaPrevista,prioridade:patch.prioridade||p.prioridade})), 'Planejamento atualizado') }
  useAcoes(o ? <button className="btn btn-primary" onClick={() => app.imprimir({ orcId: o.id, proposta: false, separacao: true })}>Visualizar pedido em PDF</button> : null, [o?.id])
  const concluirProdutos = (c?.rows ?? []).every(r => (sep.conf[r.i] ?? 0) >= r.qtd)
  const concluirInsumos = materiais.every(x => (sep.insumos?.['mp:' + x.material.id] ?? 0) + 0.00001 >= x.qtd) && ferragens.every(x => (sep.insumos?.['ac:' + x.a!.id] ?? 0) + 0.00001 >= x.qtd)
  const total = (c?.rows ?? []).reduce((s, r) => s + r.qtd, 0)
  const feito = (c?.rows ?? []).reduce((s, r) => s + Math.min(r.qtd, sep.conf[r.i] ?? 0), 0)
  const conferirInsumo = (id: string, v: number, max: number) => alterar({ insumos: { ...sep.insumos, [id]: Math.max(0, Math.min(max, v)) } })
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    {!app.sepId&&<Card titulo="Pedidos na fábrica" direita={<label><input type="checkbox" checked={somentePendentes} onChange={e => setSomentePendentes(e.target.checked)} /> Somente pendentes</label>}>
      <div style={{ padding: 12 }}><input className="input" aria-label="Filtrar pedidos" placeholder="Número, cliente ou obra" value={filtro} onChange={e => setFiltro(e.target.value)} /></div>
      <div>{pedidos.map(d => <button key={d.id} className={'search-result linha' + (o?.id === d.id ? ' sel' : '')} onClick={() => app.setSepId(d.id)}>
        <strong>{d.numero} · {d.rev}</strong><span style={{ flex: 1 }}>{d.obra || db.clientes.find(c => c.id === d.clienteId)?.nome}</span><small>{d.entregaPrevista ? `Entrega ${d.entregaPrevista.split('-').reverse().join('/')}` : 'Sem data definida'}</small><Tag>{d.prioridade ?? 'Normal'}</Tag><Tag>{db.separacoes[d.id]?.status ?? 'Pendente'}</Tag>
      </button>)}</div>
    </Card>}
    {o&&<button className="btn btn-secondary" style={{alignSelf:'flex-start'}} onClick={()=>app.irPara('pedidos',db.pedidos?.find(p=>p.orcamentoId===o.id)?.id)}>Ver etapas do pedido →</button>}
    {app.sepId&&<button className="btn btn-ghost back-button" style={{alignSelf:'flex-start'}} onClick={()=>app.setSepId('')}>← Fila de produção</button>}
    {!o || !c ? (!pedidos.length?<Vazio>Nenhum pedido aprovado com estes filtros.</Vazio>:null) : <>
      <fieldset disabled={app.gravando} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <Card titulo={`${o.numero} · ${o.obra || 'Pedido de produção'}`} direita={<Tag>{sep.status}</Tag>}>
          <div className="toolbar" style={{ padding: 16 }}>
            <Campo label="Entrega prevista"><input className="input" type="date" disabled={!app.pode('planejamento')} value={o.entregaPrevista ?? ''} onChange={e => void planejar({ entregaPrevista: e.target.value })} /></Campo>
            <Campo label="Prioridade"><select className="input" disabled={!app.pode('planejamento')} value={o.prioridade ?? 'Normal'} onChange={e => void planejar({ prioridade: e.target.value as Orcamento['prioridade'] })}>{['Normal', 'Alta', 'Urgente'].map(v => <option key={v}>{v}</option>)}</select></Campo>
            <Campo label="Conferente"><input className="input" value={sep.responsavel} onChange={e => alterar({ responsavel: e.target.value })} /></Campo>
            <Campo label="Observações da produção"><input className="input" value={sep.obs} onChange={e => alterar({ obs: e.target.value })} /></Campo>
          </div>
          <div style={{ padding: '0 16px 16px' }}><div className="toolbar"><strong>{fn(feito, 0)} de {fn(total, 0)} produtos conferidos</strong><span role="status" style={{ flex: 1, fontSize: 12 }}>{erroLocal ? 'Cópia local indisponível. Salve antes de sair.' : pendente ? 'Conferência pendente · cópia local protegida' : 'Conferência salva no servidor'}</span>
            <button className="btn btn-primary" onClick={() => void salvar()}>{app.gravando ? 'Salvando…' : 'Salvar conferência'}</button>
            {sep.status === 'Pendente' && <button className="btn btn-secondary" onClick={() => void salvar({ status: 'Em separação', iniciado: hoje() })}>Iniciar separação</button>}
            {sep.status === 'Em separação' && <button className="btn btn-secondary" disabled={!concluirProdutos || !concluirInsumos} title="Confira todos os produtos, matérias-primas e ferragens para concluir" onClick={() => void salvar({ status: 'Concluída', concluido: hoje() })}>Concluir separação</button>}
            {sep.status === 'Concluída' && <button className="btn btn-secondary" onClick={() => void salvar({ status: 'Em separação', concluido: '' })}>Reabrir</button>}
          </div><Barra pct={total ? feito / total * 100 : 0} /></div>
        </Card>
        <div className="tabs" role="tablist" aria-label="Conferência de produção">{['Produtos', 'Matérias-primas', 'Ferragens'].map(a => <button className="btn btn-ghost" role="tab" aria-selected={aba === a} key={a} onClick={() => setAba(a)}>{a} ({a === 'Produtos' ? c.rows.length : a === 'Matérias-primas' ? materiais.length : ferragens.length})</button>)}</div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table"><thead><tr><th>Código / descrição</th><th>{aba === 'Produtos' ? 'Medidas (mm)' : 'Unidade'}</th><th>Pedido</th><th>Conferido</th><th>Falta</th><th /></tr></thead><tbody>
            {aba === 'Produtos' ? c.rows.map(r => { const feito = sep.conf[r.i] ?? 0; return <tr key={r.i}><td><strong>{r.m?.cod}</strong> · {r.it.desc ?? r.m?.desc}<br /><small>{r.it.local}</small></td><td>{fn(r.L, 0)} × {fn(r.H, 0)}</td><td>{fn(r.qtd, 0)}</td><td><input className="input" aria-label={`Conferido produto ${r.i + 1}`} style={{ width: 100 }} type="number" min="0" max={r.qtd} value={feito} onChange={e => alterar({ conf: { ...sep.conf, [r.i]: Math.max(0, Math.min(r.qtd, num(e.target.value))) } })} /></td><td>{fn(Math.max(0, r.qtd - feito), 0)}</td><td><button className="btn btn-secondary" onClick={() => alterar({ conf: { ...sep.conf, [r.i]: r.qtd } })}>Conferir tudo</button></td></tr> })
              : (aba === 'Matérias-primas' ? materiais.map(x => ({ id: 'mp:' + x.material.id, cod: x.material.cod, nome: x.material.desc, un: unidadeLabel(x.material.unidade), qtd: x.qtd })) : ferragens.map(x => ({ id: 'ac:' + x.a!.id, cod: x.a!.cod, nome: x.a!.nome, un: x.a!.unidade, qtd: x.qtd }))).map(x => <tr key={x.id}><td><strong>{x.cod}</strong> · {x.nome}</td><td>{x.un}</td><td>{fn(x.qtd, 3)}</td><td><input className="input" style={{ width: 100 }} type="number" step="0.001" min="0" max={x.qtd} aria-label={`Conferido ${x.cod}`} value={sep.insumos?.[x.id] ?? 0} onChange={e => conferirInsumo(x.id, num(e.target.value), x.qtd)} /></td><td>{fn(Math.max(0, x.qtd - (sep.insumos?.[x.id] ?? 0)), 3)}</td><td><button className="btn btn-secondary" onClick={() => conferirInsumo(x.id, x.qtd, x.qtd)}>Conferir tudo</button></td></tr>)}
          </tbody></table>
          {(aba === 'Matérias-primas' && !materiais.length || aba === 'Ferragens' && !ferragens.length) && <Vazio>Nenhum consumo cadastrado nesta categoria. Confira a composição dos produtos quando necessário.</Vazio>}
        </div>
        <div className="toolbar"><small>Quantidades previstas antes de perdas. Salve a conferência para compartilhar com a equipe.</small><div style={{ flex: 1 }} /><BotaoExcluir rotulo="Zerar conferência" titulo="Zerar toda a conferência" onConfirma={() => alterar({ conf: {}, insumos: {} })} /></div>
      </fieldset>
    </>}
  </div>
}
