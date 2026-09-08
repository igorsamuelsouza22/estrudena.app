import { useLayoutEffect, useRef } from 'react'
export const EVENTO_ATUALIZAR='estrudena:antes-atualizar'
export function usePendenciaAtualizacao(rotulo:string,pendente:boolean,ocupado=false){
 const estado=useRef({rotulo,pendente,ocupado});estado.current={rotulo,pendente,ocupado}
 useLayoutEffect(()=>{
  const verificar=(e:Event)=>{const s=estado.current;if(s.pendente||s.ocupado)(e as CustomEvent).detail.pendencias.push(s.ocupado?'gravação em andamento':s.rotulo)}
  window.addEventListener(EVENTO_ATUALIZAR,verificar);return()=>window.removeEventListener(EVENTO_ATUALIZAR,verificar)
 },[])
}
