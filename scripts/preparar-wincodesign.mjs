/**
 * Prepara o pacote winCodeSign que o electron-builder usa no Windows.
 *
 * O 7z oficial traz symlinks da parte macOS (libcrypto/libssl). Criar symlink
 * no Windows exige Modo de Desenvolvedor ou administrador; sem isso a extração
 * falha e o build inteiro para. Como só usamos as ferramentas Windows do
 * pacote, extraímos aqui mesmo descartando a pasta darwin.
 *
 * Roda antes do electron-builder e não faz nada se o cache já estiver pronto.
 */
import { execFileSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const VERSAO = '2.6.0'
const URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-${VERSAO}/winCodeSign-${VERSAO}.7z`

const cache = join(homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign')
const destino = join(cache, `winCodeSign-${VERSAO}`)
const zip = join(cache, `winCodeSign-${VERSAO}.7z`)
const seteZip = join(process.cwd(), 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')

if (existsSync(join(destino, 'windows-10'))) {
  console.log('winCodeSign já preparado.')
  process.exit(0)
}

mkdirSync(cache, { recursive: true })

if (!existsSync(zip)) {
  console.log(`Baixando ${URL}`)
  const r = await fetch(URL, { redirect: 'follow' })
  if (!r.ok || !r.body) throw new Error(`Download falhou: ${r.status}`)
  await pipeline(Readable.fromWeb(r.body), createWriteStream(zip))
}

rmSync(destino, { recursive: true, force: true })
console.log('Extraindo sem a pasta darwin…')
execFileSync(seteZip, ['x', zip, `-o${destino}`, '-xr!darwin', '-y', '-bd'], { stdio: 'inherit' })

if (!existsSync(join(destino, 'windows-10'))) {
  throw new Error(`Extração não produziu ${destino}\\windows-10`)
}
console.log(`winCodeSign pronto em ${destino}`)
