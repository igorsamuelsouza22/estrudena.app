/**
 * Empacota e roda scripts/teste-banco.ts fora do Electron.
 * O módulo `electron` é substituído por um stub — a camada de dados só usa
 * `app.getPath('userData')` para lembrar o endereço do servidor.
 */
import { build } from 'esbuild'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const tmp = mkdtempSync(join(tmpdir(), 'estrudena-teste-'))
const stub = join(tmp, 'electron-stub.mjs')

writeFileSync(stub, `
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const dados = mkdtempSync(join(tmpdir(), 'estrudena-userdata-'))
export const app = { getPath: () => dados, getVersion: () => '0.0.0-teste' }
export default { app }
`)

// Precisa ficar dentro do projeto para o Node resolver `pg` e `bcryptjs`.
// Fora de dist-electron/, que é empacotada no instalador.
// CJS porque `pg` não expõe exports nomeados para ESM.
const cache = join(process.cwd(), 'node_modules', '.cache', 'estrudena')
mkdirSync(cache, { recursive: true })
const saida = join(cache, 'teste-banco.cjs')

await build({
  entryPoints: ['scripts/teste-banco.ts'],
  outfile: saida,
  platform: 'node',
  target: 'node20',
  bundle: true,
  format: 'cjs',
  loader: { '.sql': 'text' },
  external: ['pg', 'bcryptjs'],
  alias: { electron: stub }
})

createRequire(import.meta.url)(saida)
