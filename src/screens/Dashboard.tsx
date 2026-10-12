import { useState } from 'react'
import { fk, fm } from '../format'
import { chaveOrcamento } from '../rascunhos'
import { propostasVigentes } from '../historico'
import { resumoPedido } from '../producao'
import { useApp } from '../store'
import { Card, StatusTag, Tag, Vazio } from '../ui'

export function Dashboard() {
  const app = useApp()
  const {db,motor,verCustos}=app
  const [todosRascunhos,setTodosRascunhos]=useState(false)
  const vigentes=propostasVigentes(db.orcamentos)
  const abertas=vigentes.filter(o=>['Rascunho','Proposta','Enviada'].includes(o.status))
  const aprovadas=(db.pedidos||[]).filter(p=>p.status!=='Cancelado').map(p=>p.proposta)
  const andamento=(db.pedidos||[]).filter(p=>!['Cancelado','Concluído'].includes(p.status))
    .sort((a,b)=>(a.entregaPrevista||'9999').localeCompare(b.entregaPrevista||'9999'))
  const semPreco=db.materiais.filter(m=>m.categoria==='materia_prima'&&m.preco<=0).length
  // Cópias locais primeiro: incluem orçamentos novos que ainda não foram ao servidor.
  const rascunhos=app.rascunhos.length?app.rascunhos:abertas.filter(o=>o.status==='Rascunho')
  const visiveis=todosRascunhos?rascunhos:rascunhos.slice(0,3)
  const recentes=[...vigentes].sort((a,b)=>(b.atualizadoEm||b.data).localeCompare(a.atualizadoEm||a.data)).slice(0,5)
  const abrirPedido=(id:string)=>app.irPara('pedidos',id)
  return <>
    <div className="page-heading"><div><div className="home-eyebrow">{new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</div><h1>Olá, {app.user.nome.split(' ')[0]}.</h1></div>{app.pode('orcamentos')&&<button className="btn btn-primary" onClick={()=>app.novoOrc()}>+ Novo orçamento</button>}</div>
    <div className="home-metrics">
      {verCustos?<><div><label>Em negociação</label><strong>{fk(abertas.reduce((s,o)=>s+motor.calc(o).total,0))}</strong><small>{abertas.length} orçamentos em aberto</small></div><div><label>Carteira aprovada</label><strong>{fk(aprovadas.reduce((s,o)=>s+motor.calc(o).total,0))}</strong><small>{aprovadas.length} obras aprovadas</small></div></>:<><div><label>Pedidos aprovados</label><strong>{aprovadas.length}</strong><small>Obras confirmadas</small></div><div><label>Concluídos</label><strong>{(db.pedidos||[]).filter(p=>p.status==='Concluído').length}</strong><small>Pedidos encerrados</small></div></>}
      <div><label>Em andamento</label><strong>{andamento.length} pedidos</strong><small>{andamento.filter(p=>!!p.entregaPrevista).length} com entrega planejada</small></div>
    </div>
    <div className="home-grid">
      {(app.pode('orcamentos')||app.pode('materias_primas'))&&<Card titulo="Próximas ações">
        {app.pode('orcamentos')&&visiveis.map(o=><button className="work-action" key={chaveOrcamento(o)} onClick={()=>app.abrirOrc(o)}><span><strong>Continuar {o.obra||'orçamento sem obra'}</strong><small>{db.clientes.find(c=>c.id===o.clienteId)?.nome||'Cliente a definir'} · rascunho</small></span><span aria-hidden="true">→</span></button>)}
        {app.pode('orcamentos')&&rascunhos.length>3&&<button className="btn btn-ghost" style={{margin:'8px 22px'}} onClick={()=>setTodosRascunhos(v=>!v)}>{todosRascunhos?'Mostrar menos':`Ver todos os rascunhos (${rascunhos.length})`}</button>}
        {app.pode('orcamentos')&&abertas.filter(o=>o.status!=='Rascunho').slice(0,1).map(o=><button className="work-action" key={o.id} onClick={()=>app.abrirOrc(o)}><span><strong>Acompanhar {o.obra||o.numero}</strong><small>{db.clientes.find(c=>c.id===o.clienteId)?.nome}</small></span><StatusTag status={o.status}/></button>)}
        {app.pode('materias_primas')&&semPreco>0&&<button className="work-action" onClick={()=>app.irPara('materiasprimas')}><span><strong>Revisar {semPreco} insumos sem preço</strong><small>Complete os custos da composição dos produtos</small></span><Tag tipo="outline">Atenção</Tag></button>}
        {(!app.pode('orcamentos')||!abertas.length&&!rascunhos.length)&&!(app.pode('materias_primas')&&semPreco)&&<Vazio>Nenhuma pendência por aqui.</Vazio>}
      </Card>}
      <Card titulo="Pedidos em andamento" direita={app.pode('producao')&&<button className="btn btn-ghost" onClick={()=>app.irPara('separacao')}>Ver fila →</button>}>
        {andamento.slice(0,3).map(p=><button className="work-action" key={p.id} onClick={()=>abrirPedido(p.id)}><span><strong>{p.proposta.obra||p.numero}</strong><small>{p.entregaPrevista?`Entrega ${p.entregaPrevista.split('-').reverse().join('/')}`:'Entrega a definir'} · {p.proposta.itens.reduce((s,i)=>s+i.qtd,0)} peças</small></span><StatusTag status={resumoPedido(p).situacao}/></button>)}
        {!andamento.length&&<Vazio>Nenhum pedido em andamento.</Vazio>}
      </Card>
    </div>
    {app.pode('orcamentos')&&<><div className="section-heading"><h2>Orçamentos recentes</h2><button className="btn btn-ghost" onClick={()=>app.irPara('lista')}>Ver todos →</button></div>
    <div className="card" style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Orçamento / cliente</th><th>Situação</th>{verCustos&&<th style={{textAlign:'right'}}>Valor</th>}<th/></tr></thead><tbody>{recentes.map(o=><tr key={o.id}><td><strong>{o.numero} · {db.clientes.find(c=>c.id===o.clienteId)?.nome||'Cliente a definir'}</strong><div className="muted" style={{fontSize:12,marginTop:5}}>{o.obra||'Obra a definir'}</div></td><td><StatusTag status={o.status}/></td>{verCustos&&<td className="tnum" style={{textAlign:'right',whiteSpace:'nowrap'}}>{fm(motor.calc(o).total)}</td>}<td><button className="btn btn-ghost" onClick={()=>app.abrirOrc(o)}>Abrir ↗</button></td></tr>)}</tbody></table>{!recentes.length&&<Vazio>Os orçamentos aparecerão aqui quando forem salvos.</Vazio>}</div></>}
  </>
}
