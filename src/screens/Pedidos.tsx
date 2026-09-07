import { useState } from 'react'
import { chamar, ponte } from '../api'
import { useApp } from '../store'
import { Campo, Card, Modal, Tag, Vazio } from '../ui'
import { fm } from '../format'
import { nomeProposta, type PedidoVenda, type ComandoNegocio, type EntregaPedido } from '../shared/types'

export function Pedidos() {
  const app = useApp()
  const [aberto,setAberto] = useState(app.registroId)
  const [busca,setBusca] = useState('')
  const [encerrados,setEncerrados] = useState(false)
  const p = app.db.pedidos?.find(p=>p.id===aberto)
  const etapaAtual = p ? p.status==='Concluído'?7:p.instalacao==='Em execução'||p.instalacao==='Concluída'?6:({'Aguardando liberação':1,'Materiais pendentes':2,'Em separação':2,'Em fabricação':3,'Em conferência':4,'Pronta para expedição':5,'Concluída':7}[p.etapa]) : 0
  const lista = (app.db.pedidos || []).filter(p=>(encerrados || !['Cancelado','Concluído'].includes(p.status)) && [p.numero,p.proposta.obra,p.cliente?.nome].join(' ').toLowerCase().includes(busca.toLowerCase()))
  return <div className="workflow-form">
    {!p ? <>
      <div className="toolbar"><input className="input" style={{maxWidth:380}} placeholder="Pedido, cliente ou obra" aria-label="Buscar pedidos" value={busca} onChange={e=>setBusca(e.target.value)}/><label className="workflow-check"><input type="checkbox" checked={encerrados} onChange={e=>setEncerrados(e.target.checked)}/>Incluir encerrados</label></div>
      <div className="card"><table className="table"><thead><tr><th>Pedido / revisão aceita</th><th>Cliente / obra</th><th>Andamento</th><th>Entrega prevista</th><th/></tr></thead><tbody>{lista.map(p=><tr key={p.id}><td><strong>PV {p.numero}</strong><div className="muted">{nomeProposta(p.proposta)}</div></td><td>{p.cliente?.nome}<div className="muted">{p.proposta.obra}</div></td><td><Tag>{['Cancelado','Concluído'].includes(p.status)?p.status:p.etapa}</Tag></td><td>{p.entregaPrevista?.split('-').reverse().join('/')||'A definir'}</td><td><button className="btn btn-secondary" onClick={()=>setAberto(p.id)}>Acompanhar →</button></td></tr>)}</tbody></table>{!lista.length&&<Vazio>Ao aprovar uma proposta, o pedido de venda aparece aqui.</Vazio>}</div>
    </> : <>
      <button className="btn btn-ghost back-button" style={{alignSelf:'flex-start'}} onClick={()=>setAberto('')}>← Todos os pedidos</button>
      <div className="order-hero"><div><small>PEDIDO DE VENDA · PV {p.numero}</small><h2>{p.proposta.obra}</h2><p>{p.ordemProducaoId && <>{p.ordemProducaoId} · </>}{p.cliente?.nome} · revisão aceita <strong>{nomeProposta(p.proposta)}</strong></p></div><div><Tag>{p.status}</Tag>{app.verCustos&&<h2>{fm(p.total)}</h2>}<small>Aceite: {new Date(p.aprovadoEm).toLocaleDateString('pt-BR')}</small></div></div>
      <div className="order-stages" aria-label="Etapas do pedido">{['Aceite','Liberação','Separação','Fabricação','Conferência','Entrega','Instalação'].map((s,i)=><div key={s} data-state={i<etapaAtual?'done':i===etapaAtual?'current':'pending'} aria-current={i===etapaAtual?'step':undefined}><span>{i<etapaAtual?'✓':i+1}</span>{s}</div>)}</div>
      <div className="notice"><strong>Agora: {p.etapa}.</strong> {p.etapa==='Aguardando liberação'?'Confira medidas, composição e requisitos internos para liberar.':'Use as ações abaixo para registrar o avanço da execução.'} Disponibilidade de materiais é uma conferência manual; não representa baixa de estoque.</div>
      {p.legado&&<div className="notice warning">Pedido migrado: confira a documentação original do aceite e se a instalação foi contratada. As conferências anteriores foram preservadas.</div>}
      <AcoesPedido key={p.id} p={p}/>
      <Card titulo="Produtos contratados e entregas"><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Produto</th><th>Medidas</th><th>Contratado</th><th>Entregue</th><th>Saldo a entregar</th></tr></thead><tbody>{p.proposta.itens.map((it,i)=>{
        const entregue=p.entregas.filter(e=>e.status==='Entregue').reduce((s,e)=>s+(e.quantidades[i]||0),0)
        return <tr key={i}><td>{it.desc||p.proposta.referenciaPrecos?.materiais.find(m=>m.id===it.matId)?.desc||it.matId}{p.compradosProntos.includes(i)&&<small> · comprado pronto</small>}</td><td>{it.larg??p.proposta.referenciaPrecos?.materiais.find(m=>m.id===it.matId)?.larg} × {it.alt??p.proposta.referenciaPrecos?.materiais.find(m=>m.id===it.matId)?.alt} mm</td><td>{it.qtd}</td><td>{entregue}</td><td>{Math.max(0,it.qtd-entregue)}</td></tr>
      })}</tbody></table></div></Card>
      <Card titulo="Instalação"><div style={{padding:18}}><Tag>{p.instalacao}</Tag> {p.instalacaoData} · {p.instalacaoResponsavel||'Equipe a definir'}</div></Card>
      {!!p.revisoesAnteriores.length&&<Card titulo="Revisões substituídas do pedido">{p.revisoesAnteriores.map(r=><div className="work-action" key={r.proposta.id}><span><strong>{nomeProposta(r.proposta)}</strong><small>{r.etapa} · {r.motivo}</small></span><button className="btn btn-secondary" onClick={()=>app.imprimir({orcId:r.proposta.id,proposta:app.verCustos,separacao:!app.verCustos})}>Documento</button></div>)}</Card>}
      <Card titulo="Histórico do pedido">{(app.db.eventos||[]).filter(e=>e.numero===p.numero).map(e=><div className="order-event" key={e.id}><small>{new Date(e.data).toLocaleString('pt-BR')} · {e.autor}</small><strong>{e.acao}</strong><p>{e.detalhe}</p></div>)}</Card>
    </>}
  </div>
}
function AcoesPedido({p}:{p:PedidoVenda}) {
  const app=useApp()
  const [acao,setAcao]=useState<ComandoNegocio['acao']|''>('')
  const [data,setData]=useState(p.entregaPrevista||new Date().toISOString().slice(0,10))
  const [responsavel,setResponsavel]=useState(app.user.nome)
  const [motivo,setMotivo]=useState('')
  const [instalar,setInstalar]=useState(false)
  const [medidas,setMedidas]=useState(false)
  const [requisitos,setRequisitos]=useState(false)
  const [comprados,setComprados]=useState<number[]>([])
  const [prioridade,setPrioridade]=useState(p.prioridade)
  const [instalacao,setInstalacao]=useState<PedidoVenda['instalacao']>('Programada')
  const [entrega,setEntrega]=useState<EntregaPedido|null>(null)
  const [erro,setErro]=useState('')
  const [salvando,setSalvando]=useState(false)
  const abrir=(a:ComandoNegocio['acao'])=>{setErro('');setAcao(a);setMedidas(false);setRequisitos(false);setMotivo('')}
  const novaEntrega=()=>{setEntrega({id:'',data:new Date().toISOString().slice(0,10),responsavel:app.user.nome,status:'Programada',comprovante:'',quantidades:Object.fromEntries(p.proposta.itens.map((it,i)=>[i,Math.max(0,it.qtd-p.entregas.reduce((s,e)=>s+(e.quantidades[i]||0),0))]))});abrir('entrega')}
  const executar=async()=>{
    if(!acao||salvando)return
    setSalvando(true);setErro('')
    try { await chamar(ponte().negocio({acao,id:p.id,versao:p.versao,data,responsavel,motivo,medidasConferidas:medidas,requisitosConferidos:requisitos,instalacaoContratada:instalar,compradosProntos:comprados,prioridade,entrega:entrega||undefined,instalacao}));await app.recarregar();setAcao('');app.say('Pedido atualizado e ação registrada no histórico.') }
    catch(e){setErro((e as Error).message)}finally{setSalvando(false)}
  }
  const encerrado=['Concluído','Cancelado'].includes(p.status)
  const operacional=app.pode('producao')
  const botao=(a:ComandoNegocio['acao'],texto:string)=><button className="btn btn-secondary" onClick={()=>abrir(a)}>{texto}</button>
  return <>
    {!encerrado&&<div className="toolbar">
      {p.legado&&app.pode('aprovar')&&botao('regularizar','Conferir pedido migrado')}
      {app.pode('planejamento')&&botao('planejar','Planejar prazo e prioridade')}
      {operacional&&p.etapa==='Aguardando liberação'&&botao('liberar','Liberar para produção')}
      {operacional&&['Materiais pendentes','Em separação'].includes(p.etapa)&&<button className="btn btn-primary" onClick={()=>{app.setSepId(p.orcamentoId);app.irPara('separacao')}}>Conferir separação</button>}
      {operacional&&['Materiais pendentes','Em separação'].includes(p.etapa)&&botao('fabricar','Iniciar fabricação / recebimento')}
      {operacional&&p.etapa==='Em fabricação'&&botao('conferir','Finalizar fabricação')}
      {operacional&&p.etapa==='Em conferência'&&botao('expedir','Aprovar conferência final')}
      {operacional&&p.etapa==='Pronta para expedição'&&<button className="btn btn-primary" onClick={novaEntrega}>Programar entrega</button>}
      {operacional&&p.instalacao!=='Não contratada'&&p.instalacao!=='Concluída'&&botao('instalacao','Atualizar instalação')}
      {operacional&&p.etapa==='Pronta para expedição'&&botao('concluir','Concluir pedido')}
      {app.pode('cancelar')&&botao('cancelar','Cancelar pedido')}
    </div>}
    {!!p.entregas.length&&<Card titulo="Entregas programadas e realizadas">{p.entregas.map(e=><div className="work-action" key={e.id}><span><strong>{e.data.split('-').reverse().join('/')} · {e.status}</strong><small>{e.responsavel} · {Object.values(e.quantidades).reduce((s,n)=>s+n,0)} peças · {e.comprovante}</small></span>{operacional&&!encerrado&&e.status!=='Entregue'&&<button className="btn btn-secondary" onClick={()=>{setEntrega(structuredClone(e));abrir('entrega')}}>Atualizar entrega</button>}</div>)}</Card>}
    {acao&&<Modal titulo={{regularizar:'Conferir pedido migrado',liberar:'Liberação técnica',planejar:'Planejamento',fabricar:'Iniciar fabricação',conferir:'Finalizar fabricação',expedir:'Conferência final',entrega:'Entrega parcial ou total',instalacao:'Instalação',concluir:'Concluir pedido',cancelar:'Cancelar pedido'}[acao as string]||'Atualizar pedido'} onFechar={()=>{if(!salvando)setAcao('')}} largura={650}>
      <div className="workflow-form"><strong>PV {p.numero} · {nomeProposta(p.proposta)}</strong>
      {['planejar','liberar','instalacao'].includes(acao)&&<Campo label="Data prevista *"><input className="input" type="date" value={data} onChange={e=>setData(e.target.value)}/></Campo>}
      {acao==='planejar'&&<Campo label="Prioridade"><select className="input" value={prioridade} onChange={e=>setPrioridade(e.target.value as typeof prioridade)}>{['Normal','Alta','Urgente'].map(s=><option key={s}>{s}</option>)}</select></Campo>}
      {acao==='regularizar'&&<label className="workflow-check"><input type="checkbox" checked={instalar} onChange={e=>setInstalar(e.target.checked)}/>Instalação contratada no aceite original</label>}
      {acao==='liberar'&&<>
        <label className="workflow-check"><input type="checkbox" checked={medidas} onChange={e=>setMedidas(e.target.checked)}/>Medidas finais conferidas com a obra.</label>
        <label className="workflow-check"><input type="checkbox" checked={requisitos} onChange={e=>setRequisitos(e.target.checked)}/>Requisitos internos liberados (técnicos, comerciais e pagamento, quando exigido).</label>
        <p>Identifique os produtos comprados prontos. Os demais precisam de composição na revisão aceita.</p>
        {p.proposta.itens.map((it,i)=><label className="workflow-check" key={i}><input type="checkbox" checked={comprados.includes(i)} onChange={e=>setComprados(a=>e.target.checked?[...a,i]:a.filter(n=>n!==i))}/>{i+1}. {it.desc||p.proposta.referenciaPrecos?.materiais.find(m=>m.id===it.matId)?.desc||`Produto ${i+1}`} · comprado pronto</label>)}
      </>}
      {['regularizar','conferir','expedir','instalacao'].includes(acao)&&<Campo label="Responsável / equipe *"><input className="input" value={responsavel} onChange={e=>setResponsavel(e.target.value)}/></Campo>}
      {acao==='expedir'&&<label className="workflow-check"><input type="checkbox" checked={requisitos} onChange={e=>setRequisitos(e.target.checked)}/>Todos os produtos foram conferidos em quantidade e qualidade, sem pendências.</label>}
      {acao==='instalacao'&&<Campo label="Próxima situação"><select className="input" value={instalacao} onChange={e=>setInstalacao(e.target.value as typeof instalacao)}>{['Programada','Em execução','Concluída','Pendência'].map(x=><option key={x}>{x}</option>)}</select></Campo>}
      {['regularizar','instalacao','cancelar'].includes(acao)&&<Campo label={acao==='cancelar'?'Motivo e tratamento dos materiais / entregas *':'Registro, pendência ou aceite da instalação *'}><textarea className="input" value={motivo} onChange={e=>setMotivo(e.target.value)}/></Campo>}
      {acao==='entrega'&&entrega&&<>
        <Campo label="Data da entrega *"><input className="input" type="date" value={entrega.data} onChange={e=>setEntrega({...entrega,data:e.target.value})}/></Campo>
        <Campo label="Responsável *"><input className="input" value={entrega.responsavel} onChange={e=>setEntrega({...entrega,responsavel:e.target.value})}/></Campo>
        <Campo label="Situação"><select className="input" value={entrega.status} onChange={e=>setEntrega({...entrega,status:e.target.value as EntregaPedido['status']})}>{(entrega.id?['Programada','Em transporte','Entregue','Ocorrência']:['Programada']).map(x=><option key={x}>{x}</option>)}</select></Campo>
        {p.proposta.itens.map((it,i)=><Campo key={i} label={`${i+1}. ${it.desc||p.proposta.referenciaPrecos?.materiais.find(m=>m.id===it.matId)?.desc||`Produto ${i+1}`} — quantidade nesta entrega`}><input className="input" type="number" min="0" max={it.qtd} value={entrega.quantidades[i]||0} onChange={e=>setEntrega({...entrega,quantidades:{...entrega.quantidades,[i]:Number(e.target.value)}})}/></Campo>)}
        <Campo label="Comprovante de recebimento ou ocorrência"><textarea className="input" value={entrega.comprovante} onChange={e=>setEntrega({...entrega,comprovante:e.target.value})}/></Campo>
      </>}
      {acao==='fabricar'&&<p>A separação deve estar concluída. Pedidos compostos apenas por produtos comprados prontos seguem para conferência.</p>}
      {acao==='concluir'&&<p>O pedido só será concluído após a entrega de todos os produtos e o término da instalação contratada.</p>}
      {erro&&<div className="notice warning" role="alert">{erro}</div>}
      <div className="toolbar"><button className="btn btn-secondary" disabled={salvando} onClick={()=>setAcao('')}>Voltar</button><button className="btn btn-primary" disabled={salvando} onClick={()=>void executar()}>{salvando?'Salvando…':'Confirmar registro'}</button></div>
      </div>
    </Modal>}
  </>
}
