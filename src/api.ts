import type {
  Acessorio, Cliente, Config, ConnState, Cor, DadosCnpj, DB, EstadoAtualizacao,
  Instalador, Kit, KitVenda, LoginResult, Material, Orcamento, Separacao, Usuario,
  VersaoPublicada
} from './shared/types'

type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: string }

interface Ponte {
  conectar(host?: string): Promise<Resposta<ConnState>>
  estadoConexao(): Promise<Resposta<ConnState>>
  onProgresso(cb: (etapa: string) => void): () => void
  onEstado(cb: (estado: ConnState) => void): () => void
  login(usuario: string, senha: string): Promise<Resposta<LoginResult>>
  carregar(): Promise<Resposta<DB>>
  salvarConfig(cfg: Config): Promise<Resposta<void>>
  salvarMaterial(m: Material): Promise<Resposta<void>>
  salvarCor(x: Cor): Promise<Resposta<void>>
  salvarAcessorio(x: Acessorio): Promise<Resposta<void>>
  salvarKit(x: Kit): Promise<Resposta<void>>
  salvarKitVenda(x: KitVenda): Promise<Resposta<void>>
  salvarInstalador(x: Instalador): Promise<Resposta<void>>
  salvarCliente(x: Cliente): Promise<Resposta<void>>
  salvarUsuario(x: Usuario & { senha?: string }): Promise<Resposta<void>>
  salvarOrcamento(x: Orcamento): Promise<Resposta<Orcamento>>
  salvarSeparacao(id: string, s: Separacao): Promise<Resposta<void>>
  excluir(tabela: string, id: string): Promise<Resposta<void>>
  listaAdd(cat: string, valor: string): Promise<Resposta<void>>
  listaDel(cat: string, valor: string): Promise<Resposta<void>>
  restaurarExemplo(): Promise<Resposta<void>>
  consultarCnpj(cnpj: string): Promise<Resposta<DadosCnpj>>
  /** `forcar` ignora o intervalo de uma consulta por hora da rede. */
  estadoAtualizacao(forcar?: boolean): Promise<Resposta<EstadoAtualizacao>>
  historicoVersoes(): Promise<Resposta<VersaoPublicada[]>>
  publicarVersao(versao: string, notas: string, porQuem: string):
    Promise<Resposta<{ versao: string; arquivo: string; tamanho: number } | null>>
  removerVersao(versao: string): Promise<Resposta<void>>
  atualizacaoPendente(): Promise<Resposta<{ versao: string; caminho: string } | null>>
  onProgressoDownload(cb: (p: { recebido: number; total: number }) => void): () => void
  testarRepo(repo: string): Promise<Resposta<string>>
  definirRepo(repo: string): Promise<Resposta<string>>
  baixarVersao(versao: string, url?: string, arquivo?: string): Promise<Resposta<string>>
  abrirInstalador(caminho: string): Promise<Resposta<void>>
  mostrarNaPasta(caminho: string): Promise<Resposta<void>>
  imprimir(): Promise<Resposta<void>>
  salvarPdf(nome: string): Promise<Resposta<string | null>>
  exportarJson(conteudo: string, nome: string): Promise<Resposta<string | null>>
  versao(): Promise<Resposta<string>>
}

declare global {
  interface Window { estrudena: Ponte }
}

export const ponte = (): Ponte => window.estrudena

/** Desembrulha a resposta do IPC, lançando o erro para quem chamou tratar. */
export async function chamar<T>(p: Promise<Resposta<T>>): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(r.erro)
  return r.dados
}
