/**
 * Percorre o fluxo novo: Orçamento → Gerar Proposta → modal → PDFs → Propostas.
 * A janela de salvar arquivo é interceptada e o orçamento de teste é apagado
 * no fim, para não sujar a base.
 *
 *   node scripts/teste-fluxo-proposta.mjs <pasta-de-saida>
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electron from 'electron'

const SAIDA = resolve(process.argv[2] ?? 'pdfs-fluxo')
mkdirSync(SAIDA, { recursive: true })

const tmp = mkdtempSync(join(tmpdir(), 'estrudena-fluxo-'))
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
const nomes = []
dialog.showSaveDialog = async (_w, o) => {
  const destino = path.join(SAIDA, path.basename(o.defaultPath || 'doc.pdf'))
  nomes.push(destino)
  return { canceled: false, filePath: destino }
}

require(${JSON.stringify(join(resolve('.'), 'dist-electron', 'main.js'))})

const espera = ms => new Promise(r => setTimeout(r, ms))
let win = null, falhas = 0

function ok(cond, desc, extra) {
  if (cond) console.log('  ok    ' + desc)
  else { falhas++; console.log('  FALHA ' + desc + (extra === undefined ? '' : ' -> ' + JSON.stringify(extra))) }
}

const js = codigo => win.webContents.executeJavaScript(codigo)

async function esperarArquivos(alvo, segundos = 40) {
  for (let i = 0; i < segundos; i++) {
    if (nomes.length >= alvo) { await espera(500); return true }
    await espera(1000)
  }
  return false
}

app.whenReady().then(async () => {
  await espera(1500)
  win = BrowserWindow.getAllWindows()[0]
  win.webContents.on('console-message', (_e, n, m) => { if (n >= 2) console.log('  CONSOLE ' + m) })

  for (let i = 0; i < 60; i++) {
    if (await js("!!document.querySelector('input[autocomplete=username]')")) break
    await espera(1000)
  }

  const setar = (sel, val, tipo) => js(\`(() => {
    const el = document.querySelector(\${JSON.stringify(sel)})
    if (!el) return false
    const proto = tipo === 'select' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, \${JSON.stringify(val)})
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()\`.replace('tipo ===', JSON.stringify(tipo) + ' ==='))

  await setar('input[autocomplete=username]', 'wilson')
  await setar('input[autocomplete=current-password]', 'estrudena')
  await js("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Entrar').click()")
  await espera(2500)

  console.log('— montando um orcamento —')
  await js("[...document.querySelectorAll('aside button.navbtn')].find(x => x.textContent.trim().startsWith('Orçamento')).click()")
  await espera(1200)

  // Cliente: escolhe a primeira opcao real do select.
  const escolheu = await js(\`(() => {
    const sel = [...document.querySelectorAll('select')].find(s =>
      [...s.options].some(o => o.value && o.value !== '__new'))
    if (!sel) return 'sem select'
    const opt = [...sel.options].find(o => o.value && o.value !== '__new')
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, opt.value)
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    return opt.textContent
  })()\`)
  console.log('  cliente escolhido: ' + escolheu)

  // Insere um item pelo modal do catalogo.
  await js("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '+ Inserir item').click()")
  await espera(900)
  await js(\`(() => {
    const linha = document.querySelector('.dialog tbody tr')
    if (linha) linha.click()
  })()\`)
  await espera(600)
  await js("[...document.querySelectorAll('.dialog button')].find(b => b.textContent.trim() === 'Concluir').click()")
  await espera(600)
  const nLinhas = await js("document.querySelectorAll('.appscroll table tbody tr').length")
  ok(nLinhas > 0, 'item inserido na grade', nLinhas)

  console.log('— gerar proposta —')
  await js("[...document.querySelectorAll('header button')].find(b => b.textContent.trim() === 'Gerar Proposta').click()")
  await espera(3000)

  const modal = await js(\`(() => {
    const d = document.querySelector('.dialog-backdrop')
    if (!d) return null
    return {
      titulo: d.querySelector('.dialog > div')?.textContent?.slice(0, 40),
      caixas: d.querySelectorAll('input[type=checkbox]').length,
      botoes: [...d.querySelectorAll('button')].map(b => b.textContent.trim())
    }
  })()\`)
  ok(!!modal, 'modal apareceu depois de Gerar Proposta', modal)
  ok(modal && modal.caixas === 2, 'modal tem as duas opcoes', modal && modal.caixas)

  // Marca as duas e confirma.
  await js(\`(() => {
    const cx = [...document.querySelectorAll('.dialog-backdrop input[type=checkbox]')]
    cx.forEach(c => { if (!c.checked) c.click() })
    return cx.map(c => c.checked)
  })()\`)
  await js("[...document.querySelectorAll('.dialog-backdrop button')].find(b => b.textContent.trim() === 'Gerar PDF').click()")

  const gerou = await esperarArquivos(2)
  ok(gerou, 'dois PDFs gerados', nomes.map(n => path.basename(n)))

  await espera(1200)
  const tela = await js("document.querySelector('header')?.innerText?.split(String.fromCharCode(10))[1] || ''")
  ok(String(tela).startsWith('Propostas'), 'foi para a tela de Propostas', tela)

  const semMenuAntigo = await js(
    "![...document.querySelectorAll('aside button.navbtn')].some(x => x.textContent.includes('Proposta / PDF'))")
  ok(semMenuAntigo, 'menu Proposta / PDF nao existe mais')

  // Limpa o orcamento de teste.
  const limpou = await js(\`
    window.estrudena.carregar().then(r => {
      const o = r.dados.orcamentos.find(x => x.obra === '' && x.itens.length === 1)
      if (!o) return 'nao achei o orcamento de teste'
      return window.estrudena.excluir('orcamentos', o.id).then(x => x.ok ? 'removido ' + o.numero : x.erro)
    })\`)
  console.log('  limpeza: ' + limpou)

  console.log('')
  console.log(falhas ? falhas + ' FALHA(S)' : 'fluxo completo OK')
  app.exit(falhas ? 1 : 0)
})
`, 'utf8')

spawn(electron, [driver], { stdio: 'inherit' }).on('close', c => process.exit(c ?? 0))
