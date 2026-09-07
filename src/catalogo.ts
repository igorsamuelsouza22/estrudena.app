import type { KitVenda, Material } from './shared/types'

export const ehProduto = (m: Material | undefined): m is Material =>
  !!m && m.categoria !== 'materia_prima'

export const ehMateriaPrima = (m: Material | undefined): m is Material =>
  m?.categoria === 'materia_prima'

export function kitSomenteProdutos(kit: KitVenda, materiais: Material[]): boolean {
  return kit.itens.length > 0 && kit.itens.every(it =>
    ehProduto(materiais.find(m => m.id === it.matId)) && Number.isFinite(it.qtd) && it.qtd > 0)
}

export const unidadeLabel = (unidade: string): string =>
  ({ KG: 'kg', M2: 'm²', ML: 'm', UN: 'un' })[unidade] ?? unidade
