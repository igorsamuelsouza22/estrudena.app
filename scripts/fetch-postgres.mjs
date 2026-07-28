/**
 * Baixa os binários do PostgreSQL para dentro do instalador.
 *
 * O .exe final carrega o PostgreSQL embutido: o PC servidor instala o banco
 * sem internet e sem nenhum passo manual. Roda uma vez por máquina de build —
 * o resultado fica em resources/pgsql e é reaproveitado nas próximas builds.
 */
import { copyFileSync, createWriteStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const VERSAO = '16.6-1'
const URL = `https://get.enterprisedb.com/postgresql/postgresql-${VERSAO}-windows-x64-binaries.zip`

const RAIZ = resolve(process.cwd())
const RECURSOS = join(RAIZ, 'resources')
const DESTINO = join(RECURSOS, 'pgsql')
const ZIP = join(RECURSOS, `postgresql-${VERSAO}.zip`)

// Pastas que não servem para rodar o servidor — só inflam o instalador.
const DESCARTAR = ['include', 'doc', 'symbols', 'pgAdmin 4', 'installer', 'StackBuilder']

/**
 * Copia as DLLs do Visual C++ para junto dos binários.
 *
 * O postgres.exe importa VCRUNTIME140, VCRUNTIME140_1 e MSVCP140 — que vêm do
 * Visual C++ Redistributable, e NÃO fazem parte de uma instalação limpa do
 * Windows. Sem isso o banco simplesmente não sobe na máquina do cliente, ainda
 * que funcione na máquina de quem compilou (onde ferramentas de dev já
 * instalaram o pacote). O Windows procura DLL primeiro na pasta do executável,
 * então a cópia local resolve sem exigir instalação extra.
 */
function copiarRuntimeVC() {
  const dlls = ['VCRUNTIME140.dll', 'VCRUNTIME140_1.dll', 'MSVCP140.dll']
  const origem = join(process.env.WINDIR ?? 'C:\\Windows', 'System32')
  const destinoBin = join(DESTINO, 'bin')
  const faltando = []

  for (const dll of dlls) {
    const de = join(origem, dll)
    if (!existsSync(de)) { faltando.push(dll); continue }
    copyFileSync(de, join(destinoBin, dll))
    console.log(`runtime embutido: ${dll}`)
  }

  if (faltando.length) {
    console.warn(
      `\nATENCAO: nao encontrei ${faltando.join(', ')} em ${origem}.\n` +
      'Instale o "Visual C++ Redistributable 2015-2022 x64" nesta maquina de build\n' +
      'e rode `npm run fetch:pg` de novo, senao o instalador falhara em Windows limpo.'
    )
  }
  return faltando.length === 0
}

if (existsSync(join(DESTINO, 'bin', 'initdb.exe'))) {
  console.log(`PostgreSQL já presente em ${DESTINO}.`)
  copiarRuntimeVC()
  console.log('Para rebaixar tudo, apague a pasta resources/pgsql.')
  process.exit(0)
}

mkdirSync(RECURSOS, { recursive: true })

if (!existsSync(ZIP)) {
  console.log(`Baixando ${URL}`)
  console.log('São ~370 MB — pode demorar alguns minutos.')
  const r = await fetch(URL)
  if (!r.ok || !r.body) throw new Error(`Download falhou: ${r.status} ${r.statusText}`)
  await pipeline(Readable.fromWeb(r.body), createWriteStream(ZIP))
  console.log(`Baixado (${(statSync(ZIP).size / 1024 / 1024).toFixed(0)} MB).`)
} else {
  console.log(`Usando o zip já baixado em ${ZIP}`)
}

console.log('Extraindo…')
// tar.exe (bsdtar) acompanha o Windows 10+ e lê zip nativamente.
execFileSync('tar', ['-xf', ZIP, '-C', RECURSOS], { stdio: 'inherit' })

for (const pasta of DESCARTAR) {
  const alvo = join(DESTINO, pasta)
  if (existsSync(alvo)) {
    rmSync(alvo, { recursive: true, force: true })
    console.log(`removido ${pasta}/`)
  }
}

rmSync(ZIP, { force: true })

if (!existsSync(join(DESTINO, 'bin', 'initdb.exe'))) {
  throw new Error(`Extração não produziu ${DESTINO}\\bin\\initdb.exe — confira o zip.`)
}

console.log(`PostgreSQL ${VERSAO} pronto em ${DESTINO}`)
