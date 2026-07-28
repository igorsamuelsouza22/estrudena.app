const seguro = (n: unknown): number => {
  const x = typeof n === 'number' ? n : parseFloat(String(n))
  return Number.isFinite(x) ? x : 0
}

/** R$ 1.234,56 */
export const fm = (n: unknown): string =>
  seguro(n).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })

/** R$ 1,2 mil — usado nos indicadores. */
export const fk = (n: unknown): string => {
  const v = seguro(n)
  return Math.abs(v) >= 1000
    ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'
    : fm(v)
}

/** Número com casas fixas. */
export const fn = (n: unknown, d = 2): string =>
  seguro(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

/** 12,3% */
export const pc = (n: unknown): string => fn(n, 1) + '%'

export const hoje = (): string => new Date().toLocaleDateString('pt-BR')

/** Converte o valor de um input numérico aceitando vírgula decimal. */
export const num = (v: string): number => {
  const x = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(x) ? x : 0
}
