import { build } from 'esbuild'
import { readFileSync, rmSync } from 'node:fs'

rmSync('dist-electron', { recursive: true, force: true })

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

const common = {
  platform: 'node',
  target: 'node20',
  bundle: true,
  format: 'cjs',
  sourcemap: false,
  minify: false,
  loader: { '.sql': 'text' },
  // A versão vai fixa no código: fora do pacote, app.getVersion() devolve a
  // versão do Electron, e a comparação de atualização sairia errada.
  define: { __VERSAO_APP__: JSON.stringify(pkg.version) },
  external: ['electron', 'pg', 'pg-native', 'bcryptjs']
}

await build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.js' })
await build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.js' })

console.log('electron main + preload compilados em dist-electron/')
