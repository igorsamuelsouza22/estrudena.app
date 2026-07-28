import { useMemo, useState } from 'react'
import { chamar, ponte } from '../api'
import { proxRev } from '../calc'
import { fm, fn, hoje, pc } from '../format'
import { useApp } from '../store'
import { BotaoExcluir, Seg, Tag, muted45, tagDeStatus } from '../ui'
import type { StatusOrc } from '../shared/types'

const FILTROS: { id: string; label: string }[] = [
  { id: 'TODOS', label: 'Todas' },
  { id: 'Rascunho', label: 'Rascunho' },
  { id: 'Proposta', label: 'Proposta' },
  { id: 'Em análise', label: 'Em análise' },
  { id: 'Aprovado', label: 'Aprovado' },
  { id: 'Perdido', label: 'Perdido' }
]

export function Propostas() {
  const app = useApp()
  const { db, motor, verCustos } = app
  const [filtro, setFiltro] = useState('')
  const [situacao, setSituacao] = useState('TODOS')

  const lista = useMemo(() => {
    const t = filtro.trim().toLowerCase()
    return db.orcamentos.filter(o => {
      if (situacao !== 'TODOS' && o.status !== situacao) return false
      if (!t) return true
      const cliente = db.clientes.find(c => c.id === o.clienteId)?.nome ?? ''
      return [o.numero, cliente, o.obra].join(' ').toLowerCase().includes(t)
    })
  }, [db.orcamentos, db.clientes, filtro, situacao])

  const calcs = useMemo(
    () => new Map(lista.map(o => [o.id, motor.calc(o)])),
    [lista, motor]
  )

  const totalVenda = lista.reduce((a, o) => a + (calcs.get(o.id)?.total ?? 0), 0)

  /** "Editar" duplica o orçamento inteiro subindo a REV e volta a Rascunho. */
  const revisar = async (id: string) => {
    const o = db.orcamentos.find(x => x.id === id)
    if (!o) return
    const novo = {
      ...structuredClone(o),
      id: '', rev: proxRev(o.rev), status: 'Rascunho' as StatusOrc,
      data: hoje(), vendedor: app.user.nome, enviadaEm: ''
    }
    // O número vai junto: a revisão pertence ao mesmo pedido, só sobe a REV.
    const gravado = await chamar(ponte().salvarOrcamento(novo))
    await app.recarregar()
    app.abrirOrc(gravado)
    app.say(`Duplicada como ${gravado.numero} ${gravado.rev}`)
  }

  return (
    <div className="card">
      <div className="cardhead" style={{ height: 36, gap: 9 }}>
        <input
          className="input" style={{ maxWidth: 230, minHeight: 25, padding: '2px 7px', fontSize: 13 }}
          placeholder="Filtrar nº, cliente ou obra"
          value={filtro} onChange={e => setFiltro(e.target.value)}
        />
        <Seg style={{ background: 'var(--color-bg)' }} opcoes={FILTROS} valor={situacao} onPick={setSituacao} />
        <div style={{ flex: 1 }} />
        <span className="tnum" style={{ fontSize: 12, letterSpacing: '.01em', color: muted45 }}>
          {lista.length} propostas{verCustos ? ` · ${fm(totalVenda)}` : ''}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ minWidth: verCustos ? 1330 : 1000, fontSize: 13 }}>
          <thead><tr>
            <th style={{ paddingLeft: 11 }}>Nº</th>
            <th>Revisão</th>
            <th>Cliente / obra</th>
            <th>Vendedor</th>
            <th>Data</th>
            <th style={{ textAlign: 'right' }}>Itens</th>
            <th style={{ textAlign: 'right' }}>m²</th>
            <th style={{ textAlign: 'right' }}>kg</th>
            {verCustos && <th style={{ textAlign: 'right' }}>Venda</th>}
            {verCustos && <th style={{ textAlign: 'right' }}>Custo</th>}
            {verCustos && <th style={{ textAlign: 'right' }}>Margem</th>}
            <th>Situação</th>
            <th style={{ paddingRight: 11 }} />
          </tr></thead>
          <tbody>
            {lista.map(o => {
              const c = calcs.get(o.id)!
              const cliente = db.clientes.find(x => x.id === o.clienteId)?.nome ?? '—'
              return (
                <tr key={o.id}>
                  <td style={{ paddingLeft: 11, fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap' }}>{o.numero}</td>
                  <td style={{ fontSize: 12, color: 'color-mix(in srgb, var(--color-text) 50%, transparent)', whiteSpace: 'nowrap' }}>{o.rev}</td>
                  <td style={{ maxWidth: 260 }}>
                    <div className="trunc">{cliente}</div>
                    <div className="trunc" style={{ fontSize: 12, color: muted45 }}>{o.obra}</div>
                  </td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{o.vendedor}</td>
                  <td className="tnum" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{o.data}</td>
                  <td className="tnum" style={{ textAlign: 'right' }}>{o.itens.length}</td>
                  <td className="tnum" style={{ textAlign: 'right', fontSize: 13 }}>{fn(c.m2, 1)}</td>
                  <td className="tnum" style={{ textAlign: 'right', fontSize: 13 }}>{fn(c.kg, 0)}</td>
                  {verCustos && <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fm(c.total)}</td>}
                  {verCustos && <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap', color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>{fm(c.custoTotal)}</td>}
                  {verCustos && <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{pc(c.margemPct)}</td>}
                  <td><Tag tipo={tagDeStatus(o.status)}>{o.status}</Tag></td>
                  <td style={{ paddingRight: 11, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {/* Produção não tem acesso ao orçamento nem à proposta — só à separação. */}
                    {app.perfil !== 'Produção' && (
                      <>
                        <button className="btn btn-ghost" style={{ fontSize: 13, padding: '1px 5px' }}
                                onClick={() => app.abrirOrc(o)}>abrir</button>
                        <button className="btn btn-ghost" style={{ fontSize: 13, padding: '1px 5px' }}
                                title="Duplica o orçamento subindo a revisão"
                                onClick={() => void revisar(o.id)}>editar</button>
                        <button className="btn btn-ghost" style={{ fontSize: 13, padding: '1px 5px' }}
                                onClick={() => app.imprimir({ orcId: o.id, proposta: true, separacao: false })}>
                          salvar pdf
                        </button>
                      </>
                    )}
                    <button className="btn btn-ghost" style={{ fontSize: 13, padding: '1px 5px' }}
                            onClick={() => { app.setSepId(o.id); app.irPara('separacao') }}>separação</button>
                    {app.perfil === 'Administrador' && (
                      <BotaoExcluir
                        titulo="Excluir esta proposta"
                        onConfirma={() => void app.gravar(
                          () => chamar(ponte().excluir('orcamentos', o.id)),
                          `${o.numero} excluída`
                        )}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!lista.length && (
        <div style={{ padding: '30px 12px', textAlign: 'center', fontSize: 13, color: muted45 }}>
          Nenhuma proposta com esse filtro.
        </div>
      )}
    </div>
  )
}
