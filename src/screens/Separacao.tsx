import { necessidadesProducao, resumoPedido } from '../producao'
import { useMemo, useState } from 'react'
import { chamar, ponte } from '../api'
import { fn, hoje, num } from '../format'
import { unidadeLabel } from '../catalogo'
import { guardarLocal, lerLocal } from '../rascunhos'
import { SEP_VAZIA, useApp } from '../store'
import { Barra, Campo, Card, StatusTag, Tag, Vazio, BotaoExcluir } from '../ui'
import { PedidoDetalhe } from './Pedidos'
import type { Separacao as Sep, PedidoVenda } from '../shared/types'

const PRIORIDADE = { Urgente: 0, Alta: 1, Normal: 2 }

/** Fila da fábrica: abre o próprio pedido, com a separação dentro dele. */
export function Separacao() {
  const app = useApp()
  const { db } = app
  const [filtro, setFiltro] = useState('')
  const abertos = (db.pedidos || []).filter(p => !['Cancelado', 'Concluído'].includes(p.status))
  const selecionado = abertos.find(p => p.orcamentoId === app.sepId)
  if (selecionado) return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <button className="btn btn-ghost back-button" style={{ alignSelf: 'flex-start' }} onClick={() => app.setSepId('')}>← Fila de produção</button>
    <PedidoDetalhe p={selecionado} />
  </div>
  const fila = abertos.filter(p => [p.numero, p.proposta.obra, p.cliente?.nome].join(' ').toLowerCase().includes(filtro.toLowerCase()))
    .sort((a, b) => PRIORIDADE[a.prioridade ?? 'Normal'] - PRIORIDADE[b.prioridade ?? 'Normal'] || (a.entregaPrevista || '9999').localeCompare(b.entregaPrevista || '9999'))
  return <Card titulo="Pedidos na fábrica">
    <div style={{ padding: 12 }}><input className="input" aria-label="Filtrar pedidos" placeholder="Número, cliente ou obra" value={filtro} onChange={e => setFiltro(e.target.value)} /></div>
    {fila.map(p => <button key={p.id} className="search-result linha" onClick={() => app.setSepId(p.orcamentoId)}>
      <strong>{p.numero}</strong><span style={{ flex: 1 }}>{p.proposta.obra || p.cliente?.nome}</span><small>{p.entregaPrevista ? `Entrega ${p.entregaPrevista.split('-').reverse().join('/')}` : 'Sem data definida'}</small>{p.prioridade !== 'Normal' && <Tag>{p.prioridade}</Tag>}<StatusTag status={resumoPedido(p).situacao} />
    </button>)}
    {!fila.length && <Vazio>Nenhum pedido aprovado em andamento.</Vazio>}
  </Card>
}

interface Linha { id: string; grupo: string; cod: string; nome: string; detalhe: string; qtd: number; feito: number; casas: number; marcar: (v: number) => void }

/**
 * Conferência de separação como lista de marcação: marcar a linha registra a
 * quantidade inteira; a quantidade parcial continua editável quando faltar algo.
 */
export function ConferenciaSeparacao({ p }: { p: PedidoVenda }) {
  const app = useApp()
  const { db, motor } = app
  const o = p.proposta
  const chave = `estrudena:producao:${app.user.id}`
  const [rascunhos, setRascunhos] = useState<Record<string, Sep>>(() => lerLocal(chave, {}))
  const [erroLocal, setErroLocal] = useState(false)
  const salva = db.separacoes[o.id] ?? SEP_VAZIA
  const sep = rascunhos[o.id] ?? salva
  const pendente = JSON.stringify(sep) !== JSON.stringify(salva)
  const c = useMemo(() => motor.calc(o), [o, motor])
  const { materiais, ferragens } = necessidadesProducao(db, o, p)
  const conferente = sep.responsavel || app.user.nome
  const alterar = (patch: Partial<Sep>) => setRascunhos(ant => { const prox = { ...ant, [o.id]: { ...sep, ...patch } }; setErroLocal(!guardarLocal(chave, prox)); return prox })
  const limparLocal = () => setRascunhos(ant => { const prox = { ...ant }; delete prox[o.id]; guardarLocal(chave, prox); return prox })
  // A primeira gravação já inicia a separação: não há botão só para isso.
  const base = (): Sep => ({ ...sep, responsavel: conferente, ...(sep.status === 'Pendente' ? { status: 'Em separação' as const, iniciado: hoje() } : {}) })
  const salvar = async () => { if (await app.gravar(() => chamar(ponte().salvarSeparacao(o.id, base())), 'Conferência salva')) limparLocal() }
  const concluir = async () => {
    const inicio = base()
    // O servidor só conclui a partir de "Em separação"; se ainda não foi gravada, grava antes.
    const passos = sep.status === 'Pendente' ? [inicio, { ...inicio, status: 'Concluída' as const, concluido: hoje(), versao: (inicio.versao || 0) + 1 }] : [{ ...inicio, status: 'Concluída' as const, concluido: hoje() }]
    if (await app.gravar(async () => { for (const s of passos) await chamar(ponte().salvarSeparacao(o.id, s)) }, 'Separação concluída. O pedido seguiu para a fabricação.')) limparLocal()
  }
  const insumo = (id: string, qtd: number) => (v: number) => alterar({ insumos: { ...sep.insumos, [id]: Math.max(0, Math.min(qtd, v)) } })
  const linhas: Linha[] = [
    ...c.rows.map(r => ({ id: 'p' + r.i, grupo: 'Produtos', cod: r.m?.cod ?? '', nome: `${r.it.desc ?? r.m?.desc ?? ''}${r.it.local ? ` · ${r.it.local}` : ''}`, detalhe: `${fn(r.L, 0)} × ${fn(r.H, 0)} mm`, qtd: r.qtd, feito: sep.conf[r.i] ?? 0, casas: 0, marcar: (v: number) => alterar({ conf: { ...sep.conf, [r.i]: Math.max(0, Math.min(r.qtd, v)) } }) })),
    ...materiais.map(x => ({ id: 'mp:' + x.material.id, grupo: 'Matérias-primas', cod: x.material.cod, nome: x.material.desc, detalhe: unidadeLabel(x.material.unidade), qtd: x.qtd, feito: sep.insumos?.['mp:' + x.material.id] ?? 0, casas: 3, marcar: insumo('mp:' + x.material.id, x.qtd) })),
    ...ferragens.map(x => ({ id: 'ac:' + x.a!.id, grupo: 'Ferragens', cod: x.a!.cod, nome: x.a!.nome, detalhe: x.a!.unidade, qtd: x.qtd, feito: sep.insumos?.['ac:' + x.a!.id] ?? 0, casas: 3, marcar: insumo('ac:' + x.a!.id, x.qtd) }))
  ]
  const completa = (l: Linha) => l.feito + 0.00001 >= l.qtd
  const prontas = linhas.filter(completa).length
  const concluida = sep.status === 'Concluída'
  return <fieldset disabled={app.gravando} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <Card titulo="Separação de materiais" direita={<>{concluida && <StatusTag status={sep.status} />}<button className="btn btn-ghost" onClick={() => app.imprimir({ orcId: o.id, proposta: false, separacao: true })}>Visualizar pedido em PDF</button></>}>
      <div className="toolbar" style={{ padding: '16px 16px 0' }}>
        <Campo label="Conferente"><input className="input" value={conferente} onChange={e => alterar({ responsavel: e.target.value })} /></Campo>
        <Campo label="Observações da produção"><input className="input" value={sep.obs} onChange={e => alterar({ obs: e.target.value })} /></Campo>
      </div>
      <div style={{ padding: 16 }}>
        <div className="toolbar"><strong>{prontas} de {linhas.length} itens separados</strong><span role="status" style={{ flex: 1, fontSize: 12 }}>{erroLocal ? 'Cópia local indisponível. Salve antes de sair.' : pendente ? 'Alterações não salvas' : ''}</span>
          {!concluida && <button className={'btn ' + (prontas === linhas.length ? 'btn-secondary' : 'btn-primary')} onClick={() => void salvar()}>{app.gravando ? 'Salvando…' : 'Salvar conferência'}</button>}
          {!concluida && <button className={'btn ' + (prontas === linhas.length ? 'btn-primary' : 'btn-secondary')} disabled={prontas < linhas.length} title="Marque todos os itens para concluir" onClick={() => void concluir()}>Concluir separação</button>}
        </div>
        <Barra pct={linhas.length ? prontas / linhas.length * 100 : 0} />
      </div>
      <div className="check-list" style={{ overflowX: 'auto' }}><table className="table"><thead><tr><th className="check-col">Ok</th><th>Item</th><th>Medidas / unidade</th><th>Quantidade</th><th>Conferido</th></tr></thead><tbody>
        {['Produtos', 'Matérias-primas', 'Ferragens'].flatMap(g => {
          const doGrupo = linhas.filter(l => l.grupo === g)
          if (!doGrupo.length) return []
          return [<tr key={g}><td colSpan={5} className="check-group" title={g === 'Matérias-primas' ? 'Quantidades previstas nas composições, antes de perdas.' : undefined}>{g} ({doGrupo.length})</td></tr>,
            ...doGrupo.map(l => <tr key={l.id} data-ok={completa(l)}>
              <td className="check-col"><input type="checkbox" aria-label={`Separado ${l.cod || l.nome}`} checked={completa(l)} disabled={concluida} onChange={e => l.marcar(e.target.checked ? l.qtd : 0)} /></td>
              <td><strong>{l.cod}</strong> · {l.nome}</td><td>{l.detalhe}</td><td className="tnum">{fn(l.qtd, l.casas)}</td>
              <td><input className="input qtd-input" type="number" min="0" max={l.qtd} step={l.casas ? 0.001 : 1} disabled={concluida} aria-label={l.grupo === 'Produtos' ? `Conferido produto ${Number(l.id.slice(1)) + 1}` : `Conferido ${l.cod}`} value={l.feito} onChange={e => l.marcar(num(e.target.value))} /></td>
            </tr>)]
        })}
      </tbody></table></div>
      {!concluida && <div className="toolbar" style={{ padding: '4px 16px 12px', justifyContent: 'flex-end' }}><BotaoExcluir rotulo="Zerar conferência" titulo="Zerar toda a conferência" onConfirma={() => alterar({ conf: {}, insumos: {} })} /></div>}
    </Card>
  </fieldset>
}
