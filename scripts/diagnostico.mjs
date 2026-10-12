/**
 * Navega por todas as telas do perfil e confere item de menu ativo, trilha,
 * corpo renderizado e erros de console. Só lê: não grava nada no banco.
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

  // Itens do menu lateral. Catálogo e Gestão são grupos que já abrem expandidos.
  const rotulos = ['Início', 'Orçamentos', 'Pedidos de venda',
    'Produtos', 'Matérias-primas', 'Cadastros de apoio',
    'Produção', 'Clientes',
    'Resultados', 'Configurações', 'Pessoas e acessos']

  // Rótulo de um botão do menu, sem o ícone nem a seta dos grupos.
  const ROTULO = "b => (b.querySelector('span') || b).textContent.trim()"
  const MENU = "document.querySelectorAll('nav[aria-label=\\"Áreas do sistema\\"] button.navbtn')"

  let erros = 0
  if (!await win.webContents.executeJavaScript(MENU + '.length')) {
    console.log('menu lateral não apareceu — o login falhou?')
    app.exit(1)
    return
  }

  // Um item novo ou renomeado no menu tem que entrar na lista acima.
  const extras = await win.webContents.executeJavaScript(\`[...\${MENU}]
    .filter(b => !b.hasAttribute('aria-expanded')).map(\${ROTULO})
    .filter(r => !\${JSON.stringify(rotulos)}.includes(r))\`)
  for (const r of extras) { erros++; console.log(r.padEnd(24) + ' <<< item de menu fora da lista do diagnóstico') }

  const conferir = async rotulo => {
    await espera(700)
    const estado = await win.webContents.executeJavaScript(\`(() => {
      const trilha = document.querySelector('header .breadcrumb')
      const ativo = document.querySelector('nav[aria-label="Áreas do sistema"] button[aria-current=page]')
      const corpo = document.querySelector('.appscroll')
      return {
        // Sem regex: este trecho passa por dois níveis de template literal e
        // qualquer barra invertida chegaria mutilada no renderer.
        titulo: trilha ? trilha.innerText.split(String.fromCharCode(10)).join(' ').trim().slice(0, 44) : '(sem trilha)',
        ativo: ativo ? (\${ROTULO})(ativo) : '(nenhum)',
        vazio: !corpo || corpo.innerText.trim().length < 20
      }
    })()\`)
    const bate = estado.ativo === rotulo
    if (!bate || estado.vazio) erros++
    return estado.ativo.padEnd(24) + ' trilha=' + estado.titulo.padEnd(40) +
      (estado.vazio ? ' CORPO VAZIO' : '') + (bate ? '' : ' <<< DIVERGE')
  }

  const clicarMenu = rotulo => win.webContents.executeJavaScript(\`(() => {
    const btn = [...\${MENU}].find(b => (\${ROTULO})(b) === \${JSON.stringify(rotulo)})
    if (!btn) return false
    btn.click()
    return true
  })()\`)

  for (const rotulo of rotulos) {
    // Menu ausente é esperado nos perfis restritos — só registra.
    if (!await clicarMenu(rotulo)) { console.log(rotulo.padEnd(24) + ' — fora do perfil'); continue }
    console.log(rotulo.padEnd(24) + ' menu=' + await conferir(rotulo))

    // Os cadastros de apoio ficam em cartões dentro da tela, não no menu.
    if (rotulo !== 'Cadastros de apoio') continue
    const cartoes = await win.webContents.executeJavaScript(
      "[...document.querySelectorAll('.settings-link strong')].map(s => s.textContent.trim())")
    for (const cartao of cartoes) {
      await win.webContents.executeJavaScript(\`[...document.querySelectorAll('.settings-link')]
        .find(b => b.querySelector('strong').textContent.trim() === \${JSON.stringify(cartao)}).click()\`)
      console.log(('  ' + cartao).padEnd(24) + ' menu=' + await conferir(rotulo))
      await win.webContents.executeJavaScript(
        "[...document.querySelectorAll('button.back-button')].find(b => b.textContent.includes('Cadastros de apoio')).click()")
      await espera(400)
    }
  }

  console.log('')
  console.log('modal inserir produto:')
  // Novo orçamento sem salvar: o rascunho fica só na pasta de dados temporária.
  await clicarMenu('Início')
  await espera(600)
  const temOrcamento = await win.webContents.executeJavaScript(\`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '+ Novo orçamento')
    if (!b) return false
    b.click()
    return true
  })()\`)
  if (!temOrcamento) {
    console.log('  Orçamentos fora do perfil — modal não se aplica')
    console.log('')
    console.log(erros ? erros + ' PROBLEMA(S)' : 'todas as telas do perfil OK')
    app.exit(erros ? 1 : 0)
    return
  }
  await espera(800)
  // O orçamento abre na etapa do cliente; os produtos ficam na etapa seguinte.
  await win.webContents.executeJavaScript(
    "[...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Continuar →')?.click()")
  await espera(600)
  const modal = await win.webContents.executeJavaScript(\`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '+ Inserir produto')
    if (!b) return 'botão ausente'
    b.click()
    return 'clicado'
  })()\`)
  await espera(800)
  const abriu = await win.webContents.executeJavaScript("!!document.querySelector('[role=dialog][aria-label=\\"Inserir produto\\"]')")
  console.log('  ' + modal + ' → dialog presente: ' + abriu)
  if (!abriu) erros++

  console.log('')
  console.log(erros ? erros + ' PROBLEMA(S)' : 'todas as telas do perfil OK')
  app.exit(erros ? 1 : 0)
})
`, 'utf8')

const env = { ...process.env }
delete env.ESTRUDENA_DEV_URL
delete env.ELECTRON_RUN_AS_NODE
spawn(electron, [driver], { stdio: 'inherit', env }).on('close', c => process.exit(c ?? 0))
