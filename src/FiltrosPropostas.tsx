import { useMemo, useState } from 'react'
import { dataISO, propostasVigentes } from './historico'
import type { Orcamento } from './shared/types'
import { Campo } from './ui'

export function useFiltroPropostas(todas: Orcamento[]) {
  const [de, setDe] = useState(''), [ate, setAte] = useState(''), [vendedor, setVendedor] = useState(''), [status, setStatus] = useState('')
  const lista = useMemo(() => propostasVigentes(todas).filter(o => (!de || dataISO(o.data) >= de) && (!ate || dataISO(o.data) <= ate) && (!vendedor || o.vendedor === vendedor) && (!status || o.status === status)), [todas, de, ate, vendedor, status])
  const filtros = <div className="filters">
    <Campo label="De"><input className="input" type="date" value={de} onChange={e => setDe(e.target.value)} /></Campo>
    <Campo label="Até"><input className="input" type="date" value={ate} min={de} onChange={e => setAte(e.target.value)} /></Campo>
    <Campo label="Vendedor"><select className="input" value={vendedor} onChange={e => setVendedor(e.target.value)}><option value="">Todos</option>{[...new Set(todas.map(o => o.vendedor))].sort().map(v => <option key={v}>{v}</option>)}</select></Campo>
    <Campo label="Situação"><select className="input" value={status} onChange={e => setStatus(e.target.value)}><option value="">Todas</option>{['Rascunho', 'Proposta', 'Em análise', 'Aprovado', 'Perdido'].map(v => <option key={v}>{v}</option>)}</select></Campo>
    <button className="btn btn-ghost" onClick={() => { setDe(''); setAte(''); setVendedor(''); setStatus('') }}>Limpar filtros</button>
    <span style={{ fontSize: 12, color: '#5f6368' }}>{lista.length} oportunidades · somente a última revisão de cada número</span>
  </div>
  return { lista, filtros, status, setStatus }
}
