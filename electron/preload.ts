import { contextBridge, ipcRenderer } from 'electron'

type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: string }

const invoke = <T>(canal: string, ...args: unknown[]): Promise<Resposta<T>> =>
  ipcRenderer.invoke(canal, ...args)

const api = {
  conectar: (host?: string) => invoke('conexao:conectar', host),
  estadoConexao: () => invoke('conexao:estado'),
  onProgresso: (cb: (etapa: string) => void) => {
    const fn = (_e: unknown, etapa: string) => cb(etapa)
    ipcRenderer.on('conexao:progresso', fn)
    return () => ipcRenderer.removeListener('conexao:progresso', fn)
  },
  onEstado: (cb: (estado: unknown) => void) => {
    const fn = (_e: unknown, estado: unknown) => cb(estado)
    ipcRenderer.on('conexao:estado', fn)
    return () => ipcRenderer.removeListener('conexao:estado', fn)
  },

  login: (usuario: string, senha: string) => invoke('auth:login', usuario, senha),

  carregar: () => invoke('db:carregar'),
  salvarConfig: (cfg: unknown) => invoke('db:config', cfg),
  salvarMaterial: (m: unknown) => invoke('db:material', m),
  salvarCor: (x: unknown) => invoke('db:cor', x),
  salvarAcessorio: (x: unknown) => invoke('db:acessorio', x),
  salvarKit: (x: unknown) => invoke('db:kit', x),
  salvarKitVenda: (x: unknown) => invoke('db:kitVenda', x),
  salvarInstalador: (x: unknown) => invoke('db:instalador', x),
  salvarCliente: (x: unknown) => invoke('db:cliente', x),
  salvarUsuario: (x: unknown) => invoke('db:usuario', x),
  salvarOrcamento: (x: unknown) => invoke('db:orcamento', x),
  salvarSeparacao: (id: string, s: unknown) => invoke('db:separacao', id, s),
  excluir: (tabela: string, id: string) => invoke('db:excluir', tabela, id),
  listaAdd: (cat: string, valor: string) => invoke('db:listaAdd', cat, valor),
  listaDel: (cat: string, valor: string) => invoke('db:listaDel', cat, valor),
  restaurarExemplo: () => invoke('db:exemplo'),

  consultarCnpj: (cnpj: string) => invoke('cnpj:consultar', cnpj),

  estadoAtualizacao: () => invoke('atualizacao:estado'),
  historicoVersoes: () => invoke('atualizacao:historico'),
  publicarVersao: (versao: string, notas: string, porQuem: string) =>
    invoke('atualizacao:publicar', versao, notas, porQuem),
  removerVersao: (versao: string) => invoke('atualizacao:remover', versao),
  testarRepo: (repo: string) => invoke('atualizacao:testarRepo', repo),
  definirRepo: (repo: string) => invoke('atualizacao:definirRepo', repo),
  baixarVersao: (versao: string, url?: string, arquivo?: string) =>
    invoke('atualizacao:baixar', versao, url, arquivo),
  abrirInstalador: (caminho: string) => invoke('atualizacao:abrir', caminho),
  mostrarNaPasta: (caminho: string) => invoke('atualizacao:mostrarPasta', caminho),

  imprimir: () => invoke('app:imprimir'),
  salvarPdf: (nome: string) => invoke('app:salvarPdf', nome),
  exportarJson: (conteudo: string, nome: string) => invoke('app:exportarJson', conteudo, nome),
  versao: () => invoke('app:versao')
}

contextBridge.exposeInMainWorld('estrudena', api)

export type EstrudenaApi = typeof api
