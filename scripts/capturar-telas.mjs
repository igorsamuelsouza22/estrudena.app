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

// Clica no primeiro elemento do seletor cujo rótulo é exatamente o texto.
// No menu lateral, o rótulo é o primeiro <span> (sem o ícone e a seta dos grupos);
// nos cartões de Cadastros de apoio, é o <strong>.
async function clicar(win, seletor, texto) {
  return win.webContents.executeJavaScript(\`(() => {
    const alvo = [...document.querySelectorAll(\${JSON.stringify(seletor)})]
      .find(e => (e.querySelector('strong') || e.querySelector('span') || e).textContent.trim() === \${JSON.stringify(texto)})
    if (!alvo) return 'não achei: ' + \${JSON.stringify(texto)}
    alvo.click()
    return 'ok'
  })()\`)
}
const MENU = 'nav[aria-label="Áreas do sistema"] button.navbtn'
const clicarMenu = (win, rotulo) => clicar(win, MENU, rotulo)
const clicarBotao = (win, texto) => win.webContents.executeJavaScript(\`(() => {
  const alvo = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === \${JSON.stringify(texto)})
  if (!alvo) return 'não achei: ' + \${JSON.stringify(texto)}
  alvo.click()
  return 'ok'
})()\`)

app.whenReady().then(async () => {
  await espera(1500)
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) { console.error('nenhuma janela'); app.exit(1); return }

  // O app abre maximizado, e uma janela maximizada ignora setSize.
  win.unmaximize()
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
  console.log(await clicarBotao(win, 'Entrar'))
  await espera(2500)
  if (!await win.webContents.executeJavaScript(\`document.querySelectorAll(\${JSON.stringify(MENU)}).length\`)) {
    console.error('menu lateral não apareceu — o login falhou?')
    app.exit(1)
    return
  }

  // Itens do menu lateral; os cadastros de apoio são cartões dentro da tela deles.
  const telas = [
    ['02-inicio', 'Início'],
    ['03-orcamentos', 'Orçamentos'],
    ['04-pedidos-de-venda', 'Pedidos de venda'],
    ['05-produtos', 'Produtos'],
    ['06-materias-primas', 'Matérias-primas'],
    ['07-cadastros-de-apoio', 'Cadastros de apoio'],
    ['08-ferragens-e-acessorios', 'Cadastros de apoio', 'Ferragens e acessórios'],
    ['09-kits-de-ferragem', 'Cadastros de apoio', 'Kits de ferragem'],
    ['10-kits-de-venda', 'Cadastros de apoio', 'Kits de venda'],
    ['11-cores-e-acabamentos', 'Cadastros de apoio', 'Cores e acabamentos'],
    ['12-equipes-de-instalacao', 'Cadastros de apoio', 'Equipes de instalação'],
    ['13-producao', 'Produção'],
    ['14-clientes', 'Clientes'],
    ['15-resultados', 'Resultados'],
    ['16-configuracoes', 'Configurações'],
    ['17-pessoas-e-acessos', 'Pessoas e acessos']
  ]

  for (const [arquivo, rotulo, cartao] of telas) {
    let r = await clicarMenu(win, rotulo)
    if (r === 'ok' && cartao) {
      await espera(500)
      r = await clicar(win, '.settings-link', cartao)
    }
    if (r !== 'ok') { console.log('pulando ' + (cartao || rotulo) + ': ' + r); continue }
    await espera(900)
    await foto(win, arquivo)
  }

  // Novo orçamento (sem salvar) e o modal de inserir produto, na etapa de produtos.
  await clicarMenu(win, 'Início')
  await espera(600)
  if (await clicarBotao(win, '+ Novo orçamento') === 'ok') {
    await espera(800)
    await clicarBotao(win, 'Continuar →')
    await espera(600)
    await foto(win, '18-novo-orcamento')
    if (await clicarBotao(win, '+ Inserir produto') === 'ok') {
      await foto(win, '19-modal-inserir-produto')
    }
  }

  console.log('FIM')
  app.exit(0)
})
`, 'utf8')

const env = { ...process.env }
delete env.ESTRUDENA_DEV_URL
delete env.ELECTRON_RUN_AS_NODE
const proc = spawn(electron, [driver], { stdio: 'inherit', env })
proc.on('close', codigo => process.exit(codigo ?? 0))
