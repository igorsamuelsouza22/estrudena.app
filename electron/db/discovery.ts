import net from 'node:net'
import os from 'node:os'
import { Client } from 'pg'
import { DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from './credentials'

/** Testa se há algo escutando em host:porta. */
function portaAberta(host: string, porta: number, timeout: number): Promise<boolean> {
  return new Promise(resolve => {
    const sock = new net.Socket()
    let done = false
    const fim = (ok: boolean) => {
      if (done) return
      done = true
      sock.destroy()
      resolve(ok)
    }
    sock.setTimeout(timeout)
    sock.once('connect', () => fim(true))
    sock.once('timeout', () => fim(false))
    sock.once('error', () => fim(false))
    sock.connect(porta, host)
  })
}

/** Confirma que o host realmente tem o banco da Estrudena e aceita nossas credenciais. */
export async function ehServidorEstrudena(host: string, porta = DB_PORT): Promise<boolean> {
  const c = new Client({
    host, port: porta, database: DB_NAME, user: DB_USER, password: DB_PASSWORD,
    connectionTimeoutMillis: 4000, application_name: 'estrudena-discovery'
  })
  try {
    await c.connect()
    await c.query('SELECT 1')
    return true
  } catch {
    return false
  } finally {
    try { await c.end() } catch { /* já caiu */ }
  }
}

/** Endereços IPv4 das interfaces locais, sem loopback nem APIPA. */
function interfacesLocais(): { ip: string; prefixo: string }[] {
  const saida: { ip: string; prefixo: string }[] = []
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const nic of lista ?? []) {
      if (nic.family !== 'IPv4' || nic.internal) continue
      if (nic.address.startsWith('169.254.')) continue
      const partes = nic.address.split('.')
      if (partes.length !== 4) continue
      saida.push({ ip: nic.address, prefixo: partes.slice(0, 3).join('.') })
    }
  }
  return saida
}

async function emLotes<T, R>(itens: T[], tamanho: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < itens.length; i += tamanho) {
    out.push(...await Promise.all(itens.slice(i, i + tamanho).map(fn)))
  }
  return out
}

export interface ProgressoVarredura {
  (etapa: string): void
}

/**
 * Procura o PC servidor na rede local.
 *
 * Ordem: localhost → hosts já conhecidos → varredura da sub-rede /24 de cada
 * placa de rede. A varredura é feita em lotes de 64 com timeout curto, então
 * uma rede /24 inteira leva poucos segundos.
 */
export async function procurarServidor(
  hostsConhecidos: string[] = [],
  progresso?: ProgressoVarredura
): Promise<string | null> {
  const tentar = async (host: string) => {
    if (!await portaAberta(host, DB_PORT, 600)) return false
    return ehServidorEstrudena(host)
  }

  progresso?.('Procurando o banco nesta máquina…')
  if (await tentar('127.0.0.1')) return '127.0.0.1'

  for (const h of hostsConhecidos) {
    if (!h) continue
    progresso?.(`Tentando ${h}…`)
    if (await tentar(h)) return h
  }

  const nics = interfacesLocais()
  for (const nic of nics) {
    progresso?.(`Varrendo a rede ${nic.prefixo}.0/24…`)
    const candidatos: string[] = []
    for (let i = 1; i <= 254; i++) {
      const ip = `${nic.prefixo}.${i}`
      if (ip !== nic.ip) candidatos.push(ip)
    }

    // 1ª passada: quem responde na 5432.
    const abertos: string[] = []
    await emLotes(candidatos, 64, async ip => {
      if (await portaAberta(ip, DB_PORT, 400)) abertos.push(ip)
    })

    // 2ª passada: qual deles é de fato o banco da Estrudena.
    for (const ip of abertos) {
      progresso?.(`Verificando ${ip}…`)
      if (await ehServidorEstrudena(ip)) return ip
    }
  }

  return null
}
