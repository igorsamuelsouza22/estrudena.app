/**
 * Abre o aplicativo real, entra como um usuário e fotografa as telas.
 * Serve para conferir o resultado contra o handoff de design.
 *
 *   node scripts/capturar-telas.mjs <pasta-de-saida> [usuario] [senha]
 *
 * Precisa de um PostgreSQL respondendo — o app se conecta sozinho.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import electron from 'electron'

const SAIDA = resolve(process.argv[2] ?? 'capturas')
const USUARIO = process.argv[3] ?? 'wilson'
const SENHA = process.argv[4] ?? 'estrudena'

mkdirSync(SAIDA, { recursive: true })

const driver = join(SAIDA, '_driver.cjs')

// Roda dentro do Electron, no lugar do main.js: sobe a mesma janela do app,
// conduz o login pelo DOM e fotografa cada tela.
writeFileSync(driver, `
const path = require('node:path')
const fs = require('node:fs')
const { app, BrowserWindow } = require('electron')
const os = require('node:os')
// Pasta de dados propria: o bloqueio de instancia unica e por userData, entao o
// teste roda mesmo com o sistema instalado aberto, e nao mexe no estado dele.
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'estrudena-teste-')))

const SAIDA = ${JSON.stringify(SAIDA)}
const USUARIO = ${JSON.stringify(USUARIO)}
const SENHA = ${JSON.stringify(SENHA)}
const RAIZ = ${JSON.stringify(resolve('.'))}

// Reaproveita todo o processo principal de produção (IPC, banco, etc).
process.env.ESTRUDENA_CAPTURA = '1'
require(path.join(RAIZ, 'dist-electron', 'main.js'))

const espera = ms => new Promise(r => setTimeout(r, ms))

// React ignora .value = x; é preciso usar o setter nativo e disparar o evento.
const DIGITAR = \`(function (seletor, valor) {
  const el = document.querySelectorAll(seletor)[arguments[2] || 0]
  if (!el) return 'sem elemento: ' + seletor
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, valor)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return 'ok'
})\`

async function foto(win, nome) {
  await espera(700)
  const img = await win.capturePage()
  fs.writeFileSync(path.join(SAIDA, nome + '.png'), img.toPNG())
  console.log('capturado ' + nome)
}

async function clicarTexto(win, texto) {
  return win.webContents.executeJavaScript(\`(() => {
    const alvo = [...document.querySelectorAll('button, a, .navbtn, .seg-opt, .linha')]
      .find(e => e.textContent.trim().startsWith(\${JSON.stringify(texto)}))
    if (!alvo) return 'não achei: ' + \${JSON.stringify(texto)}
    alvo.click()
    return 'ok'
  })()\`)
}

app.whenReady().then(async () => {
  await espera(1500)
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) { console.error('nenhuma janela'); app.exit(1); return }

  win.setSize(1440, 900)
  win.webContents.on('console-message', (_e, nivel, msg) => {
    if (nivel >= 2) console.log('CONSOLE[' + nivel + '] ' + msg)
  })

  // Espera a conexão com o banco terminar e o login aparecer.
  for (let i = 0; i < 60; i++) {
    const pronto = await win.webContents.executeJavaScript(
      "!!document.querySelector('input[autocomplete=username]')")
    if (pronto) break
    await espera(1000)
  }

  await foto(win, '01-login')

  await win.webContents.executeJavaScript(DIGITAR + "('input[autocomplete=username]', " + JSON.stringify(USUARIO) + ")")
  await win.webContents.executeJavaScript(DIGITAR + "('input[autocomplete=current-password]', " + JSON.stringify(SENHA) + ")")
  await espera(200)
  console.log(await clicarTexto(win, 'Entrar'))
  await espera(2500)

  const telas = [
    ['02-visao-geral', 'Visão geral'],
    ['03-orcamento', 'Orçamento'],
    ['04-proposta', 'Proposta / PDF'],
    ['05-propostas', 'Propostas'],
    ['06-separacao', 'Separação'],
    ['07-itens', 'Itens e materiais'],
    ['08-cores', 'Cores e pintura'],
    ['09-acessorios', 'Acessórios'],
    ['10-kits-ferragem', 'Kits de ferragem'],
    ['11-kits-venda', 'Kits de venda'],
    ['12-instaladores', 'Instaladores'],
    ['13-clientes', 'Clientes'],
    ['14-relatorios', 'Relatórios'],
    ['15-usuarios', 'Usuários'],
    ['16-configuracoes', 'Configurações']
  ]

  for (const [arquivo, rotulo] of telas) {
    const r = await clicarTexto(win, rotulo)
    if (r !== 'ok') { console.log('pulando ' + rotulo + ': ' + r); continue }
    await espera(900)
    await foto(win, arquivo)
  }

  // Modal de inserir item, sobre a tela de orçamento.
  if (await clicarTexto(win, 'Orçamento') === 'ok') {
    await espera(800)
    if (await clicarTexto(win, '+ Inserir item') === 'ok') {
      await foto(win, '17-modal-inserir-item')
    }
  }

  console.log('FIM')
  app.exit(0)
})
`, 'utf8')

const proc = spawn(electron, [driver], { stdio: 'inherit' })
proc.on('close', codigo => process.exit(codigo ?? 0))
