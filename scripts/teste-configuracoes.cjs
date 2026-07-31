/** Textos da proposta enxutos + padrao marcado na propria lista de opcoes. */
const path = require('node:path'), fs = require('node:fs'), os = require('node:os')
const { app, BrowserWindow, shell } = require('electron')

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'estrudena-teste-')))
shell.openPath = async () => ''

// Rodado pela raiz do projeto: "npm run teste:config".
const raiz = process.cwd()
const destino = process.argv[process.argv.length - 1]
require(path.join(raiz, 'dist-electron', 'main.js'))
app.quit = () => {}

const espera = ms => new Promise(r => setTimeout(r, ms))
let win = null, falhas = 0
const ok = (c, d, e) => {
  if (c) console.log('  ok    ' + d)
  else { falhas++; console.log('  FALHA ' + d + (e === undefined ? '' : ' -> ' + JSON.stringify(e))) }
}
const js = c => win.webContents.executeJavaScript(c)

// Rotulos das linhas dentro de um cartao, pelo titulo do cartao.
const rotulos = titulo => js(
  "(() => { const c = [...document.querySelectorAll('.card')]" +
  ".find(x => x.textContent.startsWith(" + JSON.stringify(titulo) + "));" +
  " if (!c) return null;" +
  " return [...c.querySelectorAll('span')].map(s => s.textContent.trim())" +
  ".filter(t => t && t.length < 40) })()")

// Chips de uma lista: texto e se estao marcados como padrao.
const chips = titulo => js(
  "(() => { const c = [...document.querySelectorAll('.card')]" +
  ".find(x => x.textContent.startsWith(" + JSON.stringify(titulo) + "));" +
  " if (!c) return null;" +
  " return [...c.querySelectorAll('span')].filter(s => s.querySelector('button[aria-pressed]'))" +
  ".map(s => ({ texto: s.textContent.replace(/[●○✕]/g,'').trim()," +
  " padrao: s.querySelector('button[aria-pressed]').getAttribute('aria-pressed') === 'true' })) })()")

app.whenReady().then(async () => {
  await espera(1500)
  win = BrowserWindow.getAllWindows()[0]
  win.webContents.on('console-message', (_e, n, m) => { if (n >= 2) console.log('  CONSOLE ' + m) })

  for (let i = 0; i < 60; i++) {
    if (await js("!!document.querySelector('input[autocomplete=username]')")) break
    await espera(1000)
  }
  const setar = (sel, val) => js(
    "(() => { const el = document.querySelector(" + JSON.stringify(sel) + ");" +
    " Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')" +
    ".set.call(el, " + JSON.stringify(val) + ");" +
    " el.dispatchEvent(new Event('input', { bubbles: true })) })()")
  await setar('input[autocomplete=username]', 'wilson')
  await setar('input[autocomplete=current-password]', 'estrudena')
  await js("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Entrar').click()")
  await espera(2500)

  await js("[...document.querySelectorAll('aside button.navbtn')].find(b => /Configura/.test(b.textContent)).click()")
  await espera(1200)

  console.log('— textos da proposta —')
  const r = await rotulos('Textos da proposta')
  ok(r !== null, 'cartao existe')
  ok(r && r.includes('Validade (dias)'), 'mantem a validade', r)
  ok(r && !r.includes('Condição de pagamento'), 'nao tem mais condicao de pagamento', r)
  ok(r && !r.includes('Prazo de entrega'), 'nao tem mais prazo de entrega', r)

  const obs = await js(
    "(() => { const c = [...document.querySelectorAll('.card')]" +
    ".find(x => x.textContent.startsWith('Textos da proposta'));" +
    " const t = c && c.querySelector('textarea');" +
    " return t ? t.value.split('\\n').filter(Boolean).length : -1 })()")
  ok(obs === 6, 'observacoes do PDF agora sao editaveis (6 linhas)', obs)

  console.log('— padrao na lista —')
  for (const titulo of ['Condições de pagamento', 'Prazos de entrega']) {
    const c = await chips(titulo)
    ok(c && c.length > 1, titulo + ': tem opcoes com marcador', c && c.length)
    const marcados = (c || []).filter(x => x.padrao)
    ok(marcados.length === 1, titulo + ': exatamente uma marcada como padrao',
      marcados.map(m => m.texto))
    console.log('    padrao: ' + JSON.stringify(marcados.map(m => m.texto)))
  }

  // Marcar outra opcao move o padrao.
  const antes = (await chips('Prazos de entrega')).find(x => x.padrao).texto
  await js(
    "(() => { const c = [...document.querySelectorAll('.card')]" +
    ".find(x => x.textContent.startsWith('Prazos de entrega'));" +
    " const b = [...c.querySelectorAll('button[aria-pressed=false]')][0]; b.click() })()")
  await espera(400)
  const depois = (await chips('Prazos de entrega')).find(x => x.padrao).texto
  ok(depois !== antes, 'clicar em outra opcao move o padrao', { antes, depois })
  ok((await chips('Prazos de entrega')).filter(x => x.padrao).length === 1,
    'continua com so uma marcada')

  console.log('— parametros globais —')
  const tabela = await js(
    "(() => { const c = [...document.querySelectorAll('.card')]" +
    ".find(x => x.textContent.startsWith('Parâmetros globais'));" +
    " return [...c.querySelectorAll('tr')].map(tr => [...tr.children].map(td => td.textContent.trim())) })()")
  const linha = n => tabela.find(l => l[0] === n)
  ok(!!linha('Condição de pagamento'), 'mostra a condicao herdada')
  ok(linha('Prazo de entrega') && linha('Prazo de entrega')[1] === depois,
    'mostra o prazo herdado, ja com o novo valor', linha('Prazo de entrega'))

  if (destino && destino.endsWith('capturas')) {
    const c = await js(
      "(() => { const c = [...document.querySelectorAll('.card')]" +
      ".find(x => x.textContent.startsWith('Textos da proposta'));" +
      " const b = c.getBoundingClientRect();" +
      " return { x: Math.floor(b.x)-10, y: Math.floor(b.y)-10," +
      " width: Math.ceil(b.width)+20, height: Math.ceil(b.height)+20 } })()")
    fs.writeFileSync(path.join(destino, 'config-textos.png'), (await win.webContents.capturePage(c)).toPNG())
    await js(
      "[...document.querySelectorAll('.card')]" +
      ".find(x => x.textContent.startsWith('Condições de pagamento'))" +
      ".scrollIntoView({ block: 'center' })")
    await espera(700)
    const d = await js(
      "(() => { const c = [...document.querySelectorAll('.card')]" +
      ".find(x => x.textContent.startsWith('Condições de pagamento'));" +
      " const b = c.getBoundingClientRect();" +
      " return { x: Math.floor(b.x)-10, y: Math.floor(b.y)-10," +
      " width: Math.ceil(b.width)+20, height: Math.ceil(b.height)+20 } })()")
    fs.writeFileSync(path.join(destino, 'config-listas.png'), (await win.webContents.capturePage(d)).toPNG())
    console.log('  capturas gravadas')
  }

  console.log('')
  console.log(falhas ? falhas + ' FALHA(S)' : 'configuracoes OK')
  app.exit(falhas ? 1 : 0)
})
