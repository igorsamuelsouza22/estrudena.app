/**
 * Inspeciona um PDF: quantas imagens estão embutidas e que cores de
 * preenchimento aparecem no início do conteúdo (o fundo da página).
 *
 *   node scripts/analisar-pdf.mjs arquivo.pdf
 */
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const arquivo = process.argv[2]
if (!arquivo) { console.error('informe o arquivo'); process.exit(1) }

const bytes = readFileSync(arquivo)
const bruto = bytes.toString('latin1')

const imagens = (bruto.match(/\/Subtype\s*\/Image/g) ?? []).length
console.log(`imagens embutidas: ${imagens}`)

// Descomprime os fluxos de conteúdo e procura preenchimentos de página inteira.
const fluxos = []
const re = /stream\r?\n/g
let m
while ((m = re.exec(bruto)) !== null) {
  const ini = m.index + m[0].length
  const fim = bruto.indexOf('endstream', ini)
  if (fim < 0) continue
  try {
    fluxos.push(inflateSync(bytes.subarray(ini, fim)).toString('latin1'))
  } catch { /* fluxo não comprimido ou binário de imagem */ }
}
console.log(`paginas: ${(bruto.match(/\/Type\s*\/Page[^s]/g) ?? []).length}`)
console.log(`fluxos de conteudo legiveis: ${fluxos.length}`)

// Quantidade de texto por fluxo, na ordem. Um primeiro fluxo quase sem texto
// denuncia página em branco — foi assim que apareceu a tabela empurrada para a
// página seguinte pelo page-break-inside.
// Os fluxos grandes são as páginas; um primeiro fluxo bem menor que os outros
// denuncia página quase em branco.
const paginas = fluxos
  .map(f => ({ bytes: f.length, textos: (f.match(/Tj|TJ/g) ?? []).length }))
  .filter(p => p.textos > 5)
if (paginas.length) {
  console.log('conteudo por pagina (na ordem):')
  paginas.forEach((p, i) =>
    console.log(`  pagina ${i + 1}: ${p.textos} trechos de texto, ${p.bytes} bytes`))
}

// A4 em pontos (72 dpi). Serve para dizer se um preenchimento cobre a página.
const A4 = { largura: 595, altura: 842 }
const cores = new Map()

for (const f of fluxos) {
  // "r g b rg" define a cor; "x y w h re ... f" pinta o retângulo.
  const re2 = /([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg\s+[^]{0,160}?(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+re\s*\n?f/g
  let a
  while ((a = re2.exec(f)) !== null) {
    const [r, g, b] = [a[1], a[2], a[3]].map(Number)
    const [w, h] = [Math.abs(Number(a[6])), Math.abs(Number(a[7]))]
    const hex = '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
    const at = cores.get(hex) ?? { n: 0, maiorW: 0, maiorH: 0 }
    at.n++
    if (w * h > at.maiorW * at.maiorH) { at.maiorW = w; at.maiorH = h }
    cores.set(hex, at)
  }
}

console.log('preenchimentos de retangulo (cor, quantidade, maior area):')
;[...cores.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, 10)
  .forEach(([hex, v]) => {
    const cobrePagina = v.maiorW > A4.largura * 0.9 && v.maiorH > A4.altura * 0.9
    console.log(
      `  ${hex}  ${String(v.n).padStart(3)}x  maior ${Math.round(v.maiorW)}x${Math.round(v.maiorH)}pt` +
      (cobrePagina ? '  <<< COBRE A PAGINA INTEIRA' : '')
    )
  })
