import { useMemo, useState } from 'react'
import { dataISO, propostasVigentes } from './historico'
import type { Orcamento, StatusOrc } from './shared/types'
import { Campo } from './ui'

/** As situações gravadas, agrupadas como a equipe pergunta por elas. */
export const GRUPOS_SITUACAO: [string, string, StatusOrc[]][] = [
  ['abertos', 'Em aberto', ['Rascunho', 'Proposta', 'Enviada']],
  ['aprovados', 'Aprovados', ['Aprovado']],
  ['perdidos', 'Perdidos', ['Perdido', 'Expirada']],
  ['', 'Todos', []]
]

export function useFiltroPropostas(todas: Orcamento[], opcoes: { inicial?: string; comSituacao?: boolean } = {}) {
  const [de, setDe] = useState(''), [ate, setAte] = useState(''), [vendedor, setVendedor] = useState(''), [status, setStatus] = useState(opcoes.inicial ?? '')
  const grupo = GRUPOS_SITUACAO.find(g => g[0] === status)?.[2] ?? []
  const lista = useMemo(() => propostasVigentes(todas).filter(o => (!de || dataISO(o.data) >= de) && (!ate || dataISO(o.data) <= ate) && (!vendedor || o.vendedor === vendedor) && (!grupo.length || grupo.includes(o.status))), [todas, de, ate, vendedor, grupo])
  const filtros = <div className="filters">
    <Campo label="De"><input className="input" type="date" value={de} onChange={e => setDe(e.target.value)} /></Campo>
    <Campo label="Até"><input className="input" type="date" value={ate} min={de} onChange={e => setAte(e.target.value)} /></Campo>
    <Campo label="Vendedor"><select className="input" value={vendedor} onChange={e => setVendedor(e.target.value)}><option value="">Todos</option>{[...new Set(todas.map(o => o.vendedor))].sort().map(v => <option key={v}>{v}</option>)}</select></Campo>
    {opcoes.comSituacao && <Campo label="Situação"><select className="input" value={status} onChange={e => setStatus(e.target.value)}>{GRUPOS_SITUACAO.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Campo>}
    <button className="btn btn-ghost" onClick={() => { setDe(''); setAte(''); setVendedor(''); if (opcoes.comSituacao) setStatus('') }}>Limpar filtros</button>
  </div>
  return { lista, filtros, status, setStatus }
}
