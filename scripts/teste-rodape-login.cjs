/** A linha de verificar atualizacao cabe no cartao, sem cortar nem quebrar. */
const path = require('node:path'), fs = require('node:fs'), os = require('node:os')
const { app, BrowserWindow, shell } = require('electron')

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'estrudena-teste-')))
shell.openPath = async () => ''

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

// Mede o botao e o texto: quantas linhas cada um ocupa e se o texto esta
// cortado (scrollWidth maior que a largura visivel).
const medir = () => js(
  "(() => { const b = [...document.querySelectorAll('button')]" +
  ".find(x => /verificar atualiza|conferir de novo|verificando/i.test(x.textContent));" +
  " if (!b) return null;" +
  " const linha = b.parentElement;" +
  " const s = linha.querySelector('span');" +
  " const alt = el => Math.round(el.getBoundingClientRect().height);" +
  " const cs = getComputedStyle(b);" +
  " return { rotulo: b.textContent.trim(), altBotao: alt(b)," +
  " linhasBotao: Math.round(alt(b) / parseFloat(cs.lineHeight || 16))," +
  " texto: s ? s.textContent.trim() : ''," +
  " cortado: s ? s.scrollWidth > s.clientWidth + 1 : false," +
  " sobra: Math.round(linha.getBoundingClientRect().width" +
  " - (s ? s.scrollWidth : 0) - b.getBoundingClientRect().width - 76) } })()")

app.whenReady().then(async () => {
  await espera(1500)
  win = BrowserWindow.getAllWindows()[0]
  win.webContents.on('console-message', (_e, n, m) => { if (n >= 2) console.log('  CONSOLE ' + m) })

  for (let i = 0; i < 60; i++) {
    if (await js("!!document.querySelector('input[autocomplete=username]')")) break
    await espera(1000)
  }

  console.log('— antes de conferir —')
  let m = await medir()
  ok(m !== null, 'a linha existe', m)
  ok(m.rotulo === 'verificar atualização', 'rotulo inicial', m.rotulo)
  ok(m.altBotao <= 20, 'botao cabe numa linha so', m.altBotao)

  console.log('— depois de conferir —')
  await js("[...document.querySelectorAll('button')].find(x => /verificar atualiza/i.test(x.textContent)).click()")
  for (let i = 0; i < 100; i++) {
    m = await medir()
    if (m && m.texto) break
    await espera(200)
  }
  console.log('  texto:  ' + JSON.stringify(m.texto))
  console.log('  rotulo: ' + JSON.stringify(m.rotulo) + '   sobra: ' + m.sobra + 'px')
  ok(!!m.texto, 'mostrou o resultado', m)
  ok(!m.cortado, 'texto NAO esta cortado', m)
  ok(m.altBotao <= 20, 'botao continua numa linha so', m.altBotao)
  ok(m.sobra >= 0, 'texto e botao cabem lado a lado', m.sobra)

  if (destino) {
    const r = await js(
      "(() => { const c = document.querySelector('img[alt=Estrudena]')" +
      ".closest('div[style*=\"border-radius\"]');" +
      " const b = c.getBoundingClientRect();" +
      " return { x: Math.floor(b.x)-10, y: Math.floor(b.y)-10," +
      " width: Math.ceil(b.width)+20, height: Math.ceil(b.height)+20 } })()")
    fs.writeFileSync(path.join(destino, 'login-rodape.png'), (await win.webContents.capturePage(r)).toPNG())
  }

  console.log('')
  console.log(falhas ? falhas + ' FALHA(S)' : 'rodape do login OK')
  app.exit(falhas ? 1 : 0)
})
