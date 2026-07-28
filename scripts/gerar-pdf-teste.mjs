/**
 * Exercita o fluxo real de geração de PDF e analisa o resultado.
 *
 * Percorre: Propostas → "salvar pdf" (proposta comercial) e
 * Separação → "Salvar pedido em PDF". A janela de salvar arquivo é
 * interceptada, senão o teste travaria esperando um clique.
 *
 *   node scripts/gerar-pdf-teste.mjs <pasta-de-saida>
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electron from 'electron'

const SAIDA = resolve(process.argv[2] ?? 'pdfs')
mkdirSync(SAIDA, { recursive: true })

const tmp = mkdtempSync(join(tmpdir(), 'estrudena-pdf-'))
const driver = join(tmp, 'driver.cjs')

writeFileSync(driver, `
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const { app, BrowserWindow, dialog } = require('electron')
// Pasta de dados propria: o bloqueio de instancia unica e por userData, entao o
// teste roda mesmo com o sistema instalado aberto, e nao mexe no estado dele.
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'estrudena-teste-')))

const SAIDA = ${JSON.stringify(SAIDA)}

// Intercepta a janela de salvar: o aplicativo segue o caminho normal e o
// arquivo cai numa pasta conhecida.
let n = 0
const nomes = []
dialog.showSaveDialog = async (_win, opcoes) => {
  const nome = path.basename(opcoes.defaultPath || ('doc-' + (++n) + '.pdf'))
  const destino = path.join(SAIDA, nome)
  nomes.push(destino)
  return { canceled: false, filePath: destino }
}

require(${JSON.stringify(join(resolve('.'), 'dist-electron', 'main.js'))})

const espera = ms => new Promise(r => setTimeout(r, ms))

// Aguarda até que a quantidade de arquivos salvos chegue a \`alvo\`, relatando
// o estado da area de impressao se estourar o tempo.
let janela = null
async function esperarArquivo(alvo) {
  for (let i = 0; i < 30; i++) {
    if (nomes.length >= alvo) { await espera(400); return true }
    await espera(1000)
  }
  const estado = await janela.webContents.executeJavaScript(\`(() => {
    const folhas = document.querySelectorAll('.printdoc')
    const flash = document.querySelector('.flash')
    return {
      printdocs: folhas.length,
      classes: [...folhas].map(f => f.className),
      flash: flash ? flash.textContent : '(sem aviso)'
    }
  })()\`)
  console.log('  TIMEOUT esperando arquivo ' + alvo + ' -> ' + JSON.stringify(estado))
  return false
}

app.whenReady().then(async () => {
  await espera(1500)
  const win = BrowserWindow.getAllWindows()[0]
  janela = win
  win.webContents.on('console-message', (_e, nivel, m) => { if (nivel >= 2) console.log('CONSOLE ' + m) })

  for (let i = 0; i < 60; i++) {
    if (await win.webContents.executeJavaScript("!!document.querySelector('input[autocomplete=username]')")) break
    await espera(1000)
  }
  const digitar = (sel, val) => win.webContents.executeJavaScript(\`(() => {
    const el = document.querySelector(\${JSON.stringify(sel)})
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, \${JSON.stringify(val)}); el.dispatchEvent(new Event('input', { bubbles: true }))
  })()\`)
  await digitar('input[autocomplete=username]', 'wilson')
  await digitar('input[autocomplete=current-password]', 'estrudena')
  await win.webContents.executeJavaScript(
    "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Entrar').click()")
  await espera(2500)

  // O teste precisa de propostas com desenhos; carrega o conjunto de exemplo
  // se a base estiver vazia.
  const preparou = await win.webContents.executeJavaScript(\`
    window.estrudena.carregar().then(r => {
      if (!r.ok) return 'erro: ' + r.erro
      if (r.dados.orcamentos.length) return 'base ja tem ' + r.dados.orcamentos.length + ' propostas'
      return window.estrudena.restaurarExemplo().then(x =>
        x.ok ? 'dados de exemplo carregados' : 'falhou: ' + x.erro)
    })\`)
  console.log('preparacao: ' + preparou)
  if (String(preparou).includes('exemplo')) {
    win.reload()
    await espera(3000)
    for (let i = 0; i < 60; i++) {
      if (await win.webContents.executeJavaScript("!!document.querySelector('input[autocomplete=username]')")) break
      await espera(1000)
    }
    await digitar('input[autocomplete=username]', 'wilson')
    await digitar('input[autocomplete=current-password]', 'estrudena')
    await win.webContents.executeJavaScript(
      "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Entrar').click()")
    await espera(2500)
  }

  const menu = rotulo => win.webContents.executeJavaScript(
    "(() => { const b = [...document.querySelectorAll('aside button.navbtn')].find(x => x.textContent.trim().startsWith(" +
    JSON.stringify(rotulo) + ")); if (!b) return false; b.click(); return true })()")

  console.log('menu tem Proposta / PDF (nao deveria): ' + await menu('Proposta / PDF'))

  // --- proposta comercial, pela lista de propostas ---
  await menu('Propostas')
  await espera(1500)
  // Escolhe uma proposta que tenha desenhos de tipologia, para valer como teste.
  const clicou = await win.webContents.executeJavaScript(\`(() => {
    const linha = [...document.querySelectorAll('tbody tr')]
      .find(tr => tr.textContent.includes('8026-01-26'))
      || document.querySelector('tbody tr')
    if (!linha) return 'sem linhas'
    const b = [...linha.querySelectorAll('button')].find(x => x.textContent.trim() === 'salvar pdf')
    if (!b) return 'sem botao'
    b.click(); return linha.textContent.slice(0, 22)
  })()\`)
  console.log('clicou em "salvar pdf" na linha: ' + clicou)
  await esperarArquivo(1)

  // --- pedido de separacao ---
  await menu('Separação')
  await espera(1800)
  const clicou2 = await win.webContents.executeJavaScript(\`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Salvar pedido em PDF')
    if (!b) return false
    b.click(); return true
  })()\`)
  console.log('clicou em "Salvar pedido em PDF": ' + clicou2)
  await esperarArquivo(2)

  console.log('arquivos gerados:')
  nomes.forEach(x => console.log('  ' + path.basename(x)))
  console.log('FIM')
  app.exit(0)
})
`, 'utf8')

spawn(electron, [driver], { stdio: 'inherit' }).on('close', c => process.exit(c ?? 0))
