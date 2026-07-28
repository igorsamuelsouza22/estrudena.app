import type { DB, KitVenda, Material, Orcamento, OrcItem } from './shared/types'

/**
 * Motor de cálculo — derivado da planilha real da empresa
 * (`8026-01-26 … PEDIDO.xlsm`, abas DADOS ALUMÍNIO e ALUMÍNIO).
 * Nada é persistido: tudo é recalculado a partir dos itens e dos cadastros.
 */

const n = (v: unknown): number => {
  const x = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(x) ? x : 0
}

export interface LinhaCalc {
  i: number
  it: OrcItem
  m: Material | undefined
  qtd: number
  L: number
  H: number
  im2: number
  ikg: number
  cm: number
  venda: number
  unit: number
  mkuPct: number
}

export interface Apuracao {
  rows: LinhaCalc[]
  custoMat: number
  m2: number
  kg: number
  pecas: number
  vendaMat: number
  mo: number
  subtotal: number
  desc: number
  total: number
  imposto: number
  com1: number
  com2: number
  custoMO: number
  perda: number
  fixos: number
  custoTotal: number
  margem: number
  margemPct: number
}

export class Motor {
  constructor(private db: DB) {}

  mat(id: string): Material | undefined { return this.db.materiais.find(m => m.id === id) }
  cor(id: string) { return this.db.cores.find(c => c.id === id) ?? null }
  kit(id: string) { return this.db.kits.find(k => k.id === id) ?? null }
  aces(id: string) { return this.db.acessorios.find(a => a.id === id) ?? null }

  acesCusto(lista: { acesId: string; qtd: number }[] | undefined): number {
    return (lista ?? []).reduce((a, c) => {
      const p = this.aces(c.acesId)
      return a + (p ? n(p.preco) : 0) * n(c.qtd)
    }, 0)
  }

  kitCusto(id: string): number {
    const k = this.kit(id)
    return k ? this.acesCusto(k.itens) : 0
  }

  /** Custo unitário do item no cadastro, na medida padrão. */
  custoBase(m: Material | undefined): number {
    if (!m) return 0
    const cfg = this.db.config
    const cor = this.cor(m.corId)
    const kgP = n(cfg.precoKg) + (cor ? n(cor.precoKg) : 0)
    const kitU = this.kitCusto(m.kitId) + this.acesCusto(m.aces)
    if (m.unidade === 'KG') return n(m.pesoUnit) * kgP + kitU
    if (m.unidade === 'M2') return n(m.preco) + (cor ? n(cor.precoM2) : 0)
    return n(m.preco) + kitU
  }

  calc(q: Orcamento): Apuracao {
    const cfg = this.db.config
    const rows: LinhaCalc[] = []
    let custoMat = 0, m2 = 0, kg = 0, vendaMat = 0, pecas = 0

    ;(q.itens ?? []).forEach((it, i) => {
      const m = this.mat(it.matId)
      const qtd = n(it.qtd)
      const L = it.larg == null ? n(m?.larg) : n(it.larg)
      const H = it.alt == null ? n(m?.alt) : n(it.alt)
      const im2 = L * H / 1e6 * qtd
      const mkuPct = it.markup == null ? n(q.markup) : n(it.markup)
      const mku = mkuPct / 100
      const cor = this.cor(m?.corId ?? '')
      const kgPreco = n(cfg.precoKg) + (cor ? n(cor.precoKg) : 0)
      const kitU = this.kitCusto(m?.kitId ?? '') + this.acesCusto(m?.aces)

      let cm = 0, ikg = 0
      if (m?.unidade === 'KG') {
        ikg = n(m.pesoUnit) * qtd
        cm = ikg * kgPreco
      } else if (m?.unidade === 'M2') {
        cm = (n(m.preco) + (cor ? n(cor.precoM2) : 0)) * im2
      } else if (m?.unidade === 'ML') {
        cm = n(m.preco) * (L / 1000) * qtd
      } else {
        cm = n(m?.preco) * qtd
      }
      cm += kitU * qtd

      const fc = n(it.fc) || 1
      const venda = (mku < 0.98 ? cm / (1 - mku) : cm) * fc

      rows.push({ i, it, m, qtd, L, H, im2, ikg, cm, venda, unit: qtd ? venda / qtd : 0, mkuPct })
      custoMat += cm; m2 += im2; kg += ikg; vendaMat += venda; pecas += qtd
    })

    const mo = m2 * n(q.moM2) + n(q.moHoras) * n(q.moHora)
      + vendaMat * (n(q.moPct) / 100) + n(q.moFixo) + n(q.km) * n(q.moKm)
    const subtotal = vendaMat + mo
    const desc = subtotal * (n(q.desconto) / 100)
    const total = subtotal - desc
    const imposto = total * (n(q.imposto) / 100)
    const com1 = total * (n(q.com1) / 100)
    const com2 = total * (n(q.com2) / 100)
    const custoMO = kg * n(cfg.moKg)
    const perda = custoMat * (n(q.perda) / 100)
    const fixos = n(q.frete) + n(q.terceiros) + n(q.outros)
    const custoTotal = custoMat + perda + custoMO + fixos + imposto + com1 + com2
    const margem = total - custoTotal

    return {
      rows, custoMat, m2, kg, pecas, vendaMat, mo, subtotal, desc, total,
      imposto, com1, com2, custoMO, perda, fixos, custoTotal, margem,
      margemPct: total ? margem / total * 100 : 0
    }
  }

  /**
   * Resolve o markup que produz a margem alvo. Não há fórmula fechada — imposto
   * e comissões incidem sobre o total, que depende do próprio markup — então é
   * busca binária sobre o cálculo completo, zerando os overrides por item.
   */
  markupParaMargem(q: Orcamento, alvo: number): number {
    let lo = 0, hi = 92
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2
      const r = this.calc({
        ...q, markup: mid,
        itens: q.itens.map(i => ({ ...i, markup: null }))
      })
      if (r.margemPct < alvo) lo = mid; else hi = mid
    }
    return Math.round((lo + hi) / 2 * 10) / 10
  }

  kitVendaResumo(k: KitVenda) {
    const cfg = this.db.config
    let custo = 0, venda = 0, m2 = 0, kg = 0, pecas = 0
    for (const c of k.itens ?? []) {
      const m = this.mat(c.matId)
      if (!m) continue
      const qtd = n(c.qtd)
      const cu = this.custoBase(m) * (m.unidade === 'M2' ? n(m.larg) * n(m.alt) / 1e6 : 1)
      const mku = (m.markup == null ? n(cfg.markup) : n(m.markup)) / 100
      custo += cu * qtd
      venda += (mku < 0.98 ? cu / (1 - mku) : cu) * qtd
      m2 += n(m.larg) * n(m.alt) / 1e6 * qtd
      kg += (m.unidade === 'KG' ? n(m.pesoUnit) : 0) * qtd
      pecas += qtd
    }
    return { custo, venda, m2, kg, pecas }
  }
}

/**
 * Margem aproximada usada na ficha do item (didática — não é a apuração real).
 * margem% = 100 − (100 − markup) × (1 + (imposto + comissão)/100)
 */
export function margemDoItem(markup: number, imposto: number, comissao: number): number {
  return 100 - (100 - n(markup)) * (1 + (n(imposto) + n(comissao)) / 100)
}

/** Inverte a expressão acima, limitando a [0, 95]. */
export function markupDaMargem(margem: number, imposto: number, comissao: number): number {
  const f = 1 + (n(imposto) + n(comissao)) / 100
  const mku = 100 - (100 - n(margem)) / f
  return Math.min(95, Math.max(0, Math.round(mku * 10) / 10))
}

export function proxRev(rev: string): string {
  const num = parseInt(String(rev || '').replace(/\D/g, ''), 10)
  return 'Rev. ' + String((Number.isFinite(num) ? num : 0) + 1).padStart(2, '0')
}
