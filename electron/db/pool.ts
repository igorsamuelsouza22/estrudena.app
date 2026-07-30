import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import pg, { Pool, PoolClient } from 'pg'
import { DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from './credentials'
import { interfacesLocais, procurarServidor } from './discovery'
import { migrar } from './migrate'
import type { ConnState } from '../../src/shared/types'

// numeric e bigint chegam como string por padrão; aqui tudo é dinheiro/medida.
pg.types.setTypeParser(1700, v => (v === null ? null : parseFloat(v)))
pg.types.setTypeParser(20, v => (v === null ? null : parseInt(v, 10)))

interface ConexaoSalva { host: string; porta: number }

let pool: Pool | null = null
let estado: ConnState = {
  status: 'desconectado', host: '', porta: DB_PORT, mensagem: '', modoServidor: false
}

function arquivoConexao(): string {
  return path.join(app.getPath('userData'), 'conexao.json')
}

function lerConexao(): ConexaoSalva | null {
  try {
    const raw = fs.readFileSync(arquivoConexao(), 'utf8')
    const j = JSON.parse(raw) as ConexaoSalva
    if (j && typeof j.host === 'string' && j.host) return { host: j.host, porta: j.porta || DB_PORT }
  } catch { /* primeira execução */ }
  return null
}

function gravarConexao(c: ConexaoSalva): void {
  try {
    fs.mkdirSync(path.dirname(arquivoConexao()), { recursive: true })
    fs.writeFileSync(arquivoConexao(), JSON.stringify(c, null, 2), 'utf8')
  } catch { /* disco somente leitura — segue com a conexão em memória */ }
}

export function estadoConexao(): ConnState {
  return { ...estado }
}

function novoPool(host: string, porta: number): Pool {
  return new Pool({
    host, port: porta, database: DB_NAME, user: DB_USER, password: DB_PASSWORD,
    max: 6, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 8000,
    application_name: 'estrudena'
  })
}

async function ligar(host: string, porta: number): Promise<void> {
  const p = novoPool(host, porta)
  const c = await p.connect()
  try {
    await migrar(c)
  } finally {
    c.release()
  }
  if (pool) { const antigo = pool; pool = null; antigo.end().catch(() => {}) }
  pool = p
  estado = {
    status: 'conectado', host, porta, modoServidor: host === '127.0.0.1' || host === 'localhost',
    mensagem: `Conectado a ${host}:${porta}`
  }
  gravarConexao({ host, porta })
}

/**
 * Conecta ao banco. Sem host informado, procura o servidor na rede:
 * conexão gravada → localhost → varredura da sub-rede.
 */
export async function conectar(
  hostManual?: string,
  progresso?: (etapa: string) => void
): Promise<ConnState> {
  estado = { ...estado, status: 'procurando', mensagem: 'Procurando o servidor…' }

  try {
    if (hostManual) {
      const [h, p] = hostManual.split(':')
      await ligar(h.trim(), p ? parseInt(p, 10) : DB_PORT)
      return estadoConexao()
    }

    const salva = lerConexao()
    if (salva) {
      progresso?.(`Tentando ${salva.host}…`)
      try {
        await ligar(salva.host, salva.porta)
        return estadoConexao()
      } catch { /* mudou de IP — cai na varredura */ }
    }

    const achado = await procurarServidor(salva ? [salva.host] : [], progresso)
    if (!achado) {
      // Dizer quais redes foram varridas resolve sozinho o engano mais comum:
      // o terminal no Wi-Fi e o servidor no cabo, em faixas diferentes. Sem
      // isso a mensagem é a mesma para "servidor desligado", "firewall
      // bloqueando" e "rede errada", e ninguém sabe por onde começar.
      const redes = interfacesLocais().map(n => `${n.prefixo}.0/24`)
      const onde = redes.length
        ? ` Esta máquina procurou em ${redes.join(' e ')}.`
        : ''
      estado = {
        status: 'erro', host: '', porta: DB_PORT, modoServidor: false,
        mensagem: 'Não encontrei o servidor do Estrudena nesta rede.' + onde +
          ' Confira se o PC servidor está ligado e na mesma rede, ou informe o endereço dele abaixo.'
      }
      return estadoConexao()
    }
    await ligar(achado, DB_PORT)
    return estadoConexao()
  } catch (e) {
    estado = {
      status: 'erro', host: hostManual ?? '', porta: DB_PORT, modoServidor: false,
      mensagem: e instanceof Error ? e.message : String(e)
    }
    return estadoConexao()
  }
}

export function temPool(): boolean {
  return pool !== null
}

export async function comCliente<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  if (!pool) throw new Error('Sem conexão com o banco de dados.')
  const c = await pool.connect()
  try {
    return await fn(c)
  } finally {
    c.release()
  }
}

export async function encerrar(): Promise<void> {
  const p = pool
  pool = null
  if (p) await p.end().catch(() => {})
}
