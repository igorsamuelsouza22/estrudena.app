/**
 * Confere a mensagem que o terminal mostra quando não acha o servidor.
 *
 * Aponta a camada de dados para uma porta onde não há nada escutando, deixa a
 * varredura falhar de verdade e verifica que a mensagem diz em quais redes ela
 * procurou — é isso que separa "servidor desligado" de "terminal na rede
 * errada" para quem está na frente da tela.
 *
 *   node scripts/teste-descoberta.mjs
 */
import { build } from 'esbuild'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import os from 'node:os'

const PORTA_MORTA = 55432

const tmp = mkdtempSync(join(tmpdir(), 'estrudena-desc-'))
const stubElectron = join(tmp, 'electron-stub.mjs')
const stubCred = join(tmp, 'credentials-stub.ts')
const entrada = join(tmp, 'entrada.ts')

writeFileSync(stubElectron, `
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const dados = mkdtempSync(join(tmpdir(), 'estrudena-userdata-'))
export const app = { getPath: () => dados, getVersion: () => '0.0.0-teste' }
export default { app }
`)

// Mesmas credenciais, porta onde ninguém atende: a varredura roda inteira e
// termina sem achar, que é exatamente o caso que queremos ver na tela.
writeFileSync(stubCred, `
export const DB_NAME = 'estrudena'
export const DB_USER = 'estrudena'
export const DB_PASSWORD = 'Estrud3na!Db'
export const DB_PORT = ${PORTA_MORTA}
export const SCAN_PORT = DB_PORT
`)

writeFileSync(entrada, `
import { conectar } from '${join(process.cwd(), 'electron', 'db', 'pool').replace(/\\/g, '/')}'
const etapas: string[] = []
conectar(undefined, e => etapas.push(e)).then(st => {
  console.log(JSON.stringify({ status: st.status, mensagem: st.mensagem, etapas }))
})
`)

const cache = join(process.cwd(), 'node_modules', '.cache', 'estrudena')
mkdirSync(cache, { recursive: true })
const saida = join(cache, 'teste-descoberta.cjs')

// esbuild não redireciona caminhos relativos por `alias`; o plugin faz isso.
const trocarCredenciais = {
  name: 'credenciais-de-teste',
  setup(b) {
    b.onResolve({ filter: /(^|\/)credentials$/ }, () => ({ path: stubCred }))
  }
}

await build({
  entryPoints: [entrada],
  outfile: saida,
  platform: 'node', target: 'node20', bundle: true, format: 'cjs',
  loader: { '.sql': 'text' },
  external: ['pg', 'bcryptjs'],
  alias: { electron: stubElectron },
  plugins: [trocarCredenciais]
})

const require_ = createRequire(join(process.cwd(), 'package.json'))
const { execFileSync } = require_('node:child_process')

console.log(`procurando na porta ${PORTA_MORTA}, onde nao ha ninguem…`)
const bruto = execFileSync(process.execPath, [saida], { encoding: 'utf8', timeout: 300_000 })
const r = JSON.parse(bruto.trim().split('\n').pop())

let falhas = 0
const ok = (c, d, e) => {
  if (c) console.log('  ok    ' + d)
  else { falhas++; console.log('  FALHA ' + d + (e === undefined ? '' : ' -> ' + JSON.stringify(e))) }
}

// As redes que a máquina realmente tem precisam aparecer na mensagem.
const prefixos = []
for (const lista of Object.values(os.networkInterfaces())) {
  for (const nic of lista ?? []) {
    if (nic.family !== 'IPv4' || nic.internal) continue
    if (nic.address.startsWith('169.254.')) continue
    prefixos.push(nic.address.split('.').slice(0, 3).join('.') + '.0/24')
  }
}

console.log('  mensagem: ' + JSON.stringify(r.mensagem))
ok(r.status === 'erro', 'termina em erro quando nao acha', r.status)
ok(/Não encontrei o servidor/.test(r.mensagem), 'diz que nao encontrou')
ok(prefixos.every(p => r.mensagem.includes(p)), 'lista as redes varridas', { esperado: prefixos })
ok(/informe o endereço dele abaixo/.test(r.mensagem), 'oferece informar o endereco na mao')
ok(r.etapas.some(e => /Varrendo a rede/.test(e)), 'varreu de fato', r.etapas.slice(0, 4))

console.log('')
console.log(falhas ? falhas + ' FALHA(S)' : 'descoberta OK')
process.exit(falhas ? 1 : 0)
