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

/** Quantidade já entregue de cada linha do pedido. */
export function entreguesPorLinha(p: PedidoVenda) {
  return p.proposta.itens.map((_, i) => p.entregas.filter(e => e.status === 'Entregue').reduce((s, e) => s + (e.quantidades[i] || 0), 0))
}

/**
 * Uma situação só para a pessoa: o pedido guarda status, etapa, instalação e
 * entregas em separado, e mostrar os quatro confundia. As regras continuam no
 * servidor; isto apenas resume o que já foi gravado.
 */
export function resumoPedido(p: PedidoVenda) {
  const entregues = entreguesPorLinha(p)
  const tudoEntregue = p.proposta.itens.every((it, i) => entregues[i] >= it.qtd)
  const tudoProgramado = p.proposta.itens.every((it, i) => p.entregas.reduce((s, e) => s + (e.quantidades[i] || 0), 0) >= it.qtd)
  const comInstalacao = p.instalacao !== 'Não contratada'
  const instalacaoOk = !comInstalacao || p.instalacao === 'Concluída'
  const etapas = ['Liberação', 'Separação', 'Fabricação', 'Entrega', ...(comInstalacao ? ['Instalação'] : [])]
  let atual = 0, situacao = ''
  if (p.status === 'Cancelado') { atual = -1; situacao = 'Cancelado' }
  else if (p.status === 'Concluído') { atual = etapas.length; situacao = 'Concluído' }
  else if (p.etapa === 'Aguardando liberação') situacao = 'Aguardando liberação'
  else if (p.etapa === 'Materiais pendentes') { atual = 1; situacao = 'Aguardando separação' }
  else if (p.etapa === 'Em separação') { atual = 1; situacao = 'Em separação' }
  else if (p.etapa === 'Em fabricação') { atual = 2; situacao = 'Em fabricação' }
  else if (!tudoEntregue) { atual = 3; situacao = entregues.some(n => n > 0) ? 'Entrega parcial' : 'Pronto para entrega' }
  else if (!instalacaoOk) { atual = 4; situacao = 'Em instalação' }
  else { atual = etapas.length; situacao = 'Pronto para concluir' }
  return { etapas, atual, situacao, entregues, tudoEntregue, tudoProgramado, instalacaoOk }
}
