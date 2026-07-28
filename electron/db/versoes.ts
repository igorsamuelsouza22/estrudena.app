import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { comCliente } from './pool'
import type { VersaoPublicada } from '../../src/shared/types'

/**
 * Canal de atualização do sistema.
 *
 * O instalador de cada versão é guardado no próprio banco. É o único ponto que
 * todas as máquinas já alcançam — dispensa hospedagem, pasta compartilhada e
 * internet no cliente. Os bytes nunca passam pela interface: o processo
 * principal lê do disco ao publicar e escreve em disco ao baixar.
 */

/** Compara versões no formato 1.2.3. Devolve >0 se `a` for mais nova. */
export function compararVersoes(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/** Repositório do GitHub configurado para atualização, se houver. */
export async function repoConfigurado(): Promise<string> {
  return comCliente(async c => {
    const { rows } = await c.query('SELECT github_repo FROM config WHERE id')
    return String(rows[0]?.github_repo ?? '')
  })
}

export async function definirRepo(repo: string): Promise<void> {
  await comCliente(c => c.query('UPDATE config SET github_repo = $1 WHERE id', [repo]))
}

/**
 * Tenta assumir a tarefa de consultar o GitHub.
 *
 * Só uma máquina por vez ganha: o UPDATE condicional é atômico, então os outros
 * terminais seguem usando o cache em vez de gastarem cota à toa. Devolve true
 * para quem ficou responsável pela consulta desta rodada.
 */
export async function reservarChecagemGithub(idadeMinutos: number): Promise<boolean> {
  return comCliente(async c => {
    const { rows } = await c.query(
      `UPDATE atualizacao_cache SET verificado_em = now()
       WHERE id AND verificado_em < now() - ($1 || ' minutes')::interval
       RETURNING true AS coube`,
      [String(idadeMinutos)]
    )
    return rows.length > 0
  })
}

/** Última resposta guardada do GitHub, ou null se nunca houve uma. */
export async function lerCacheGithub(): Promise<VersaoPublicada | null> {
  return comCliente(async c => {
    const { rows } = await c.query('SELECT * FROM atualizacao_cache WHERE id')
    const r = rows[0]
    if (!r || !r.versao) return null
    return {
      versao: r.versao,
      publicadoEm: r.publicado_em,
      publicadoPor: 'GitHub',
      notas: r.notas,
      arquivo: r.arquivo,
      tamanho: Number(r.tamanho),
      sha256: '',
      origem: 'github' as const,
      url: r.url
    }
  })
}

export async function gravarCacheGithub(v: VersaoPublicada | null): Promise<void> {
  await comCliente(c => c.query(
    `UPDATE atualizacao_cache
     SET versao = $1, arquivo = $2, url = $3, tamanho = $4, notas = $5, publicado_em = $6
     WHERE id`,
    v
      ? [v.versao, v.arquivo, v.url ?? '', v.tamanho, v.notas, v.publicadoEm]
      : ['', '', '', 0, '', '']
  ))
}

/** Versão publicada mais recente, sem trazer o instalador junto. */
export async function versaoPublicada(): Promise<VersaoPublicada | null> {
  return comCliente(async c => {
    const { rows } = await c.query(
      `SELECT versao, publicado_em, publicado_por, notas, arquivo, tamanho, sha256
       FROM versoes ORDER BY publicado_em DESC`
    )
    if (!rows.length) return null
    // Ordena por número de versão, não por data: uma republicação antiga não
    // pode passar na frente de uma versão mais nova.
    const maior = rows.reduce((a, r) => (compararVersoes(r.versao, a.versao) > 0 ? r : a))
    return {
      versao: maior.versao,
      publicadoEm: maior.publicado_em instanceof Date
        ? maior.publicado_em.toISOString()
        : String(maior.publicado_em),
      publicadoPor: maior.publicado_por,
      notas: maior.notas,
      arquivo: maior.arquivo,
      tamanho: Number(maior.tamanho),
      sha256: maior.sha256
    }
  })
}

export interface ResultadoPublicacao {
  versao: string
  arquivo: string
  tamanho: number
}

/** Lê o instalador do disco e o registra como a versão informada. */
export async function publicarVersao(
  caminho: string, versao: string, notas: string, publicadoPor: string
): Promise<ResultadoPublicacao> {
  if (!fs.existsSync(caminho)) throw new Error(`Arquivo não encontrado: ${caminho}`)
  if (path.extname(caminho).toLowerCase() !== '.exe') {
    throw new Error('Escolha o instalador do sistema (arquivo .exe).')
  }
  if (!/^\d+\.\d+\.\d+$/.test(versao.trim())) {
    throw new Error('Informe a versão no formato 1.2.3.')
  }

  const conteudo = fs.readFileSync(caminho)
  const limite = 500 * 1024 * 1024
  if (conteudo.length > limite) throw new Error('Instalador acima de 500 MB.')

  const sha256 = createHash('sha256').update(conteudo).digest('hex')
  const arquivo = path.basename(caminho)

  await comCliente(c => c.query(
    `INSERT INTO versoes (versao, publicado_por, notas, arquivo, tamanho, sha256, conteudo)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (versao) DO UPDATE SET
       publicado_em = now(), publicado_por = EXCLUDED.publicado_por,
       notas = EXCLUDED.notas, arquivo = EXCLUDED.arquivo,
       tamanho = EXCLUDED.tamanho, sha256 = EXCLUDED.sha256,
       conteudo = EXCLUDED.conteudo`,
    [versao.trim(), publicadoPor, notas, arquivo, conteudo.length, sha256, conteudo]
  ))

  return { versao: versao.trim(), arquivo, tamanho: conteudo.length }
}

/**
 * Baixa o instalador da versão para uma pasta local e confere a integridade.
 * Devolve o caminho do arquivo gravado.
 */
export async function baixarVersao(versao: string, pasta: string): Promise<string> {
  const linha = await comCliente(async c => {
    const { rows } = await c.query(
      'SELECT arquivo, sha256, conteudo FROM versoes WHERE versao = $1', [versao]
    )
    return rows[0] ?? null
  })
  if (!linha) throw new Error(`Versão ${versao} não está publicada no servidor.`)

  const conteudo: Buffer = linha.conteudo
  const conferido = createHash('sha256').update(conteudo).digest('hex')
  if (conferido !== linha.sha256) {
    throw new Error('O instalador baixado não confere com o registrado no servidor.')
  }

  fs.mkdirSync(pasta, { recursive: true })
  const destino = path.join(pasta, linha.arquivo)
  fs.writeFileSync(destino, conteudo)
  return destino
}

/** Remove uma versão publicada. */
export async function removerVersao(versao: string): Promise<void> {
  await comCliente(c => c.query('DELETE FROM versoes WHERE versao = $1', [versao]))
}

/** Histórico, sem os instaladores. */
export async function listarVersoes(): Promise<VersaoPublicada[]> {
  return comCliente(async c => {
    const { rows } = await c.query(
      `SELECT versao, publicado_em, publicado_por, notas, arquivo, tamanho, sha256
       FROM versoes ORDER BY publicado_em DESC`
    )
    return rows.map(r => ({
      versao: r.versao,
      publicadoEm: r.publicado_em instanceof Date ? r.publicado_em.toISOString() : String(r.publicado_em),
      publicadoPor: r.publicado_por,
      notas: r.notas,
      arquivo: r.arquivo,
      tamanho: Number(r.tamanho),
      sha256: r.sha256
    }))
  })
}
