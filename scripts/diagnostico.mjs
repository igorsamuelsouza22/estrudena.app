/**
 * Navega por todas as telas do perfil e confere título, item de menu ativo,
 * corpo renderizado e erros de console.
 *
 *   node scripts/diagnostico.mjs [usuario] [senha]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electron from 'electron'

const USUARIO = process.argv[2] ?? 'wilson'
const SENHA = process.argv[3] ?? 'estrudena'

const tmp = mkdtempSync(join(tmpdir(), 'estrudena-diag-'))
const driver = join(tmp, 'driver.cjs')

writeFileSync(driver, `
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const { app, BrowserWindow } = require('electron')
// Pasta de dados propria: o bloqueio de instancia unica e por userData, entao o
// teste roda mesmo com o sistema instalado aberto, e nao mexe no estado dele.
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'estrudena-teste-')))
require(${JSON.stringify(join(resolve('.'), 'dist-electron', 'main.js'))})

const espera = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  await espera(1500)
  const win = BrowserWindow.getAllWindows()[0]
  win.webContents.on('console-message', (_e, nivel, msg) => {
    if (nivel >= 2) console.log('  CONSOLE[' + nivel + '] ' + msg)
  })

  for (let i = 0; i < 60; i++) {
    if (await win.webContents.executeJavaScript("!!document.querySelector('input[autocomplete=username]')")) break
    await espera(1000)
  }

  const digitar = (sel, val) => win.webContents.executeJavaScript(\`(() => {
    const el = document.querySelector(\${JSON.stringify(sel)})
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, \${JSON.stringify(val)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()\`)

  await digitar('input[autocomplete=username]', ${JSON.stringify(USUARIO)})
  await digitar('input[autocomplete=current-password]', ${JSON.stringify(SENHA)})
  await win.webContents.executeJavaScript(
    "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Entrar').click()")
  await espera(2500)

  const rotulos = ['Visão geral','Orçamento','Propostas','Clientes','Separação',
    'Itens e materiais','Cores e pintura','Acessórios','Kits de ferragem','Kits de venda',
    'Instaladores','Relatórios','Usuários','Configurações']

  let erros = 0
  for (const rotulo of rotulos) {
    const r = await win.webContents.executeJavaScript(\`(() => {
      const btn = [...document.querySelectorAll('aside button.navbtn')]
        .find(b => b.textContent.trim().startsWith(\${JSON.stringify(rotulo)}))
      if (!btn) return { erro: 'menu ausente' }
      btn.click()
      return { clicado: true }
    })()\`)
    // Menu ausente é esperado nos perfis restritos — só registra.
    if (r.erro) { console.log(rotulo.padEnd(20) + ' — fora do perfil'); continue }
    await espera(700)
    const estado = await win.webContents.executeJavaScript(\`(() => {
      const h = document.querySelector('header')
      const ativo = document.querySelector('aside button.navbtn.on')
      const corpo = document.querySelector('.appscroll')
      return {
        // Sem regex: este trecho passa por dois níveis de template literal e
        // qualquer barra invertida chegaria mutilada no renderer.
        titulo: h ? h.innerText.split(String.fromCharCode(10)).join(' / ').trim().slice(0, 44) : '(sem header)',
        ativo: ativo ? ativo.textContent.trim() : '(nenhum)',
        vazio: !corpo || corpo.innerText.trim().length < 20
      }
    })()\`)
    const bate = estado.ativo.startsWith(rotulo)
    if (!bate || estado.vazio) erros++
    console.log(
      rotulo.padEnd(20) + ' menu=' + estado.ativo.padEnd(20) +
      ' header=' + estado.titulo.padEnd(34) +
      (estado.vazio ? ' CORPO VAZIO' : '') + (bate ? '' : ' <<< DIVERGE'))
  }

  console.log('')
  console.log('modal inserir item:')
  const temOrcamento = await win.webContents.executeJavaScript(\`(() => {
    const b = [...document.querySelectorAll('aside button.navbtn')]
      .find(x => x.textContent.trim().startsWith('Orçamento'))
    if (!b) return false
    b.click()
    return true
  })()\`)
  if (!temOrcamento) {
    console.log('  Orçamento fora do perfil — modal não se aplica')
    console.log('')
    console.log(erros ? erros + ' PROBLEMA(S)' : 'todas as telas do perfil OK')
    app.exit(erros ? 1 : 0)
    return
  }
  await espera(800)
  const modal = await win.webContents.executeJavaScript(\`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '+ Inserir item')
    if (!b) return 'botão ausente'
    b.click()
    return 'clicado'
  })()\`)
  await espera(800)
  const abriu = await win.webContents.executeJavaScript("!!document.querySelector('.dialog-backdrop')")
  console.log('  ' + modal + ' → dialog presente: ' + abriu)
  if (!abriu) erros++

  console.log('')
  console.log(erros ? erros + ' PROBLEMA(S)' : 'todas as telas do perfil OK')
  app.exit(erros ? 1 : 0)
})
`, 'utf8')

spawn(electron, [driver], { stdio: 'inherit' }).on('close', c => process.exit(c ?? 0))
