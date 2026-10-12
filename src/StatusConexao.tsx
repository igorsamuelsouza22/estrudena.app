import { useEffect, useState } from 'react'
import { chamar, ponte } from './api'
import { useApp } from './store'

/** Estado da conexão, consultado a cada 30 s, e a ação de reconectar. */
export function useConexao() {
  const app = useApp()
  const [status, setStatus] = useState<'verificando' | 'conectado' | 'indisponivel'>('verificando')
  const [host, setHost] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    let ativo = true
    const verificar = async () => { try { const c = await chamar(ponte().estadoConexao()); if (ativo) { setHost(c.host); setStatus(c.status === 'conectado' ? 'conectado' : 'indisponivel') } } catch { if (ativo) setStatus('indisponivel') } }
    void verificar(); const t = setInterval(() => void verificar(), 30000)
    return () => { ativo = false; clearInterval(t) }
  }, [])
  const reconectar = async () => {
    setOcupado(true)
    try { const c = await chamar(ponte().conectar(host || undefined)); if (c.status !== 'conectado') throw new Error(c.mensagem); await app.recarregar(); setStatus('conectado'); app.say('Conexão e dados atualizados. Seus rascunhos continuam disponíveis.') }
    catch (e) { setStatus('indisponivel'); app.say(e instanceof Error ? e.message : 'Falha ao reconectar. Tente novamente.') }
    finally { setOcupado(false) }
  }
  return { status, host, ocupado, reconectar, gravando: app.gravando }
}

export type Conexao = ReturnType<typeof useConexao>

/** Botão de reconexão; o texto do estado só aparece quando há algo a dizer. */
export function Reconectar({ cx }: { cx: Conexao }) {
  return <button className="btn btn-ghost" disabled={cx.ocupado || cx.gravando} title={cx.host} onClick={() => void cx.reconectar()}>
    {cx.ocupado ? 'Reconectando…' : 'Reconectar / atualizar'}
  </button>
}

/** Só ocupa espaço no menu quando o servidor não responde. */
export function AlertaConexao({ cx }: { cx: Conexao }) {
  if (cx.status !== 'indisponivel') return null
  return <div className="connection-alert" role="status">
    <strong>Servidor indisponível</strong>
    <Reconectar cx={cx} />
  </div>
}
