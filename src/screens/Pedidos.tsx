import { useEffect, useState, type ReactNode } from 'react'
import { chamar, ponte } from '../api'
import { useApp } from '../store'
import { Campo, Card, MaisAcoes, Modal, StatusTag, Tag, Vazio, rotuloStatus } from '../ui'
import { fm } from '../format'
import { catalogoDoPedido } from '../historico'
import { resumoPedido } from '../producao'
import { ConferenciaSeparacao } from './Separacao'
import { nomeProposta, type PedidoVenda, type ComandoNegocio, type EntregaPedido } from '../shared/types'

const data = (iso: string) => iso ? iso.split('-').reverse().join('/') : ''

export function Pedidos() {
  const app = useApp()
  const [aberto,setAberto] = useState(app.registroId)
  useEffect(() => { if (app.registroId) setAberto(app.registroId) }, [app.registroId])
  const [busca,setBusca] = useState('')
  const [encerrados,setEncerrados] = useState(false)
  const p = app.db.pedidos?.find(p=>p.id===aberto)
  const lista = (app.db.pedidos || []).filter(p=>(encerrados || !['Cancelado','Concluído'].includes(p.status)) && [p.numero,p.proposta.obra,p.cliente?.nome].join(' ').toLowerCase().includes(busca.toLowerCase()))
  return <div className="workflow-form">
    {!p ? <>
      <div className="toolbar"><input className="input" style={{maxWidth:380}} placeholder="Pedido, cliente ou obra" aria-label="Buscar pedidos" value={busca} onChange={e=>setBusca(e.target.value)}/><label className="workflow-check"><input type="checkbox" checked={encerrados} onChange={e=>setEncerrados(e.target.checked)}/>Incluir encerrados</label></div>
      <div className="card"><table className="table"><thead><tr><th>Pedido</th><th>Cliente / obra</th><th>Situação</th><th>Entrega prevista</th><th/></tr></thead><tbody>{lista.map(p=><tr key={p.id}><td><strong>{p.numero}</strong></td><td>{p.cliente?.nome}<div className="muted">{p.proposta.obra}</div></td><td><StatusTag status={resumoPedido(p).situacao}/></td><td>{data(p.entregaPrevista)||'A definir'}</td><td><button className="btn btn-secondary" onClick={()=>setAberto(p.id)}>Acompanhar →</button></td></tr>)}</tbody></table>{!lista.length&&<Vazio>Ao aprovar uma proposta, o pedido de venda aparece aqui.</Vazio>}</div>
    </> : <>
      <button className="btn btn-ghost back-button" style={{alignSelf:'flex-start'}} onClick={()=>setAberto('')}>← Todos os pedidos</button>
      <PedidoDetalhe p={p}/>
    </>}
  </div>
}

/** O pedido inteiro numa tela só: situação, próxima ação e, na hora certa, a separação. */
export function PedidoDetalhe({p}:{p:PedidoVenda}) {
  const app = useApp()
  const r = resumoPedido(p)
  const eventos = (app.db.eventos||[]).filter(e=>e.numero===p.numero)
  const separando = app.pode('producao') && !['Cancelado','Concluído'].includes(p.status) && ['Materiais pendentes','Em separação'].includes(p.etapa)
  const ref = p.proposta.referenciaPrecos?.materiais
  const cabecalho=(acoes:ReactNode)=><>
    <div className="order-hero">
      <div><small className="order-id">PEDIDO {p.numero}{p.revisoesAnteriores.length ? ` · ${nomeProposta(p.proposta)}` : ''}</small><h2>{p.proposta.obra || 'Obra a definir'}</h2><p>{p.cliente?.nome}</p>{acoes}</div>
      <div className="order-hero-side"><StatusTag status={r.situacao}/>{app.verCustos&&<h2>{fm(p.total)}</h2>}<small>Aceite {new Date(p.aprovadoEm).toLocaleDateString('pt-BR')}{p.entregaPrevista&&` · entrega ${data(p.entregaPrevista)}`}{p.prioridade!=='Normal'&&` · prioridade ${p.prioridade.toLowerCase()}`}</small></div>
    </div>
    {r.atual>=0&&<div className="order-stages" aria-label="Etapas do pedido">{r.etapas.map((s,i)=><div key={s} data-state={i<r.atual?'done':i===r.atual?'current':'pending'} aria-current={i===r.atual?'step':undefined}><span>{i<r.atual?'✓':i+1}</span>{s}</div>)}</div>}
  </>
  return <div className="workflow-form">
    <AcoesPedido key={p.id} p={p} r={r} cabecalho={cabecalho}>{separando&&<ConferenciaSeparacao p={p}/>}</AcoesPedido>
    <Card titulo="Produtos contratados"><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Produto</th><th>Medidas</th><th>Quantidade</th>{!!p.entregas.length&&<><th>Entregue</th><th>Saldo</th></>}</tr></thead><tbody>{p.proposta.itens.map((it,i)=>{
      const m=ref?.find(m=>m.id===it.matId)
      return <tr key={i}><td>{it.desc||m?.desc||it.matId}{p.compradosProntos.includes(i)&&<small> · comprado pronto</small>}</td><td>{it.larg??m?.larg} × {it.alt??m?.alt} mm</td><td>{it.qtd}</td>{!!p.entregas.length&&<><td>{r.entregues[i]}</td><td>{Math.max(0,it.qtd-r.entregues[i])}</td></>}</tr>
    })}</tbody></table></div></Card>
    {p.instalacao!=='Não contratada'&&<Card titulo="Instalação"><div style={{padding:18}}><Tag>{rotuloStatus(p.instalacao)}</Tag> {data(p.instalacaoData)}{p.instalacaoResponsavel&&` · ${p.instalacaoResponsavel}`}</div></Card>}
    {!!p.revisoesAnteriores.length&&<details className="order-fold"><summary>Revisões substituídas ({p.revisoesAnteriores.length})</summary>{p.revisoesAnteriores.map(rv=><div className="work-action" key={rv.proposta.id}><span><strong>{nomeProposta(rv.proposta)}</strong><small>{rv.motivo}</small></span><button className="btn btn-secondary" onClick={()=>app.imprimir({orcId:rv.proposta.id,proposta:app.verCustos,separacao:!app.verCustos})}>Documento</button></div>)}</details>}
    {!!eventos.length&&<details className="order-fold"><summary>Histórico do pedido ({eventos.length})</summary>{eventos.map(e=><div className="order-event" key={e.id}><small>{new Date(e.data).toLocaleString('pt-BR')} · {e.autor}</small><strong>{e.acao}</strong><p>{e.detalhe}</p></div>)}</details>}
  </div>
}

type Acao = ComandoNegocio['acao']
const TITULOS: Partial<Record<Acao, string>> = {regularizar:'Conferir pedido migrado',liberar:'Liberar para produção',planejar:'Planejar prazo e prioridade',fabricar:'Iniciar fabricação / recebimento',conferir:'Fabricação concluída e conferida',entrega:'Registrar entrega',instalacao:'Atualizar instalação',concluir:'Concluir pedido',cancelar:'Cancelar pedido'}

/** Guarda o estado das janelas de ação; o cabeçalho recebe os botões para exibi-los no cartão do pedido. */
function AcoesPedido({p,r,cabecalho,children}:{p:PedidoVenda;r:ReturnType<typeof resumoPedido>;cabecalho:(acoes:ReactNode)=>ReactNode;children?:ReactNode}) {
  const app=useApp()
  const [acao,setAcao]=useState<Acao|''>('')
  const [dataPrevista,setData]=useState(p.entregaPrevista||new Date().toISOString().slice(0,10))
  const [responsavel,setResponsavel]=useState(app.user.nome)
  const [motivo,setMotivo]=useState('')
  const [instalar,setInstalar]=useState(false)
  const [conferido,setConferido]=useState(false)
  const [comprados,setComprados]=useState<number[]>([])
  const [verComprados,setVerComprados]=useState(false)
  const [prioridade,setPrioridade]=useState(p.prioridade)
  const [instalacao,setInstalacao]=useState<PedidoVenda['instalacao']>('Programada')
  const [entrega,setEntrega]=useState<EntregaPedido|null>(null)
  const [erro,setErro]=useState('')
  const [salvando,setSalvando]=useState(false)
  const abrir=(a:Acao)=>{setErro('');setAcao(a);setConferido(false);setMotivo('');if(a==='liberar'){setComprados(doCadastro);setVerComprados(semComposicao.some(i=>!doCadastro.includes(i)))}if(a==='instalacao'){setInstalacao(r.tudoEntregue&&p.instalacao==='Programada'?'Concluída':'Programada');if(r.tudoEntregue)setData(new Date().toISOString().slice(0,10))}}
  const novaEntrega=()=>{setEntrega({id:'',data:new Date().toISOString().slice(0,10),responsavel:app.user.nome,status:'Programada',comprovante:'',quantidades:Object.fromEntries(p.proposta.itens.map((it,i)=>[i,Math.max(0,it.qtd-p.entregas.reduce((s,e)=>s+(e.quantidades[i]||0),0))]))});abrir('entrega')}
  const executar=async()=>{
    if(!acao||salvando)return
    setSalvando(true);setErro('')
    try { await chamar(ponte().negocio({acao,id:p.id,versao:p.versao,data:dataPrevista,responsavel,motivo,medidasConferidas:conferido,requisitosConferidos:conferido,instalacaoContratada:instalar,compradosProntos:comprados,prioridade,entrega:entrega||undefined,instalacao}));await app.recarregar();setAcao('');app.say('Pedido atualizado.') }
    catch(e){setErro((e as Error).message)}finally{setSalvando(false)}
  }
  const encerrado=['Concluído','Cancelado'].includes(p.status)
  const operacional=app.pode('producao')&&!encerrado
  const separacao=app.db.separacoes[p.orcamentoId]

  // A próxima ação esperada; as demais ficam no menu.
  let principal:Acao|null=null
  if(operacional){
    if(p.etapa==='Aguardando liberação')principal='liberar'
    else if(['Materiais pendentes','Em separação'].includes(p.etapa))principal=separacao?.status==='Concluída'?'fabricar':null
    else if(p.etapa==='Em fabricação')principal='conferir'
    else if(p.etapa==='Pronta para expedição')principal=!r.tudoProgramado?'entrega':!r.tudoEntregue?null:!r.instalacaoOk?'instalacao':'concluir'
  }
  const abrirPrincipal=(a:Acao)=>a==='entrega'?novaEntrega():abrir(a)
  const menu=[
    !encerrado&&app.pode('planejamento')&&{rotulo:TITULOS.planejar!,onClick:()=>abrir('planejar')},
    operacional&&principal!=='instalacao'&&!['Não contratada','Concluída'].includes(p.instalacao)&&{rotulo:TITULOS.instalacao!,onClick:()=>abrir('instalacao')},
    !encerrado&&app.pode('cancelar')&&{rotulo:TITULOS.cancelar!,onClick:()=>abrir('cancelar')}
  ]
  const cat=catalogoDoPedido(app.db,p.proposta)
  const nomeItem=(i:number)=>{const it=p.proposta.itens[i];return it.desc||p.proposta.referenciaPrecos?.materiais.find(m=>m.id===it.matId)?.desc||`Produto ${i+1}`}
  const semComposicao=p.proposta.itens.map((it,i)=>cat.materiais.find(m=>m.id===it.matId)?.composicao?.length?-1:i).filter(i=>i>=0)
  // "Comprado pronto" vem do cadastro atual do produto; a pessoa só decide o que falta.
  const doCadastro=p.proposta.itens.map((it,i)=>app.db.materiais.find(m=>m.id===it.matId)?.compradoPronto?i:-1).filter(i=>i>=0)
  const pendentes=semComposicao.filter(i=>!comprados.includes(i))
  return <>
    {cabecalho((principal||menu.some(Boolean))&&<div className="toolbar order-actions">
      {principal&&<button className="btn btn-primary" onClick={()=>abrirPrincipal(principal!)}>{TITULOS[principal]}</button>}
      <MaisAcoes alinhar="esquerda" itens={menu}/>
    </div>)}
    {p.legado&&!encerrado&&<div className="notice warning">Pedido migrado: confira o aceite original e se a instalação foi contratada. {app.pode('aprovar')&&<button className="btn btn-secondary" onClick={()=>abrir('regularizar')}>{TITULOS.regularizar}</button>}</div>}
    {children}
    {!!p.entregas.length&&<Card titulo="Entregas">{p.entregas.map(e=><div className="work-action" key={e.id} style={{cursor:'default'}}><span><strong>{data(e.data)} · {rotuloStatus(e.status)}</strong><small>{e.responsavel} · {Object.values(e.quantidades).reduce((s,n)=>s+n,0)} peças{e.comprovante&&` · ${e.comprovante}`}</small></span>{operacional&&e.status!=='Entregue'&&<button className="btn btn-secondary" onClick={()=>{setEntrega(structuredClone(e));abrir('entrega')}}>Atualizar entrega</button>}</div>)}</Card>}
    {acao&&<Modal titulo={acao==='entrega'&&entrega?.id?'Atualizar entrega':TITULOS[acao]||'Atualizar pedido'} onFechar={()=>{if(!salvando)setAcao('')}} largura={650}>
      <div className="workflow-form"><strong>Pedido {p.numero} · {p.proposta.obra}</strong>
      {['planejar','liberar','instalacao'].includes(acao)&&<Campo label={acao==='instalacao'?'Data *':'Entrega prevista *'}><input className="input" type="date" value={dataPrevista} onChange={e=>setData(e.target.value)}/></Campo>}
      {acao==='planejar'&&<Campo label="Prioridade"><select className="input" value={prioridade} onChange={e=>setPrioridade(e.target.value as typeof prioridade)}>{['Normal','Alta','Urgente'].map(s=><option key={s}>{s}</option>)}</select></Campo>}
      {acao==='regularizar'&&<label className="workflow-check"><input type="checkbox" checked={instalar} onChange={e=>setInstalar(e.target.checked)}/>Instalação contratada no aceite original</label>}
      {acao==='liberar'&&<>
        <label className="workflow-check"><input type="checkbox" checked={conferido} onChange={e=>setConferido(e.target.checked)}/>Medidas finais e requisitos internos conferidos.</label>
        <details open={verComprados} onToggle={e=>setVerComprados((e.target as HTMLDetailsElement).open)}><summary>Produtos comprados prontos{comprados.length?` · ${comprados.length} marcado${comprados.length>1?'s':''}`:''}{pendentes.length?` · ${pendentes.length} sem composição`:''}</summary>
          <div className="workflow-form" style={{padding:'12px 0'}}>{p.proposta.itens.map((_,i)=><label className="workflow-check" key={i}><input type="checkbox" checked={comprados.includes(i)} onChange={e=>setComprados(a=>e.target.checked?[...a,i]:a.filter(n=>n!==i))}/>{i+1}. {nomeItem(i)}{doCadastro.includes(i)?<small className="muted"> · pelo cadastro</small>:semComposicao.includes(i)&&<small className="muted"> · sem composição</small>}</label>)}</div>
        </details>
      </>}
      {acao==='instalacao'&&<Campo label="Situação"><select className="input" value={instalacao} onChange={e=>setInstalacao(e.target.value as typeof instalacao)}>{(['Programada','Concluída'] as const).map(x=><option key={x} value={x}>{rotuloStatus(x)}</option>)}</select></Campo>}
      {['regularizar','conferir','instalacao'].includes(acao)&&<Campo label={acao==='instalacao'?'Equipe *':'Responsável *'}><input className="input" value={responsavel} onChange={e=>setResponsavel(e.target.value)}/></Campo>}
      {acao==='conferir'&&<label className="workflow-check"><input type="checkbox" checked={conferido} onChange={e=>setConferido(e.target.checked)}/>Todos os produtos foram conferidos em quantidade e qualidade, sem pendências.</label>}
      {['regularizar','instalacao','cancelar'].includes(acao)&&<Campo label={acao==='cancelar'?'Motivo e tratamento dos materiais / entregas *':acao==='regularizar'?'Documentação original do aceite *':instalacao==='Concluída'?'Registro ou aceite da instalação *':'Observação ou pendência'}><textarea className="input" value={motivo} onChange={e=>setMotivo(e.target.value)}/></Campo>}
      {acao==='entrega'&&entrega&&<>
        <Campo label="Data da entrega *"><input className="input" type="date" value={entrega.data} onChange={e=>setEntrega({...entrega,data:e.target.value})}/></Campo>
        <Campo label="Responsável *"><input className="input" value={entrega.responsavel} onChange={e=>setEntrega({...entrega,responsavel:e.target.value})}/></Campo>
        <Campo label="Situação"><select className="input" value={entrega.status} onChange={e=>setEntrega({...entrega,status:e.target.value as EntregaPedido['status']})}>{(entrega.id?['Programada','Entregue','Ocorrência'] as const:['Programada','Entregue'] as const).map(x=><option key={x} value={x}>{rotuloStatus(x)}</option>)}</select></Campo>
        {p.proposta.itens.map((it,i)=><Campo key={i} label={`${i+1}. ${nomeItem(i)} — quantidade nesta entrega`}><input className="input" type="number" min="0" max={it.qtd} value={entrega.quantidades[i]||0} onChange={e=>setEntrega({...entrega,quantidades:{...entrega.quantidades,[i]:Number(e.target.value)}})}/></Campo>)}
        {entrega.status!=='Programada'&&<Campo label="Comprovante de recebimento ou ocorrência *"><textarea className="input" value={entrega.comprovante} onChange={e=>setEntrega({...entrega,comprovante:e.target.value})}/></Campo>}
      </>}
      {erro&&<div className="notice warning" role="alert">{erro}</div>}
      <div className="toolbar"><button className="btn btn-secondary" disabled={salvando} onClick={()=>setAcao('')}>Voltar</button><button className="btn btn-primary" disabled={salvando} onClick={()=>void executar()}>{salvando?'Salvando…':'Confirmar registro'}</button></div>
      </div>
    </Modal>}
  </>
}
