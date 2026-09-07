import { useEffect, useState } from 'react'
import { chamar, ponte } from './api'
import { useApp } from './store'

export function StatusConexao() {
  const app = useApp()
  const [status, setStatus] = useState('Verificando servidor…')
  const [host, setHost] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    let ativo = true
    const verificar = async () => { try { const c = await chamar(ponte().estadoConexao()); if (ativo) { setHost(c.host); setStatus(c.status === 'conectado' ? 'Servidor conectado' : 'Servidor indisponível') } } catch { if (ativo) setStatus('Servidor indisponível') } }
    void verificar(); const t = setInterval(() => void verificar(), 30000)
    return () => { ativo = false; clearInterval(t) }
  }, [])
  return <div style={{ padding: '8px 16px', fontSize: 12, color: '#5f6368' }}>
    <div role="status">{app.gravando ? 'Salvando no servidor…' : status}</div>
    <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={ocupado || app.gravando} title={host} onClick={async () => {
      setOcupado(true)
      try { const c = await chamar(ponte().conectar(host || undefined)); if (c.status !== 'conectado') throw new Error(c.mensagem); await app.recarregar(); setStatus('Servidor conectado'); app.say('Conexão e dados atualizados. Seus rascunhos continuam disponíveis.') }
      catch (e) { setStatus('Servidor indisponível'); app.say(e instanceof Error ? e.message : 'Falha ao reconectar. Tente novamente.') }
      finally { setOcupado(false) }
    }}>{ocupado ? 'Reconectando…' : 'Reconectar / atualizar'}</button>
  </div>
}
