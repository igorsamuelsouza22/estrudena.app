import { nomeProposta } from '../shared/types'
import { useState } from 'react'
import { proxRev } from '../calc'
import { fm, hoje } from '../format'
import { numeroRev } from '../historico'
import { useFiltroPropostas } from '../FiltrosPropostas'
import { useApp } from '../store'
import { Tag, Vazio } from '../ui'
import { AcoesProposta } from './AcoesProposta'
import type { Orcamento } from '../shared/types'

export function Propostas() {
  const app = useApp()
  const { db, motor, verCustos } = app
  const { lista: vigentes, filtros, status, setStatus } = useFiltroPropostas(db.orcamentos)
  const [aberta, setAberta] = useState('')
  const [busca, setBusca] = useState('')
  const [expandidas, setExpandidas] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(false)
  const lista = vigentes.filter(o => [o.numero, o.obra, db.clientes.find(c => c.id === o.clienteId)?.nome].join(' ').toLowerCase().includes(busca.toLowerCase()))
  const revisar = async (o: Orcamento) => {
    setOcupado(true)
    try {
      app.abrirOrc({ ...structuredClone(o), origemId: o.id, rascunhoId: crypto.randomUUID(), id: '', rev: proxRev(o.rev), status: 'Rascunho', data: hoje(), vendedor: app.user.nome, enviadaEm: '' })
    } catch (e) { app.say(e instanceof Error ? e.message : 'Falha ao criar revisão. Tente novamente.') }
    finally { setOcupado(false) }
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {!aberta&&<><div className="tabs" style={{margin:'0 0 12px'}} role="tablist" aria-label="Situação dos orçamentos">{[['','Todos'],['Rascunho','Rascunhos'],['Proposta','Emitidos'],['Enviada','Enviados'],['Em análise','Em análise'],['Expirada','Expirados'],['Aprovado','Aprovados'],['Perdido','Perdidos']].map(([key,label])=><button key={key} className="btn btn-ghost" role="tab" aria-selected={status===key} onClick={()=>setStatus(key)}>{label}</button>)}</div><details><summary>Filtrar por período e vendedor</summary>{filtros}</details></>}
    {aberta&&<button className="btn btn-ghost back-button" style={{alignSelf:'flex-start'}} onClick={()=>setAberta('')}>← Voltar aos orçamentos</button>}
    <div className="toolbar" hidden={!!aberta}><input className="input" style={{ maxWidth: 380 }} aria-label="Filtrar propostas" placeholder="Número, cliente ou obra" value={busca} onChange={e => setBusca(e.target.value)} />
      <span style={{ flex: 1 }}>{lista.length} oportunidades{verCustos ? ` · ${fm(lista.reduce((s, o) => s + motor.calc(o).total, 0))}` : ''}</span>
      {verCustos && <button className="btn btn-primary" onClick={() => app.novoOrc()}>+ Novo orçamento</button>}
    </div>
    {!lista.length && <Vazio>Nenhuma proposta com esses filtros. Limpe os filtros ou crie um orçamento.</Vazio>}
    {!aberta&&!!lista.length&&<div className="card" style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Orçamento / cliente</th><th>Situação</th>{verCustos&&<th style={{textAlign:'right'}}>Valor</th>}<th/></tr></thead><tbody>{lista.map(o=><tr key={o.id}><td><strong>{nomeProposta(o)} · {db.clientes.find(c=>c.id===o.clienteId)?.nome||'Cliente a definir'}</strong><div className="muted" style={{fontSize:12,marginTop:5}}>{o.obra||'Obra a definir'} · {o.rev}</div></td><td><Tag>{o.status}</Tag></td>{verCustos&&<td className="tnum" style={{textAlign:'right',whiteSpace:'nowrap'}}>{fm(motor.calc(o).total)}</td>}<td><button className="btn btn-ghost" aria-label={`Abrir orçamento ${o.numero}`} onClick={()=>setAberta(o.id)}>Abrir ↗</button></td></tr>)}</tbody></table></div>}
    {db.orcamentos.filter(o=>o.id===aberta).map(vigente => {
      const historico = db.orcamentos.filter(o => o.numero === vigente.numero && o.id !== vigente.id).sort((a, b) => numeroRev(b.rev) - numeroRev(a.rev))
      const abertas = expandidas.includes(vigente.numero)
      return <section className="card" key={vigente.id} aria-label={`Proposta ${vigente.numero}`}>
        {[vigente, ...(abertas ? historico : [])].map((o, i) => <div key={o.id} style={{ padding: '16px 18px', background: i ? '#f8f9fa' : '#fff', borderTop: i ? '1px solid #e8eaed' : undefined }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}><strong style={{ fontSize: 16 }}>{nomeProposta(o)}</strong> <Tag>{i ? 'Histórico' : 'Última revisão'}</Tag>
              <div style={{ paddingTop: 6 }}>{db.clientes.find(c => c.id === o.clienteId)?.nome ?? 'Cliente não informado'} · {o.obra || 'Obra não informada'}</div>
              <small style={{ color: '#5f6368' }}>{o.data} · {o.vendedor} · {o.itens.length} produtos</small>
            </div>
            {verCustos && <strong className="tnum" style={{ fontSize: 21 }}>{fm(motor.calc(o).total)}</strong>}
            <Tag>{o.status}</Tag>
          </div>
          <div className="toolbar">
            {verCustos && <>
              <button className="btn btn-secondary" onClick={() => app.abrirOrc(o)}>{o.status === 'Rascunho' ? 'Editar rascunho' : 'Abrir'}</button>
              <button className="btn btn-ghost" disabled={ocupado} onClick={() => void revisar(o)}>Criar revisão</button>
              <button className="btn btn-ghost" onClick={() => app.imprimir({ orcId: o.id, proposta: true, separacao: false })}>Visualizar PDF</button>
              {!i && <AcoesProposta o={o} />}
            </>}
            {app.pode('producao')&&db.pedidos?.some(p=>p.orcamentoId===o.id&&['Materiais pendentes','Em separação'].includes(p.etapa)) && <button className="btn btn-ghost" onClick={() => { app.setSepId(o.id); app.irPara('separacao') }}>Abrir separação</button>}

            {!i && !!historico.length && <button className="btn btn-ghost" aria-expanded={abertas} onClick={() => setExpandidas(v => abertas ? v.filter(n => n !== o.numero) : [...v, o.numero])}>{abertas ? 'Ocultar' : 'Ver'} {historico.length} revisões anteriores</button>}
          </div>
        </div>)}
      </section>
    })}
  </div>
}
