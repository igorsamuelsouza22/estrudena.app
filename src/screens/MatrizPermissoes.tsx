import { useEffect, useState } from 'react'
import { chamar, ponte } from '../api'
import { useApp } from '../store'
import { usePendenciaAtualizacao } from '../atualizacao'
import { Card, Modal } from '../ui'
import { alterarPermissao, matrizPadrao, PERFIS, RECURSOS, type PoliticaPermissoes } from '../permissoes'
export function MatrizPermissoes(){
 const app=useApp()
 const atual=app.db.permissoes || {matriz:matrizPadrao(),versao:1,atualizadoPor:'Sistema',atualizadoEm:''}
 const [base,setBase]=useState<PoliticaPermissoes>(structuredClone(atual))
 const [matriz,setMatriz]=useState(()=>structuredClone(atual.matriz))
 const [salvando,setSalvando]=useState(false)
 const [erro,setErro]=useState('')
 const [restaurar,setRestaurar]=useState(false)
 const pendente=JSON.stringify(matriz)!==JSON.stringify(base.matriz)
 usePendenciaAtualizacao('matriz com alterações não salvas',pendente,salvando)
 useEffect(()=>{if(!pendente&&!salvando){setBase(structuredClone(atual));setMatriz(structuredClone(atual.matriz))}},[app.db.permissoes,pendente,salvando])
 const salvar=async()=>{
  if(salvando||!pendente)return
  setSalvando(true);setErro('')
  try{await chamar(ponte().salvarPermissoes(matriz,base.versao));await app.recarregar();setBase({...base,matriz:structuredClone(matriz),versao:base.versao+1});app.say('Matriz salva. As permissões já estão sendo aplicadas no servidor.')}
  catch(e){setErro((e as Error).message);await app.recarregar().catch(()=>{})}finally{setSalvando(false)}
 }
 return <Card titulo="Matriz de permissões" direita={<span className="permission-version">Versão {atual.versao}</span>}>
  <div className="permission-intro"><p>Defina o que cada perfil pode acessar e fazer. A alteração vale para todos os usuários daquele perfil.</p><small>Administradores têm acesso completo. Usuários e matriz são exclusivos deles. Permissões dependentes são ajustadas juntas: por exemplo, liberar orçamentos também libera valores comerciais.</small></div>
  {erro&&<div className="notice warning" role="alert">{erro}</div>}
  {pendente&&atual.versao!==base.versao&&<div className="notice warning">Outra sessão alterou a matriz. Descarte seu rascunho para carregar a versão atual antes de editar novamente.</div>}
  <div className="permission-scroll" tabIndex={0} aria-label="Permissões por perfil"><table className="table permission-table"><thead><tr><th>Área e ação</th>{PERFIS.map(p=><th key={p}>{p}<small>{p==='Administrador'?'Acesso completo':'Permissões personalizáveis'}</small></th>)}</tr></thead><tbody>{RECURSOS.map(([id,titulo,grupo,nota],i)=><ReactFragment key={id} grupo={i===0||RECURSOS[i-1][2]!==grupo?grupo:''}>
   <tr><td><strong>{titulo}</strong><small>{nota}</small></td>{PERFIS.map(perfil=><td key={perfil}><label className="permission-cell"><input type="checkbox" aria-label={`${titulo} — ${perfil}`} checked={matriz[perfil][id]} disabled={salvando||perfil==='Administrador'||id==='usuarios'} onChange={e=>{setMatriz(m=>alterarPermissao(m,perfil,id,e.target.checked));setErro('')}}/><span>{perfil==='Administrador'?'Sempre permitido':id==='usuarios'?'Exclusivo do administrador':matriz[perfil][id]?'Permitido':'Sem acesso'}</span></label></td>)}</tr>
  </ReactFragment>)}</tbody></table></div>
  <div className="permission-save"><div><strong>{pendente?'Alterações pendentes':'Matriz salva'}</strong><small>{atual.atualizadoPor}{atual.atualizadoEm?' · '+new Date(atual.atualizadoEm).toLocaleString('pt-BR'):''}. Telas abertas atualizam em até 15 segundos; novas ações são verificadas imediatamente.</small></div><div><button className="btn btn-ghost" disabled={salvando} onClick={()=>setRestaurar(true)}>Restaurar padrão</button>{pendente&&<button className="btn btn-secondary" disabled={salvando} onClick={()=>{setBase(structuredClone(atual));setMatriz(structuredClone(atual.matriz));setErro('')}}>Descartar alterações</button>}<button className="btn btn-primary" disabled={salvando||!pendente} onClick={()=>void salvar()}>{salvando?'Salvando…':'Salvar permissões'}</button></div></div>
  {restaurar&&<Modal titulo="Restaurar permissões padrão?" onFechar={()=>setRestaurar(false)} largura={510}><p>A matriz será preenchida com os acessos originais de cada perfil. Revise e clique em Salvar permissões para aplicar.</p><div className="config-dialog-actions"><button className="btn btn-secondary" onClick={()=>setRestaurar(false)}>Voltar</button><button className="btn btn-primary" onClick={()=>{setMatriz(matrizPadrao());setRestaurar(false)}}>Preencher com o padrão</button></div></Modal>}
 </Card>
}
import { Fragment, type ReactNode } from 'react'
function ReactFragment({grupo,children}:{grupo:string;children:ReactNode}){return <Fragment>{grupo&&<tr className="permission-group"><td colSpan={4}>{grupo}</td></tr>}{children}</Fragment>}
