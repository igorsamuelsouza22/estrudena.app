/**
 * Confere que a faixa mostra o progresso enquanto baixa de verdade do GitHub.
 *
 * Compila o processo principal com uma versão propositalmente antiga, para que
 * a release publicada apareça como novidade e o download aconteça. Amostra a
 * faixa durante o download e verifica se a porcentagem e a barra avançam.
 *
 *   node scripts/teste-progresso.mjs
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electron from 'electron'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const VERSAO_FALSA = '0.0.1'
console.log(`compilando o processo principal como ${VERSAO_FALSA} (real: ${pkg.version})`)

// Precisa ficar em dist-electron: o main resolve o preload e a interface a
// partir do proprio diretorio. Removido no fim para nao ir junto no instalador.
const saidaMain = join(process.cwd(), 'dist-electron', 'main-teste.js')
await build({
  entryPoints: ['electron/main.ts'],
  outfile: saidaMain,
  platform: 'node', target: 'node20', bundle: true, format: 'cjs',
  loader: { '.sql': 'text' },
  define: { __VERSAO_APP__: JSON.stringify(VERSAO_FALSA) },
  external: ['electron', 'pg', 'pg-native', 'bcryptjs']
})

const tmp = mkdtempSync(join(tmpdir(), 'estrudena-prog-'))
const driver = join(tmp, 'driver.cjs')

writeFileSync(driver, `
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const { app, BrowserWindow, shell } = require('electron')

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'estrudena-teste-')))
shell.openPath = async () => ''

require(${JSON.stringify(saidaMain)})
app.quit = () => {}

const espera = ms => new Promise(r => setTimeout(r, ms))
let win = null, falhas = 0
const ok = (c, d, e) => {
  if (c) console.log('  ok    ' + d)
  else { falhas++; console.log('  FALHA ' + d + (e === undefined ? '' : ' -> ' + JSON.stringify(e))) }
}
const js = c => win.webContents.executeJavaScript(c)

app.whenReady().then(async () => {
  await espera(1500)
  win = BrowserWindow.getAllWindows()[0]
  win.webContents.on('console-message', (_e, n, m) => { if (n >= 2) console.log('  CONSOLE ' + m) })

  for (let i = 0; i < 60; i++) {
    if (await js("!!document.querySelector('input[autocomplete=username]')")) break
    await espera(1000)
  }
  const setar = (sel, val) => js(\`(() => {
    const el = document.querySelector(\${JSON.stringify(sel)})
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(el, \${JSON.stringify(val)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()\`)
  await setar('input[autocomplete=username]', 'wilson')
  await setar('input[autocomplete=current-password]', 'estrudena')
  await js("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Entrar').click()")
  // Sem espera aqui: o download comeca assim que a tela monta e, numa conexao
  // rapida, acaba antes de qualquer pausa generosa.

  // A amostragem precisa comecar junto com o download: numa conexao rapida os
  // 108 MB terminam em poucos segundos, e uma consulta antes disso ja perderia
  // a fase de progresso inteira.
  console.log('— amostrando a faixa durante o download —')
  const amostras = []
  let pronto = false
  for (let i = 0; i < 600; i++) {
    const a = await js(\`(() => {
      const barra = document.querySelector('.barra-atualizacao')
      const preenchida = barra && barra.firstElementChild
      const texto = [...document.querySelectorAll('span')]
        .map(s => s.textContent.trim())
        .find(t => /^Baixando/.test(t) || /^Baixado/.test(t))
      return {
        temBarra: !!barra,
        indefinida: barra ? barra.className.includes('indefinida') : null,
        largura: preenchida ? preenchida.style.width : '',
        texto: texto || ''
      }
    })()\`)
    if (a.temBarra || a.texto) amostras.push(a)
    if (/^Baixado/.test(a.texto)) { pronto = true; break }
    await espera(60)
  }

  const entrou = await js("!!document.querySelector('aside button.navbtn')")
  ok(entrou, 'entrou no sistema')
  const estado = await js("window.estrudena.estadoAtualizacao().then(r => r.ok ? r.dados : { erro: r.erro })")
  ok(estado && estado.temNova, 'sistema enxerga versao mais nova', estado && estado.disponivel && estado.disponivel.versao)

  const comBarra = amostras.filter(a => a.temBarra)
  const pcts = [...new Set(comBarra.map(a => parseInt(a.largura, 10)).filter(n => !isNaN(n)))]
  const textos = [...new Set(amostras.map(a => a.texto).filter(Boolean))]

  ok(comBarra.length > 0, 'barra de progresso aparece durante o download', comBarra.length + ' amostras')
  // Antes do primeiro byte nao ha total conhecido: a barra comeca indeterminada
  // e passa a mostrar porcentagem assim que o download responde. As duas fases
  // sao esperadas.
  ok(comBarra.some(a => a.indefinida === false), 'barra passa a mostrar porcentagem')
  ok(comBarra[comBarra.length - 1].indefinida === false, 'termina em modo porcentagem')
  console.log('  larguras observadas: ' + pcts.map(p => p + '%').join(' → '))
  ok(pcts.length >= 3, 'a barra avanca em varios passos', pcts.length + ' passos')
  ok(Math.max(...pcts) > Math.min(...pcts), 'largura cresce', { de: Math.min(...pcts), ate: Math.max(...pcts) })
  ok(textos.some(t => /Baixando \\d+% · .* de .*MB/.test(t)), 'texto mostra porcentagem e MB', textos.slice(0, 3))
  ok(pronto, 'terminou e informou que esta baixado', textos[textos.length - 1])

  const botao = await js(\`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /Instalar agora/.test(x.textContent))
    return b ? { rotulo: b.textContent.trim(), habilitado: !b.disabled } : null
  })()\`)
  ok(botao && botao.habilitado, 'botao Instalar agora liberado ao terminar', botao)

  console.log('')
  console.log(falhas ? falhas + ' FALHA(S)' : 'progresso da atualizacao OK')
  app.exit(falhas ? 1 : 0)
})
`, 'utf8')

spawn(electron, [driver], { stdio: 'inherit' }).on('close', c => {
  // Sem isto o main de teste iria parar dentro do instalador.
  rmSync(saidaMain, { force: true })
  process.exit(c ?? 0)
})
