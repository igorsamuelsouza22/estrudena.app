import { createWriteStream } from 'node:fs'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { VersaoPublicada } from '../src/shared/types'

/**
 * Atualização a partir de releases do GitHub.
 *
 * Alternativa ao canal pelo banco: quem desenvolve publica a release e os
 * terminais com internet percebem sozinhos, sem ninguém precisar publicar na
 * Estrudena. Funciona apenas com repositório público — repositório privado
 * exigiria um token embutido no aplicativo, que qualquer pessoa com acesso ao
 * arquivo instalado conseguiria extrair.
 */

const TEMPO_LIMITE = 15_000
const UA = 'SistemaEstrudena/1.0 (+aluminio@estrudena.com.br)'

/** Aceita "usuario/repo" ou a URL completa do repositório. */
export function normalizarRepo(bruto: string): string {
  const limpo = bruto.trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')
  return /^[\w.-]+\/[\w.-]+$/.test(limpo) ? limpo : ''
}

interface AssetGithub { name: string; browser_download_url: string; size: number }
interface ReleaseGithub {
  tag_name?: string
  name?: string
  body?: string
  draft?: boolean
  prerelease?: boolean
  published_at?: string
  assets?: AssetGithub[]
  message?: string
}

async function buscar(url: string, aceita: string): Promise<Response> {
  const controle = new AbortController()
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE)
  try {
    return await fetch(url, {
      signal: controle.signal,
      redirect: 'follow',
      headers: { accept: aceita, 'user-agent': UA }
    })
  } finally {
    clearTimeout(relogio)
  }
}

export interface VersaoGithub extends VersaoPublicada {
  origem: 'github'
  url: string
}

/**
 * Última release do repositório. Devolve null quando não há release publicada
 * ou quando não dá para falar com o GitHub — o aviso de atualização é um
 * conforto, nunca deve derrubar a abertura do sistema.
 */
export async function ultimaRelease(repo: string): Promise<VersaoGithub | null> {
  const alvo = normalizarRepo(repo)
  if (!alvo) return null

  let r: Response
  try {
    r = await buscar(`https://api.github.com/repos/${alvo}/releases/latest`,
      'application/vnd.github+json')
  } catch {
    return null // sem internet, ou GitHub fora do ar
  }
  if (!r.ok) return null

  const rel = await r.json() as ReleaseGithub
  if (rel.draft) return null

  // A tag costuma vir como "v1.2.3"; guardamos só os números.
  const versao = String(rel.tag_name ?? '').trim().replace(/^v/i, '')
  if (!/^\d+\.\d+\.\d+$/.test(versao)) return null

  // Pode haver mais de um .exe na release (arm64, por exemplo). O sistema é
  // x64, então descarta os de outra arquitetura antes de escolher.
  const exes = (rel.assets ?? []).filter(a => a.name.toLowerCase().endsWith('.exe'))
  const exe = exes.find(a => !/arm|ia32|x86(?!_64)/i.test(a.name)) ?? exes[0]
  if (!exe) return null

  return {
    origem: 'github',
    versao,
    publicadoEm: rel.published_at ?? '',
    publicadoPor: 'GitHub',
    notas: (rel.body ?? rel.name ?? '')
      .split(/\r?\n/)[0].replace(/[#*_`]/g, '').trim().slice(0, 200),
    arquivo: exe.name,
    tamanho: exe.size,
    sha256: '',
    url: exe.browser_download_url
  }
}

/**
 * Diz em português por que o repositório serve ou não serve para atualização.
 * Sem isso, um repositório privado ou sem release apenas não avisaria nada, e
 * ninguém descobriria que as atualizações pararam de chegar.
 */
export async function diagnosticarRepo(repo: string): Promise<string> {
  const alvo = normalizarRepo(repo)
  if (!alvo) return 'Informe no formato usuario/repositorio.'

  let r: Response
  try {
    r = await buscar(`https://api.github.com/repos/${alvo}`, 'application/vnd.github+json')
  } catch {
    return 'Sem acesso à internet agora — não deu para conferir o repositório.'
  }

  if (r.status === 404) {
    return `Não encontrei github.com/${alvo}. Ou o repositório ainda não existe, ` +
           'ou é privado — o GitHub responde a mesma coisa nos dois casos. ' +
           'Para servir de canal de atualização, ele precisa ser público.'
  }
  if (r.status === 403) return 'O GitHub recusou a consulta (limite de acesso). Tente daqui a pouco.'
  if (!r.ok) return `O GitHub respondeu ${r.status}.`

  const release = await ultimaRelease(alvo)
  if (!release) {
    return `Repositório encontrado, mas sem release utilizável. ` +
           'Publique uma release com etiqueta v1.2.3 e o instalador .exe anexado.'
  }
  return `Tudo certo: última release ${release.versao} (${release.arquivo}).`
}

/** Baixa o instalador da release para a pasta indicada. */
export async function baixarRelease(
  url: string, nomeArquivo: string, pasta: string
): Promise<string> {
  const r = await buscar(url, 'application/octet-stream')
  if (!r.ok || !r.body) throw new Error(`Download falhou (${r.status}).`)

  fs.mkdirSync(pasta, { recursive: true })
  const destino = path.join(pasta, nomeArquivo)
  const parcial = destino + '.parcial'

  // Grava num arquivo temporário: uma queda no meio não deixa para trás um
  // instalador truncado com cara de arquivo bom.
  await pipeline(Readable.fromWeb(r.body as never), createWriteStream(parcial))
  fs.renameSync(parcial, destino)
  return destino
}
