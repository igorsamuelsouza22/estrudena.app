import { useState } from 'react'
import { chamar, ponte } from '../api'
import { useApp } from '../store'
import { Campo, MaisAcoes, Modal, Seg, type ItemMenu } from '../ui'
import { nomeProposta, type Orcamento, type ComandoNegocio } from '../shared/types'

const CANAIS = ['WhatsApp', 'E-mail', 'Em mãos', 'Outro'] as const

/**
 * Ações de uma revisão emitida: a próxima ação esperada fica em destaque e as
 * demais vão para "Mais ações".
 */
export function AcoesProposta({o, extras = []}: {o: Orcamento; extras?: ItemMenu[]}) {
  const app = useApp()
  const [acao, setAcao] = useState<ComandoNegocio['acao'] | ''>('')
  const [responsavel, setResponsavel] = useState('')
  const [evidencia, setEvidencia] = useState('')
  const [motivo, setMotivo] = useState('')
  // Sem canal marcado de antemão: o registro deve dizer como a proposta saiu de fato.
  const [canal, setCanal] = useState<'' | typeof CANAIS[number]>('')
  const [instalar, setInstalar] = useState(false)
  const [impacto, setImpacto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const pedido = app.db.pedidos?.find(p=>p.numero===o.numero)
  // Vencida chega como "Expirada" (calculada na leitura): só resta criar uma revisão.
  const aberta = ['Proposta','Enviada'].includes(o.status)
  const podeAprovar = app.pode(pedido?'aditivos':'aprovar')
  const rotuloAprovar = pedido ? 'Aprovar aditivo' : 'Aprovar proposta'
  const titulos: Partial<Record<ComandoNegocio['acao'], string>> = {enviar:'Registrar envio',aprovar:rotuloAprovar,recusar:'Registrar recusa'}
  const abrir = (a: ComandoNegocio['acao']) => { setAcao(a); setErro(''); setMotivo(''); setCanal(''); setInstalar(pedido ? pedido.instalacao!=='Não contratada' : false) }
  const item = (a: ComandoNegocio['acao']): ItemMenu => ({ rotulo: titulos[a]!, onClick: () => abrir(a) })

  const principal: ComandoNegocio['acao'] | null = !aberta ? null : o.status === 'Proposta' ? 'enviar' : podeAprovar ? 'aprovar' : null
  const menu: (ItemMenu | false)[] = aberta ? [o.status === 'Proposta' && podeAprovar && item('aprovar'), item('recusar')] : []
  const verPedido = !!pedido && app.pode('pedidos') && (() => app.irPara('pedidos', pedido.id))

  const salvar = async () => {
    if (!acao || salvando) return
    setSalvando(true); setErro('')
    const detalhe = acao === 'enviar' ? [canal, motivo.trim()].filter(Boolean).join(' — ') : motivo
    try {
      await chamar(ponte().negocio({acao,id:o.id,atualizadoEm:o.atualizadoEm,versao:pedido?.versao,responsavel,evidencia,motivo:detalhe,instalacaoContratada:instalar,impactoConfirmado:impacto}))
      await app.recarregar(); setAcao(''); app.say(acao==='aprovar'?'Aceite registrado. O pedido de venda foi criado.':'Proposta atualizada.')
    } catch(e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }
  return <>
    {principal && (principal !== 'aprovar' || podeAprovar) && <button className="btn btn-primary" disabled={app.gravando} onClick={() => abrir(principal)}>{titulos[principal]}</button>}
    {!principal && verPedido && <button className="btn btn-primary" onClick={verPedido}>Ver pedido de venda</button>}
    <MaisAcoes itens={[...menu, principal && verPedido && { rotulo: 'Ver pedido de venda', onClick: verPedido }, ...extras]} />
    {acao && <Modal titulo={titulos[acao] || ''} onFechar={()=>{if(!salvando)setAcao('')}} largura={560}>
      <div className="workflow-form"><strong>{nomeProposta(o)}{o.validadeAte && <small className="muted"> · válida até {o.validadeAte.split('-').reverse().join('/')}</small>}</strong>
      {acao==='enviar' && <>
        <Campo label="Enviada por *"><Seg opcoes={CANAIS.map(c => ({ id: c, label: c }))} valor={canal} onPick={setCanal} /></Campo>
        <Campo label={canal === 'Outro' ? 'Como foi enviada *' : 'Observação'}><textarea className="input" value={motivo} onChange={e=>setMotivo(e.target.value)}/></Campo>
      </>}
      {acao==='aprovar' && <>
        <Campo label="Quem aprovou pelo cliente *"><input className="input" value={responsavel} onChange={e=>setResponsavel(e.target.value)}/></Campo>
        <Campo label="Referência do aceite *"><textarea className="input" placeholder="Ex.: e-mail de 07/09, documento assinado ou conversa arquivada" value={evidencia} onChange={e=>setEvidencia(e.target.value)}/></Campo>
        <label className="workflow-check"><input type="checkbox" checked={instalar} onChange={e=>setInstalar(e.target.checked)}/> Instalação contratada</label>
        {pedido && <div className="notice warning">A fábrica segue com {nomeProposta(pedido.proposta)} até este aceite, que exige nova liberação técnica.</div>}
        {pedido && <label className="workflow-check"><input type="checkbox" checked={impacto} onChange={e=>setImpacto(e.target.checked)}/> Conferi os impactos em preço, prazo e materiais separados ou consumidos.</label>}
      </>}
      {(acao==='recusar'||!!pedido&&acao==='aprovar') && <Campo label={acao==='recusar'?'Motivo da recusa *':'Motivo do aditivo e impactos *'}><textarea className="input" value={motivo} onChange={e=>setMotivo(e.target.value)}/></Campo>}
      {erro && <div className="notice warning" role="alert">{erro}</div>}
      <div className="toolbar"><button className="btn btn-secondary" onClick={()=>setAcao('')}>Voltar</button><button className="btn btn-primary" disabled={salvando||acao==='enviar'&&(!canal||canal==='Outro'&&!motivo.trim())} onClick={()=>void salvar()}>Confirmar registro</button></div>
      </div>
    </Modal>}
  </>
}
