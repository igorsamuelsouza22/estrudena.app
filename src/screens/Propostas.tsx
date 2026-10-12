import { nomeProposta } from '../shared/types'
import { useState } from 'react'
import { fm } from '../format'
import { GRUPOS_SITUACAO, useFiltroPropostas } from '../FiltrosPropostas'
import { useApp } from '../store'
import { StatusTag, Vazio } from '../ui'

export function Propostas() {
  const app = useApp()
  const { db, motor, verCustos } = app
  const { lista: vigentes, filtros, status, setStatus } = useFiltroPropostas(db.orcamentos, { inicial: 'abertos' })
  const [busca, setBusca] = useState('')
  const lista = vigentes.filter(o => [o.numero, o.obra, db.clientes.find(c => c.id === o.clienteId)?.nome].join(' ').toLowerCase().includes(busca.toLowerCase()))
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div className="tabs" style={{ margin: '0 0 12px' }} role="tablist" aria-label="Situação dos orçamentos">{GRUPOS_SITUACAO.map(([key, label]) => <button key={key} className="btn btn-ghost" role="tab" aria-selected={status === key} onClick={() => setStatus(key)}>{label}</button>)}</div>
    <div className="toolbar"><input className="input" style={{ maxWidth: 380 }} aria-label="Filtrar propostas" placeholder="Número, cliente ou obra" value={busca} onChange={e => setBusca(e.target.value)} />
      <span style={{ flex: 1 }}>{lista.length} {lista.length === 1 ? 'orçamento' : 'orçamentos'}{verCustos ? ` · ${fm(lista.reduce((s, o) => s + motor.calc(o).total, 0))}` : ''}</span>
      {verCustos && <button className="btn btn-primary" onClick={() => app.novoOrc()}>+ Novo orçamento</button>}
    </div>
    <details><summary>Filtrar por período e vendedor</summary>{filtros}</details>
    {!lista.length ? <Vazio>Nenhum orçamento com esses filtros.</Vazio> : <div className="card" style={{ overflowX: 'auto' }}><table className="table"><thead><tr><th>Orçamento / cliente</th><th>Situação</th>{verCustos && <th style={{ textAlign: 'right' }}>Valor</th>}<th /></tr></thead><tbody>{lista.map(o => <tr key={o.id}>
      <td><strong>{nomeProposta(o)} · {db.clientes.find(c => c.id === o.clienteId)?.nome || 'Cliente a definir'}</strong><div className="muted" style={{ fontSize: 12, marginTop: 5 }}>{o.obra || 'Obra a definir'}</div></td>
      <td><StatusTag status={o.status} /></td>
      {verCustos && <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm(motor.calc(o).total)}</td>}
      <td><button className="btn btn-ghost" aria-label={`Abrir orçamento ${o.numero}`} onClick={() => app.abrirOrc(o)}>Abrir ↗</button></td>
    </tr>)}</tbody></table></div>}
  </div>
}
