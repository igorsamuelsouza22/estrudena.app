import { build } from 'esbuild'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'

const tmp = mkdtempSync(join(tmpdir(), 'estrudena-catalogo-'))
const stub = join(tmp, 'electron.mjs')
writeFileSync(stub, `export const app = { getPath: () => ${JSON.stringify(tmp)}, getVersion: () => 'teste' };`)
const cache = resolve('node_modules/.cache/estrudena')
mkdirSync(cache, { recursive: true })
const outfile = join(cache, 'teste-catalogo.cjs')
await build({ entryPoints: [process.argv[2] || 'scripts/teste-catalogo.ts'], outfile, platform: 'node', target: 'node20',
  bundle: true, format: 'cjs', loader: { '.sql': 'text' }, external: ['pg', 'bcryptjs'], alias: { electron: stub } })
createRequire(import.meta.url)(outfile)
