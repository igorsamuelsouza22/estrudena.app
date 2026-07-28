/**
 * Verifica o caminho de quem ignora a faixa: com a atualização já baixada,
 * fechar o sistema deve oferecer instalar.
 *
 * O diálogo do Windows e a execução do instalador são interceptados.
 *
 *   node scripts/teste-instalar-ao-fechar.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electron from 'electron'

const pasta = resolve('release')
const achado = existsSync(pasta)
  ? readdirSync(pasta).find(f => /^Sistema-Estrudena-Setup-.*\.exe$/.test(f))
  : undefined
if (!achado) {
  console.error(`Nenhum instalador em ${pasta}. Rode "npm run dist" antes.`)
  process.exit(1)
}
const INSTALADOR = join(pasta, achado)

const tmp = mkdtempSync(join(tmpdir(), 'estrudena-fechar-'))
const driver = join(tmp, 'driver.cjs')

writeFileSync(driver, `
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const { app, BrowserWindow, dialog, shell } = require('electron')

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'estrudena-teste-')))

const INSTALADOR = ${JSON.stringify(INSTALADOR)}
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [INSTALADOR] })

// Registra o dialogo de saida e responde "Instalar agora".
let perguntou = null
const originalMsgBox = dialog.showMessageBox
dialog.showMessageBox = async (win, opcoes) => {
  perguntou = { titulo: opcoes.title, mensagem: opcoes.message, botoes: opcoes.buttons }
  return { response: 0 }
}

let abriu = null
shell.openPath = async caminho => { abriu = caminho; return '' }

require(${JSON.stringify(join(resolve('.'), 'dist-electron', 'main.js'))})

// Destruir a janela encerraria o processo antes das verificacoes; o teste
// controla a saida com app.exit no fim.
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
  await espera(2500)

  console.log('— preparando uma versao mais nova —')
  await js("[...document.querySelectorAll('aside button.navbtn')].find(x => x.textContent.trim().startsWith('Configurações')).click()")
  await espera(1500)
  await js(\`(() => {
    const alvo = [...document.querySelectorAll('input')].find(i => i.placeholder === '1.1.0')
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(alvo, '9.9.8')
    alvo.dispatchEvent(new Event('input', { bubbles: true }))
  })()\`)
  await js("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Escolher instalador e publicar')).click()")
  for (let i = 0; i < 60; i++) {
    const v = await js("window.estrudena.estadoAtualizacao().then(x => x.ok && x.dados.disponivel ? x.dados.disponivel.versao : '')")
    if (v === '9.9.8') break
    await espera(1000)
  }

  console.log('— o terminal baixa sozinho e a pessoa ignora —')
  win.reload()
  await espera(3000)
  for (let i = 0; i < 60; i++) {
    if (await js("!!document.querySelector('input[autocomplete=username]')")) break
    await espera(1000)
  }
  await setar('input[autocomplete=username]', 'wilson')
  await setar('input[autocomplete=current-password]', 'estrudena')
  await js("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Entrar').click()")
  await espera(2500)

  let pendente = null
  for (let i = 0; i < 90; i++) {
    pendente = await js("window.estrudena.atualizacaoPendente().then(r => r.ok ? r.dados : null)")
    if (pendente) break
    await espera(1000)
  }
  ok(!!pendente, 'atualizacao baixada em segundo plano', pendente && pendente.versao)

  // A pessoa clica em "agora nao" e segue trabalhando.
  await js(\`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'agora não')
    if (b) b.click()
  })()\`)
  await espera(600)
  const faixaSumiu = await js(
    "![...document.querySelectorAll('*')].some(e => e.children.length === 0 && /disponível/.test(e.textContent))")
  ok(faixaSumiu, 'faixa some ao dispensar')

  // Limpa a versao de teste antes de fechar: depois disso a janela ja era.
  const limpou = await js("window.estrudena.removerVersao('9.9.8').then(r => r.ok)")
  console.log('  limpeza da versao 9.9.8: ' + limpou)

  console.log('— fechando o sistema —')
  win.close()
  await espera(2500)

  ok(!!perguntou, 'perguntou se quer instalar ao fechar', perguntou)
  ok(perguntou && /9\\.9\\.8/.test(perguntou.mensagem), 'a pergunta cita a versao', perguntou && perguntou.mensagem)
  ok(perguntou && perguntou.botoes[0] === 'Instalar agora', 'primeiro botao instala', perguntou && perguntou.botoes)
  ok(!!abriu, 'instalador aberto ao confirmar', abriu)
  if (abriu && fs.existsSync(abriu)) fs.unlinkSync(abriu)

  console.log('')
  console.log(falhas ? falhas + ' FALHA(S)' : 'instalar-ao-fechar OK')
  app.exit(falhas ? 1 : 0)
})
`, 'utf8')

spawn(electron, [driver], { stdio: 'inherit' }).on('close', c => process.exit(c ?? 0))
