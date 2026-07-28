import path from 'node:path'
import fs from 'node:fs'
import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'
import { consultarCnpj } from './cnpj'
import * as github from './github'
import { conectar, encerrar, estadoConexao, temPool } from './db/pool'
import * as repo from './db/repo'
import * as versoes from './db/versoes'

/**
 * Versão do sistema, fixada pelo build a partir do package.json.
 * `app.getVersion()` não serve: fora do pacote ele devolve a versão do
 * Electron, e a comparação de atualização passaria a mentir.
 */
declare const __VERSAO_APP__: string
const VERSAO = __VERSAO_APP__

const DEV_URL = process.env.ESTRUDENA_DEV_URL
let janela: BrowserWindow | null = null

/**
 * Atualização já baixada e esperando para ser instalada.
 *
 * Fica aqui no processo principal porque quem decide o momento é o fechamento
 * da janela: instalar troca arquivos em uso e derruba o sistema, então o
 * momento certo é quando a pessoa já está saindo.
 */
let atualizacaoPendente: { versao: string; caminho: string } | null = null
/** Evita reentrar no diálogo de saída enquanto ele já está aberto. */
let confirmandoSaida = false

function criarJanela(): void {
  janela = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 700,
    show: false,
    // Branco de propósito: com printBackground, esta cor base da janela vira o
    // fundo da página no PDF. Em #f1f3f4 o documento saía com moldura cinza.
    // Na tela não muda nada — o body pinta o cinza do sistema por cima.
    backgroundColor: '#ffffff',
    title: 'Sistema Estrudena',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  })

  janela.once('ready-to-show', () => {
    janela?.maximize()
    janela?.show()
  })

  janela.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (DEV_URL) {
    janela.loadURL(DEV_URL)
    janela.webContents.openDevTools({ mode: 'detach' })
  } else {
    janela.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  /**
   * Se houver atualização baixada, o fechamento é a hora certa de instalar:
   * ninguém perde trabalho, porque a pessoa já estava saindo.
   */
  janela.on('close', evento => {
    if (!atualizacaoPendente || confirmandoSaida) return
    evento.preventDefault()
    confirmandoSaida = true

    const pendente = atualizacaoPendente
    void dialog.showMessageBox(janela!, {
      type: 'question',
      buttons: ['Instalar agora', 'Sair sem instalar'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualização pronta',
      message: `A versão ${pendente.versao} já está baixada nesta máquina.`,
      detail: 'Instalar agora? O Windows vai pedir a confirmação de administrador. '
        + 'Leva menos de um minuto e os dados são preservados.'
    }).then(async escolha => {
      if (escolha.response === 0) {
        const erro = await shell.openPath(pendente.caminho)
        // Falhou ao abrir: melhor sair do que prender a pessoa no sistema.
        if (erro) console.error('não consegui abrir o instalador:', erro)
      }
      atualizacaoPendente = null
      janela?.destroy()
    })
  })

  janela.on('closed', () => { janela = null })
}

function avisarConexao(): void {
  janela?.webContents.send('conexao:estado', estadoConexao())
}

/** Envolve um handler para que erros virem `{ erro }` em vez de rejeição crua. */
function handler<A extends unknown[], R>(
  canal: string,
  fn: (...args: A) => Promise<R>
): void {
  ipcMain.handle(canal, async (_e, ...args) => {
    try {
      return { ok: true, dados: await fn(...(args as A)) }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, erro: msg }
    }
  })
}

/** De quanto em quanto tempo a rede toda pode consultar o GitHub. */
const MINUTOS_ENTRE_CONSULTAS = 60

/**
 * Consulta a última release, mas no máximo uma vez por hora para a rede inteira.
 *
 * O GitHub permite 60 consultas por hora por IP e todas as máquinas da empresa
 * saem pelo mesmo IP — sem esse controle, alguns terminais consultando de tempos
 * em tempos esgotariam a cota e a atualização deixaria de chegar. O resultado
 * fica no banco, que todas já enxergam.
 */
async function consultarGithubComCache(repo: string) {
  try {
    const souEu = await versoes.reservarChecagemGithub(MINUTOS_ENTRE_CONSULTAS)
    if (souEu) {
      const fresco = await github.ultimaRelease(repo)
      // Consulta falhou (sem internet, cota estourada): preserva o que já
      // estava guardado em vez de apagar e ficar sem saber de nada.
      if (fresco) await versoes.gravarCacheGithub(fresco)
    }
    return await versoes.lerCacheGithub()
  } catch (e) {
    console.log('[atualizacao] cache indisponivel:', e instanceof Error ? e.message : e)
    return null
  }
}

function registrarIpc(): void {
  handler('conexao:conectar', async (host?: string) => {
    const st = await conectar(host, etapa => {
      janela?.webContents.send('conexao:progresso', etapa)
    })
    avisarConexao()
    return st
  })
  handler('conexao:estado', async () => estadoConexao())

  handler('auth:login', (usuario: string, senha: string) => repo.autenticar(usuario, senha))

  handler('db:carregar', () => repo.carregarDB())
  handler('db:config', (cfg: Parameters<typeof repo.salvarConfig>[0]) => repo.salvarConfig(cfg))
  handler('db:material', (m: Parameters<typeof repo.salvarMaterial>[0]) => repo.salvarMaterial(m))
  handler('db:cor', (x: Parameters<typeof repo.salvarCor>[0]) => repo.salvarCor(x))
  handler('db:acessorio', (x: Parameters<typeof repo.salvarAcessorio>[0]) => repo.salvarAcessorio(x))
  handler('db:kit', (x: Parameters<typeof repo.salvarKit>[0]) => repo.salvarKit(x))
  handler('db:kitVenda', (x: Parameters<typeof repo.salvarKitVenda>[0]) => repo.salvarKitVenda(x))
  handler('db:instalador', (x: Parameters<typeof repo.salvarInstalador>[0]) => repo.salvarInstalador(x))
  handler('db:cliente', (x: Parameters<typeof repo.salvarCliente>[0]) => repo.salvarCliente(x))
  handler('db:usuario', (x: Parameters<typeof repo.salvarUsuario>[0]) => repo.salvarUsuario(x))
  handler('db:orcamento', (x: Parameters<typeof repo.salvarOrcamento>[0]) => repo.salvarOrcamento(x))
  handler('db:separacao', (id: string, s: Parameters<typeof repo.salvarSeparacao>[1]) =>
    repo.salvarSeparacao(id, s))
  handler('db:excluir', (tabela: string, id: string) => repo.excluir(tabela, id))
  handler('db:listaAdd', (cat: string, valor: string) => repo.adicionarLista(cat, valor))
  handler('db:listaDel', (cat: string, valor: string) => repo.removerLista(cat, valor))
  handler('db:exemplo', () => repo.restaurarExemplo())

  handler('app:imprimir', async () => {
    janela?.webContents.print({ silent: false, printBackground: true })
  })

  handler('app:salvarPdf', async (nome: string) => {
    if (!janela) throw new Error('Janela indisponível.')
    const destino = await dialog.showSaveDialog(janela, {
      title: 'Salvar em PDF',
      defaultPath: path.join(app.getPath('documents'), nome),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (destino.canceled || !destino.filePath) return null
    // 9 mm ≈ 0,354 pol — a mesma margem do @page usada nas folhas A4.
    const pdf = await janela.webContents.printToPDF({
      pageSize: 'A4', printBackground: true,
      margins: { top: 0.354, bottom: 0.354, left: 0.354, right: 0.354 }
    })
    fs.writeFileSync(destino.filePath, pdf)
    shell.showItemInFolder(destino.filePath)
    return destino.filePath
  })

  handler('app:exportarJson', async (conteudo: string, nome: string) => {
    if (!janela) throw new Error('Janela indisponível.')
    const destino = await dialog.showSaveDialog(janela, {
      title: 'Exportar banco de dados',
      defaultPath: path.join(app.getPath('documents'), nome),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (destino.canceled || !destino.filePath) return null
    fs.writeFileSync(destino.filePath, conteudo, 'utf8')
    return destino.filePath
  })

  handler('app:versao', async () => VERSAO)

  handler('cnpj:consultar', (cnpj: string) => consultarCnpj(cnpj))

  // ------------------------------------------------------------ atualização
  /**
   * Consulta as duas origens e fica com a versão mais nova. O GitHub costuma
   * chegar primeiro (quem desenvolve publica direto); o servidor cobre os
   * terminais sem internet.
   */
  handler('atualizacao:estado', async () => {
    const repo = await versoes.repoConfigurado().catch(() => '')
    const [doServidor, doGithub] = await Promise.all([
      versoes.versaoPublicada().catch(() => null),
      repo ? consultarGithubComCache(repo) : Promise.resolve(null)
    ])

    const candidatos = [doServidor, doGithub].filter(v => v !== null)
    const disponivel = candidatos.length
      ? candidatos.reduce((a, b) => (versoes.compararVersoes(b.versao, a.versao) > 0 ? b : a))
      : null

    return {
      versaoLocal: VERSAO,
      repo,
      disponivel,
      temNova: !!disponivel && versoes.compararVersoes(disponivel.versao, VERSAO) > 0
    }
  })

  /** Conferência a pedido do administrador: também renova o cache da rede. */
  handler('atualizacao:testarRepo', async (repo: string) => {
    const diagnostico = await github.diagnosticarRepo(repo)
    if (diagnostico.startsWith('Tudo certo')) {
      const fresco = await github.ultimaRelease(repo)
      if (fresco) await versoes.gravarCacheGithub(fresco)
    }
    return diagnostico
  })

  handler('atualizacao:definirRepo', async (repo: string) => {
    const limpo = repo.trim() ? github.normalizarRepo(repo) : ''
    if (repo.trim() && !limpo) {
      throw new Error('Informe no formato usuario/repositorio ou a URL do GitHub.')
    }
    await versoes.definirRepo(limpo)
    return limpo
  })

  handler('atualizacao:historico', () => versoes.listarVersoes())

  /** Abre o seletor de arquivo e publica o instalador escolhido. */
  handler('atualizacao:publicar', async (versao: string, notas: string, porQuem: string) => {
    if (!janela) throw new Error('Janela indisponível.')
    const escolha = await dialog.showOpenDialog(janela, {
      title: 'Escolha o instalador do Sistema Estrudena',
      defaultPath: app.getPath('downloads'),
      filters: [{ name: 'Instalador', extensions: ['exe'] }],
      properties: ['openFile']
    })
    if (escolha.canceled || !escolha.filePaths[0]) return null
    return versoes.publicarVersao(escolha.filePaths[0], versao, notas, porQuem)
  })

  handler('atualizacao:remover', (versao: string) => versoes.removerVersao(versao))

  /**
   * Baixa o instalador do servidor e abre para o usuário instalar.
   * Nunca executa sozinho: o Windows ainda pede confirmação de administrador.
   */
  /** Baixa da origem indicada: `url` presente significa release do GitHub. */
  handler('atualizacao:baixar', async (versao: string, url?: string, arquivo?: string) => {
    const pasta = path.join(app.getPath('downloads'), 'Sistema Estrudena')
    const caminho = url
      ? await github.baixarRelease(
          url, arquivo ?? `Sistema-Estrudena-Setup-${versao}.exe`, pasta,
          (recebido, total) => janela?.webContents.send('atualizacao:progresso', { recebido, total })
        )
      : await versoes.baixarVersao(versao, pasta)
    atualizacaoPendente = { versao, caminho }
    return caminho
  })

  handler('atualizacao:pendente', async () => atualizacaoPendente)

  handler('atualizacao:abrir', async (caminho: string) => {
    const erro = await shell.openPath(caminho)
    if (erro) throw new Error(erro)
    // Instalou a pedido: limpa a pendência antes de sair, senão o fechamento
    // dispararia o diálogo perguntando de novo se quer instalar.
    atualizacaoPendente = null
    // Fecha o sistema: o instalador precisa substituir os arquivos em uso.
    setTimeout(() => app.quit(), 1200)
  })

  handler('atualizacao:mostrarPasta', async (caminho: string) => {
    shell.showItemInFolder(caminho)
  })
}

// Uma instância só — evita duas janelas competindo pela mesma conexão.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (janela) {
      if (janela.isMinimized()) janela.restore()
      janela.focus()
    }
  })

  app.whenReady().then(() => {
    registrarIpc()
    criarJanela()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) criarJanela()
    })
  })

  app.on('window-all-closed', async () => {
    if (temPool()) await encerrar()
    app.quit()
  })
}
