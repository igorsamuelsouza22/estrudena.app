import type { DB, Orcamento } from './shared/types'

export function propostasVigentes(lista: Orcamento[]): Orcamento[] {
  const grupos = new Map<string, Orcamento>()
  for (const o of lista) {
    const anterior = grupos.get(o.numero || o.id)
    if (!anterior || numeroRev(o.rev) > numeroRev(anterior.rev)) grupos.set(o.numero || o.id, o)
  }
  return [...grupos.values()]
}
export const numeroRev = (rev: string) => Number(rev.replace(/\D/g, '')) || 0
export const dataISO = (data: string) => data.includes('/') ? data.split('/').reverse().join('-') : data.slice(0, 10)
export function capturarPrecos(db: DB, produtos?: Iterable<string>) {
  const ids = new Set(produtos ?? db.materiais.map(m => m.id))
  for (const p of db.materiais.filter(m => ids.has(m.id))) for (const it of p.composicao ?? []) ids.add(it.materialId)
  const materiais = db.materiais.filter(m => ids.has(m.id))
  const kits = db.kits.filter(k => materiais.some(m => m.kitId === k.id))
  const acesIds = new Set([...materiais.flatMap(m => m.aces), ...kits.flatMap(k => k.itens)].map(a => a.acesId))
  return structuredClone({ config: db.config, materiais, cores: db.cores.filter(c => materiais.some(m => m.corId === c.id)),
    acessorios: db.acessorios.filter(a => acesIds.has(a.id)), kits, capturadoEm: new Date().toISOString() })
}
export function catalogoDoPedido(db: DB, q: Orcamento): DB {
  return q.referenciaPrecos ? { ...db, ...q.referenciaPrecos } : db
}
/** Inclui novos produtos sem alterar o preço dos componentes já presentes no rascunho. */
export function ampliarReferencia(db: DB, q: Orcamento, adicionais: string[] = []) {
  if (!q.referenciaPrecos) return undefined
  const atual = capturarPrecos(db, [...q.itens.map(it => it.matId), ...adicionais]), ref = q.referenciaPrecos
  const unir = <T extends { id: string }>(a: T[], b: T[]) => [...a, ...b.filter(x => !a.some(y => y.id === x.id))]
  return { ...ref, materiais: unir(ref.materiais, atual.materiais), cores: unir(ref.cores, atual.cores),
    acessorios: unir(ref.acessorios, atual.acessorios), kits: unir(ref.kits, atual.kits) }
}
