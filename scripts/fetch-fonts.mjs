/**
 * Baixa os arquivos Roboto usados pelo sistema para public/fonts.
 * O app roda offline, então a fonte precisa estar empacotada — sem isso o
 * CSS cai no system-ui e o layout perde a métrica do design.
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Ficam em src/ para o Vite empacotar com URL relativa — em public/ o caminho
// absoluto quebraria ao carregar o app por file:// dentro do Electron.
const DESTINO = join(process.cwd(), 'src', 'fonts')
const PESOS = { 300: 'Light', 400: 'Regular', 500: 'Medium', 700: 'Bold' }
const BASE = 'https://raw.githubusercontent.com/googlefonts/roboto-2/main/src/hinted'

mkdirSync(DESTINO, { recursive: true })

// A API do Google Fonts devolve woff2 já subsetado; é a rota mais confiável.
const CSS = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap'

const resposta = await fetch(CSS, {
  headers: {
    // Sem um UA moderno o Google devolve TTF em vez de woff2.
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
  }
})
if (!resposta.ok) throw new Error(`Google Fonts respondeu ${resposta.status}`)
const css = await resposta.text()

// Blocos @font-face vêm agrupados por subset; o latin é o último de cada peso.
const blocos = css.split('@font-face').slice(1)
const porPeso = new Map()
for (const b of blocos) {
  const peso = b.match(/font-weight:\s*(\d+)/)?.[1]
  const url = b.match(/url\((https:[^)]+\.woff2)\)/)?.[1]
  const range = b.match(/unicode-range:\s*([^;]+);/)?.[1] ?? ''
  // O subset latin cobre acentuação do português; ignora cyrillic/greek/vietnamese.
  if (!peso || !url) continue
  if (!range.includes('U+0000') && !range.includes('U+0100')) continue
  porPeso.set(peso, url)
}

for (const [peso, nome] of Object.entries(PESOS)) {
  const url = porPeso.get(peso)
  const arquivo = join(DESTINO, `roboto-${peso}.woff2`)
  if (!url) {
    console.warn(`Peso ${peso} (${nome}) não encontrado no CSS — pulando`)
    continue
  }
  if (existsSync(arquivo)) { console.log(`roboto-${peso}.woff2 já existe`); continue }
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Falha ao baixar ${url}: ${r.status}`)
  writeFileSync(arquivo, Buffer.from(await r.arrayBuffer()))
  console.log(`roboto-${peso}.woff2 baixado (${nome})`)
}

console.log(`Fontes em ${DESTINO}. Base alternativa, se precisar manual: ${BASE}`)
