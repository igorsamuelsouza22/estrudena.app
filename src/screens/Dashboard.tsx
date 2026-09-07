import { fk, fm } from '../format'
import { chaveOrcamento } from '../rascunhos'
import { propostasVigentes } from '../historico'
import { useApp } from '../store'
import { Card, Tag, Vazio } from '../ui'

export function Dashboard() {
  const app = useApp()
  const {db,motor,verCustos}=app
  const vigentes=propostasVigentes(db.orcamentos)
  const abertas=vigentes.filter(o=>['Rascunho','Proposta','Em análise'].includes(o.status))
  const aprovadas=(db.pedidos||[]).filter(p=>p.status!=='Cancelado').map(p=>p.proposta)
  const fila=(db.pedidos||[]).filter(p=>!['Cancelado','Concluído'].includes(p.status)).map(p=>({...p.proposta,entregaPrevista:p.entregaPrevista}))
    .filter(o=>db.separacoes[o.id]?.status!=='Concluída')
    .sort((a,b)=>(a.entregaPrevista||'9999').localeCompare(b.entregaPrevista||'9999'))
  const semPreco=db.materiais.filter(m=>m.categoria==='materia_prima'&&m.preco<=0).length
  const rascunhos=app.rascunhos.length?app.rascunhos:abertas.filter(o=>o.status==='Rascunho')
  const recentes=[...vigentes].sort((a,b)=>(b.atualizadoEm||b.data).localeCompare(a.atualizadoEm||a.data)).slice(0,5)
  const abrirPedido=(id:string)=>{app.irPara('pedidos',db.pedidos?.find(p=>p.orcamentoId===id)?.id)}
  return <>
    <div className="page-heading"><div><div className="home-eyebrow">{new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</div><h1>Olá, {app.user.nome.split(' ')[0]}.</h1><p>Vamos dar andamento às obras.</p></div>{app.pode('orcamentos')&&<button className="btn btn-primary" onClick={()=>app.novoOrc()}>+ Novo orçamento</button>}</div>
    <div className="home-metrics">
      {verCustos?<><div><label>Em negociação</label><strong>{fk(abertas.reduce((s,o)=>s+motor.calc(o).total,0))}</strong><small>{abertas.length} oportunidades abertas</small></div><div><label>Carteira aprovada</label><strong>{fk(aprovadas.reduce((s,o)=>s+motor.calc(o).total,0))}</strong><small>{aprovadas.length} obras aprovadas · revisão aceita</small></div></>:<><div><label>Pedidos aprovados</label><strong>{aprovadas.length}</strong><small>Obras confirmadas</small></div><div><label>Concluídos</label><strong>{Object.values(db.separacoes).filter(s=>s.status==='Concluída').length}</strong><small>Conferências finalizadas</small></div></>}
      <div><label>Na produção</label><strong>{fila.length} pedidos</strong><small>{fila.filter(o=>!!o.entregaPrevista).length} com entrega planejada</small></div>
    </div>
    <div className="home-grid">
      <Card titulo="Próximas ações">
        {!!app.rascunhos.length&&app.pode('orcamentos')&&<div style={{padding:'16px 22px',borderBottom:'1px solid var(--color-divider)'}}><select className="input" aria-label="Retomar orçamento local" value="" onChange={e=>{const o=app.rascunhos.find(x=>chaveOrcamento(x)===e.target.value);if(o)app.abrirOrc(o)}}><option value="">Retomar rascunho local ({app.rascunhos.length})</option>{app.rascunhos.map(o=><option key={chaveOrcamento(o)} value={chaveOrcamento(o)}>{o.numero} {o.rev} · {o.obra||'Sem obra'}</option>)}</select></div>}
        {app.pode('orcamentos')&&rascunhos.slice(0,2).map(o=><button className="work-action" key={o.id||o.rascunhoId} onClick={()=>app.abrirOrc(o)}><span><strong>Continuar {o.obra||'orçamento sem obra'}</strong><small>{db.clientes.find(c=>c.id===o.clienteId)?.nome||'Cliente a definir'} · rascunho</small></span><span aria-hidden="true">→</span></button>)}
        {app.pode('orcamentos')&&abertas.filter(o=>o.status!=='Rascunho').slice(0,1).map(o=><button className="work-action" key={o.id} onClick={()=>app.abrirOrc(o)}><span><strong>Acompanhar {o.obra||o.numero}</strong><small>{o.status} · {db.clientes.find(c=>c.id===o.clienteId)?.nome}</small></span><span aria-hidden="true">→</span></button>)}
        {!!fila.length&&<button className="work-action" onClick={()=>abrirPedido(fila[0].id)}><span><strong>Conferir {fila[0].obra||fila[0].numero}</strong><small>{db.separacoes[fila[0].id]?.status||'Pendente'} · pedido aprovado</small></span><span aria-hidden="true">→</span></button>}
        {app.pode('materias_primas')&&semPreco>0&&<button className="work-action" onClick={()=>app.irPara('materiasprimas')}><span><strong>Revisar {semPreco} insumos sem preço</strong><small>Complete os custos da composição dos produtos</small></span><Tag tipo="outline">Atenção</Tag></button>}
        {!fila.length&&(!verCustos||!abertas.length&&!rascunhos.length&&!semPreco)&&<Vazio>Nenhuma pendência por aqui.</Vazio>}
      </Card>
      <Card titulo="Próximas entregas" direita={<button className="btn btn-ghost" onClick={()=>app.irPara('separacao')}>Ver fila →</button>}>
        {fila.slice(0,3).map(o=><button className="work-action" key={o.id} onClick={()=>abrirPedido(o.id)}><span><strong>{o.obra||o.numero}</strong><small>{o.entregaPrevista?o.entregaPrevista.split('-').reverse().join('/'):'Definir entrega'} · {o.itens.reduce((s,i)=>s+i.qtd,0)} peças</small></span><Tag>{db.separacoes[o.id]?.status||'Pendente'}</Tag></button>)}
        {!fila.length&&<Vazio>Nenhum pedido pendente de conferência.</Vazio>}
      </Card>
    </div>
    <div className="section-heading"><h2>Orçamentos recentes</h2><button className="btn btn-ghost" onClick={()=>app.irPara('lista')}>Ver todos →</button></div>
    <div className="card" style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Orçamento / cliente</th><th>Situação</th>{verCustos&&<th style={{textAlign:'right'}}>Valor</th>}<th/></tr></thead><tbody>{recentes.map(o=><tr key={o.id}><td><strong>{o.numero} · {db.clientes.find(c=>c.id===o.clienteId)?.nome||'Cliente a definir'}</strong><div className="muted" style={{fontSize:12,marginTop:5}}>{o.obra||'Obra a definir'}</div></td><td><Tag>{o.status}</Tag></td>{verCustos&&<td className="tnum" style={{textAlign:'right',whiteSpace:'nowrap'}}>{fm(motor.calc(o).total)}</td>}<td>{app.pode('orcamentos')?<button className="btn btn-ghost" onClick={()=>app.abrirOrc(o)}>Abrir ↗</button>:(o.status==='Aprovado'||db.separacoes[o.id])&&<button className="btn btn-ghost" onClick={()=>abrirPedido(o.id)}>Conferir →</button>}</td></tr>)}</tbody></table>{!recentes.length&&<Vazio>Os orçamentos aparecerão aqui quando forem salvos.</Vazio>}</div>
  </>
}
