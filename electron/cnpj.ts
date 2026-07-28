import type { DadosCnpj } from '../src/shared/types'

/**
 * Consulta de CNPJ na BrasilAPI.
 *
 * Roda no processo principal de propósito: a página tem política de segurança
 * que barra chamadas a domínios externos, e aqui também não esbarra em CORS.
 *
 * É um recurso de conveniência — o sistema inteiro funciona sem internet, e
 * qualquer falha aqui apenas devolve uma mensagem para o usuário digitar à mão.
 */

const URL_BASE = 'https://brasilapi.com.br/api/cnpj/v1/'
const TEMPO_LIMITE = 12_000

export const somenteDigitos = (v: string): string => v.replace(/\D/g, '')

/** Valida os dígitos verificadores — evita ir à rede com um número impossível. */
export function cnpjValido(bruto: string): boolean {
  const c = somenteDigitos(bruto)
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false

  const digito = (base: string): number => {
    let peso = base.length - 7
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * peso--
      if (peso < 2) peso = 9
    }
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }

  return digito(c.slice(0, 12)) === Number(c[12])
    && digito(c.slice(0, 13)) === Number(c[13])
}

export const formatarCnpj = (bruto: string): string => {
  const c = somenteDigitos(bruto).slice(0, 14)
  return c
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

interface RespostaBrasilApi {
  razao_social?: string
  nome_fantasia?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  cep?: string
  ddd_telefone_1?: string
  email?: string
  message?: string
}

function montarEndereco(d: RespostaBrasilApi): string {
  const rua = [d.logradouro, d.numero].filter(Boolean).join(', ')
  const resto = [d.complemento, d.bairro].filter(Boolean).join(' — ')
  return [rua, resto].filter(Boolean).join(' — ')
}

function montarTelefone(bruto?: string): string {
  const d = somenteDigitos(bruto ?? '')
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  return bruto ?? ''
}

export async function consultarCnpj(bruto: string): Promise<DadosCnpj> {
  const cnpj = somenteDigitos(bruto)
  if (!cnpjValido(cnpj)) throw new Error('CNPJ inválido — confira os números.')

  const controle = new AbortController()
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE)

  let resposta: Response
  try {
    resposta = await fetch(URL_BASE + cnpj, {
      signal: controle.signal,
      headers: {
        accept: 'application/json',
        // Sem User-Agent a BrasilAPI responde 403. O fetch do Node não manda
        // nenhum por padrão, então este cabeçalho é obrigatório aqui.
        'user-agent': 'SistemaEstrudena/1.0 (+aluminio@estrudena.com.br)'
      }
    })
  } catch (e) {
    const abortou = e instanceof Error && e.name === 'AbortError'
    throw new Error(abortou
      ? 'A consulta demorou demais. Preencha os dados à mão.'
      : 'Sem acesso à internet para consultar o CNPJ. Preencha os dados à mão.')
  } finally {
    clearTimeout(relogio)
  }

  if (resposta.status === 404) throw new Error('CNPJ não encontrado na Receita Federal.')
  if (!resposta.ok) throw new Error(`A consulta falhou (${resposta.status}). Preencha os dados à mão.`)

  const d = await resposta.json() as RespostaBrasilApi
  const razao = (d.razao_social ?? '').trim()

  return {
    cnpj: formatarCnpj(cnpj),
    razao,
    nome: (d.nome_fantasia ?? '').trim() || razao,
    endereco: montarEndereco(d),
    cidade: [d.municipio, d.uf].filter(Boolean).join(' — '),
    fone: montarTelefone(d.ddd_telefone_1),
    email: (d.email ?? '').trim()
  }
}
