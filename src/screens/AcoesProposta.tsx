import { useState } from 'react'
import { chamar, ponte } from '../api'
import { useApp } from '../store'
import { Campo, Modal } from '../ui'
import { nomeProposta, type Orcamento, type ComandoNegocio } from '../shared/types'

export function AcoesProposta({o}: {o: Orcamento}) {
  const app = useApp()
  const [acao, setAcao] = useState<ComandoNegocio['acao'] | ''>('')
  const [responsavel, setResponsavel] = useState('')
  const [evidencia, setEvidencia] = useState('')
  const [motivo, setMotivo] = useState('')
  const [instalar, setInstalar] = useState(false)
  const [impacto, setImpacto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const pedido = app.db.pedidos?.find(p=>p.numero===o.numero)
  const acoes: [ComandoNegocio['acao'], string][] = [['enviar','Registrar envio'],['negociar','Em negociação'],['aprovar',pedido?'Aprovar aditivo':'Aprovar proposta'],['recusar','Registrar recusa'],['expirar','Encerrar por validade']]
  const titulo = acoes.find(x=>x[0]===acao)?.[1] || ''
  const salvar = async () => {
    if (!acao || salvando) return
    setSalvando(true); setErro('')
    try {
      await chamar(ponte().negocio({acao,id:o.id,atualizadoEm:o.atualizadoEm,versao:pedido?.versao,responsavel,evidencia,motivo,instalacaoContratada:instalar,impactoConfirmado:impacto}))
      await app.recarregar(); setAcao(''); app.say(acao==='aprovar'?'Aceite registrado. Pedido de venda vinculado à revisão aprovada.':'Histórico atualizado.')
    } catch(e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }
  return <>
    {['Proposta','Enviada','Em análise'].includes(o.status) && acoes.filter(([a])=>a!=='aprovar'||app.pode(pedido?'aditivos':'aprovar')).map(([a,label])=><button key={a} className={a==='aprovar'?'btn btn-primary':'btn btn-ghost'} disabled={app.gravando} onClick={()=>{setAcao(a);setErro('');setInstalar(pedido ? pedido.instalacao!=='Não contratada' : false)}}>{label}</button>)}
    {pedido && app.pode('pedidos') && <button className="btn btn-secondary" onClick={()=>app.irPara('pedidos',pedido.id)}>Ver pedido de venda</button>}
    {acao && <Modal titulo={titulo} onFechar={()=>{if(!salvando)setAcao('')}} largura={560}>
      <div className="workflow-form"><strong>{nomeProposta(o)}</strong>
      {o.validadeAte && <p>Válida até {o.validadeAte.split('-').reverse().join('/')}. Emitir ou visualizar PDF não registra o envio.</p>}
      {acao==='aprovar' && <>
        <Campo label="Quem aprovou pelo cliente *"><input className="input" value={responsavel} onChange={e=>setResponsavel(e.target.value)}/></Campo>
        <Campo label="Referência do aceite *"><textarea className="input" placeholder="Ex.: e-mail de 07/09, documento assinado ou conversa arquivada" value={evidencia} onChange={e=>setEvidencia(e.target.value)}/></Campo>
        <label className="workflow-check"><input type="checkbox" checked={instalar} onChange={e=>setInstalar(e.target.checked)}/> Instalação contratada</label>
        {pedido && <div className="notice warning">A fábrica continua com {nomeProposta(pedido.proposta)} até este aceite. O aditivo exige permissão para aprovar aditivos e uma nova liberação técnica. As conferências anteriores ficam no histórico.</div>}
        {pedido && <label className="workflow-check"><input type="checkbox" checked={impacto} onChange={e=>setImpacto(e.target.checked)}/> Conferi os impactos em preço, prazo e materiais separados ou consumidos.</label>}
      </>}
      {(acao==='enviar'||acao==='recusar'||!!pedido&&acao==='aprovar') && <Campo label={acao==='enviar'?'Canal de envio *':acao==='recusar'?'Motivo da recusa *':'Motivo do aditivo e impactos *'}><textarea className="input" value={motivo} onChange={e=>setMotivo(e.target.value)}/></Campo>}
      {acao==='expirar' && <p>Encerra a proposta somente quando sua validade já terminou. Para retomar, crie uma revisão.</p>}
      {erro && <div className="notice warning" role="alert">{erro}</div>}
      <div className="toolbar"><button className="btn btn-secondary" onClick={()=>setAcao('')}>Voltar</button><button className="btn btn-primary" disabled={salvando} onClick={()=>void salvar()}>Confirmar registro</button></div>
      </div>
    </Modal>}
  </>
}
