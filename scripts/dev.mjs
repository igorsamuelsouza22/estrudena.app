import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { context } from 'esbuild'
import electron from 'electron'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

const common = {
  platform: 'node',
  target: 'node20',
  bundle: true,
  format: 'cjs',
  loader: { '.sql': 'text' },
  define: { __VERSAO_APP__: JSON.stringify(pkg.version) },
  external: ['electron', 'pg', 'pg-native', 'bcryptjs']
}

const mainCtx = await context({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.js' })
const preCtx = await context({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.js' })
await mainCtx.rebuild()
await preCtx.rebuild()

const vite = spawn('npx', ['vite'], { stdio: 'inherit', shell: true })

await new Promise(r => setTimeout(r, 2500))

const app = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, ESTRUDENA_DEV_URL: 'http://localhost:5219' }
})

const stop = () => { try { vite.kill() } catch {} ; try { app.kill() } catch {} ; process.exit(0) }
app.on('close', stop)
process.on('SIGINT', stop)
