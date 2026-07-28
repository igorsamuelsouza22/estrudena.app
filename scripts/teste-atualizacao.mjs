/**
 * Exercita o canal de atualização de ponta a ponta:
 * publicar uma versão → o terminal perceber → baixar do servidor.
 *
 * O seletor de arquivo e a execução do instalador são interceptados; nada é
 * realmente instalado. A versão de teste é removida do banco no fim.
 *
 *   node scripts/teste-atualizacao.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electron from 'electron'

const INSTALADOR = resolve('release/Sistema-Estrudena-Setup-1.0.0.exe')
if (!existsSync(INSTALADOR)) {
  console.error(`Instalador não encontrado em ${INSTALADOR}. Rode "npm run dist" antes.`)
  process.exit(1)
}

const tmp = mkdtempSync(join(tmpdir(), 'estrudena-upd-'))
const driver = join(tmp, 'driver.cjs')

writeFileSync(driver, `
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const { app, BrowserWindow, dialog, shell } = require('electron')

// Pasta de dados própria: o bloqueio de instância única é por userData, então
// o teste roda mesmo com o sistema instalado aberto — e não mexe no estado dele.
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'estrudena-teste-')))

const INSTALADOR = ${JSON.stringify(INSTALADOR)}

// O usuario escolheria o arquivo aqui; o teste responde direto.
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [INSTALADOR] })

// Nada e realmente executado.
let abriu = null
shell.openPath = async caminho => { abriu = caminho; return '' }

require(${JSON.stringify(join(resolve('.'), 'dist-electron', 'main.js'))})

const espera = ms => new Promise(r => setTimeout(r, ms))
let win = null, falhas = 0
const ok = (cond, desc, extra) => {
  if (cond) console.log('  ok    ' + desc)
  else { falhas++; console.log('  FALHA ' + desc + (extra === undefined ? '' : ' -> ' + JSON.stringify(extra))) }
}
const js = c => win.webContents.executeJavaScript(c)

async function entrar() {
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
}

app.whenReady().then(async () => {
  await espera(1500)
  win = BrowserWindow.getAllWindows()[0]
  win.webContents.on('console-message', (_e, n, m) => { if (n >= 2) console.log('  CONSOLE ' + m) })
  await entrar()

  console.log('— publicando a versao 9.9.9 —')
  await js("[...document.querySelectorAll('aside button.navbtn')].find(x => x.textContent.trim().startsWith('Configurações')).click()")
  await espera(1500)

  const achouCartao = await js(
    "!![...document.querySelectorAll('*')].find(e => e.textContent.trim() === 'Atualização do sistema')")
  ok(achouCartao, 'cartao de atualizacao aparece em Configuracoes')

  await js(\`(() => {
    const campos = [...document.querySelectorAll('input')]
    const alvo = campos.find(i => i.placeholder === '1.1.0')
    if (!alvo) return false
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(alvo, '9.9.9')
    alvo.dispatchEvent(new Event('input', { bubbles: true }))
    const notas = campos.find(i => (i.placeholder || '').startsWith('ex.:'))
    if (notas) {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(notas, 'versao de teste')
      notas.dispatchEvent(new Event('input', { bubbles: true }))
    }
    return true
  })()\`)

  await js("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Escolher instalador e publicar')).click()")

  // Subir ~109 MB para o banco leva alguns segundos.
  let publicou = false
  for (let i = 0; i < 60; i++) {
    const r = await js("window.estrudena.estadoAtualizacao().then(x => x.ok && x.dados.disponivel ? x.dados.disponivel.versao : '')")
    if (r === '9.9.9') { publicou = true; break }
    await espera(1000)
  }
  ok(publicou, 'versao 9.9.9 registrada no servidor')

  const detalhe = await js("window.estrudena.estadoAtualizacao().then(x => x.dados)")
  ok(detalhe && detalhe.temNova, 'servidor indica versao mais nova que a local', detalhe && {
    local: detalhe.versaoLocal, publicada: detalhe.disponivel && detalhe.disponivel.versao
  })
  ok(detalhe && detalhe.disponivel && detalhe.disponivel.tamanho > 50 * 1024 * 1024,
     'instalador guardado inteiro no banco',
     detalhe && detalhe.disponivel && detalhe.disponivel.tamanho)

  console.log('— o terminal percebe ao abrir —')
  win.reload()
  await espera(2500)
  await entrar()
  const aviso = await js(\`(() => {
    const el = [...document.querySelectorAll('*')].find(e =>
      e.children.length === 0 && e.textContent.trim() === 'Versão 9.9.9 disponível')
    return el ? el.textContent.trim() : null
  })()\`)
  ok(!!aviso, 'faixa de aviso aparece sozinha', aviso)

  console.log('— baixando do servidor —')
  const clicou = await js(\`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Baixar e instalar')
    if (!b) return false
    b.click(); return true
  })()\`)
  ok(clicou, 'botao de atualizar disponivel na faixa')
  for (let i = 0; i < 90 && !abriu; i++) await espera(1000)
  ok(!!abriu, 'instalador baixado e aberto', abriu)
  ok(abriu && fs.existsSync(abriu), 'arquivo existe no disco', abriu)
  if (abriu && fs.existsSync(abriu)) {
    const tam = fs.statSync(abriu).size
    ok(tam === fs.statSync(INSTALADOR).size, 'tamanho identico ao original', tam)
    fs.unlinkSync(abriu)
  }

  // Limpa a versao de teste.
  const limpou = await js("window.estrudena.removerVersao('9.9.9').then(r => r.ok)")
  console.log('  limpeza da versao 9.9.9: ' + limpou)

  console.log('')
  console.log(falhas ? falhas + ' FALHA(S)' : 'canal de atualizacao OK')
  app.exit(falhas ? 1 : 0)
})
`, 'utf8')

spawn(electron, [driver], { stdio: 'inherit' }).on('close', c => process.exit(c ?? 0))
