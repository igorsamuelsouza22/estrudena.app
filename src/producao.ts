import { Motor } from './calc'
import { catalogoDoPedido } from './historico'
import type { DB, Orcamento, PedidoVenda } from './shared/types'

/** Produto comprado pronto exige recebimento, sem separar componentes para fabricá-lo. */
export function necessidadesProducao(db: DB, o: Orcamento, pedido?: PedidoVenda) {
  const p = pedido || db.pedidos?.find(p=>p.orcamentoId===o.id)
  const itens = o.itens.filter((_,i)=>!p?.compradosProntos.includes(i))
  const cat = catalogoDoPedido(db, o)
  const materiais = new Motor(db).materiaisDoPedido({...o,itens})
  const soma = new Map<string,number>()
  for (const it of itens) {
    const m=cat.materiais.find(m=>m.id===it.matId), kit=cat.kits.find(k=>k.id===m?.kitId)
    for(const a of [...(m?.aces||[]),...(kit?.itens||[])]) soma.set(a.acesId,(soma.get(a.acesId)||0)+a.qtd*it.qtd)
  }
  const ferragens=[...soma].map(([id,qtd])=>({a:cat.acessorios.find(a=>a.id===id),qtd})).filter(x=>x.a)
  return {materiais,ferragens}
}
