import type { Orcamento } from './shared/types'
export const chaveOrcamento = (o: Orcamento) => o.id || o.rascunhoId || 'novo'
export function lerLocal<T>(chave: string, padrao: T): T {
  try { return JSON.parse(localStorage.getItem(chave) ?? 'null') ?? padrao } catch { return padrao }
}
export function guardarLocal(chave: string, valor: unknown): boolean {
  try { localStorage.setItem(chave, JSON.stringify(valor)); return true } catch { return false }
}
