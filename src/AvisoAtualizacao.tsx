import { useEffect, useState } from 'react'
import { chamar, ponte } from './api'
import { muted45, muted50 } from './ui'
import type { EstadoAtualizacao } from './shared/types'

/** Intervalo de reconferência: quem deixa o sistema aberto o dia todo também é avisado. */
const INTERVALO = 30 * 60 * 1000

const mb = (bytes: number): string => (bytes / 1024 / 1024).toFixed(0) + ' MB'

/**
 * Avisa quando o servidor tem uma versão mais nova que a instalada nesta
 * máquina e conduz a atualização: baixa o instalador do próprio servidor e
 * abre. O Windows ainda pede confirmação de administrador — nada roda sozinho.
 */
export function AvisoAtualizacao() {
  const [estado, setEstado] = useState<EstadoAtualizacao | null>(null)
  const [dispensado, setDispensado] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [passo, setPasso] = useState('')
  const [baixado, setBaixado] = useState('')

  useEffect(() => {
    let vivo = true
    const conferir = async () => {
      try {
        const e = await chamar(ponte().estadoAtualizacao())
        if (vivo) setEstado(e)
      } catch { /* servidor sem a tabela ainda, ou fora do ar: sem aviso */ }
    }
    void conferir()
    const t = window.setInterval(conferir, INTERVALO)
    return () => { vivo = false; window.clearInterval(t) }
  }, [])

  if (!estado?.temNova || !estado.disponivel) return null
  const nova = estado.disponivel
  if (dispensado === nova.versao) return null

  const atualizar = async () => {
    setOcupado(true)
    try {
      setPasso(nova.origem === 'github' ? 'Baixando do GitHub…' : 'Baixando do servidor…')
      const caminho = await chamar(ponte().baixarVersao(nova.versao, nova.url, nova.arquivo))
      setBaixado(caminho)
      setPasso('Abrindo o instalador…')
      await chamar(ponte().abrirInstalador(caminho))
    } catch (e) {
      setPasso(e instanceof Error ? e.message : 'Não consegui baixar a atualização.')
      setOcupado(false)
    }
  }

  return (
    <div
      className="noprint"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '9px 24px',
        background: 'var(--color-accent-200)', borderBottom: '1px solid var(--color-divider)'
      }}
    >
      <span style={{
        fontFamily: 'var(--font-heading)', fontSize: 12, letterSpacing: '.04em',
        color: 'var(--color-accent-800)', whiteSpace: 'nowrap'
      }}>
        Versão {nova.versao} disponível
      </span>
      <span className="trunc" style={{ flex: 1, fontSize: 13, color: 'var(--color-accent-700)' }}>
        {nova.notas || `Esta máquina está na ${estado.versaoLocal}.`}
        <span style={{ color: muted50 }}>
          {' '}· {mb(nova.tamanho)} · {nova.origem === 'github' ? 'via GitHub' : `publicada por ${nova.publicadoPor || '—'}`}
        </span>
      </span>

      {passo && <span style={{ fontSize: 12, color: muted45, whiteSpace: 'nowrap' }}>{passo}</span>}

      {baixado && !ocupado && (
        <button
          className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 8px' }}
          onClick={() => void chamar(ponte().mostrarNaPasta(baixado))}
        >abrir a pasta</button>
      )}

      <button
        className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 8px' }}
        disabled={ocupado}
        onClick={() => setDispensado(nova.versao)}
      >agora não</button>

      <button
        className="btn btn-primary" style={{ minHeight: 28, padding: '3px 12px', fontSize: 13 }}
        disabled={ocupado}
        onClick={() => void atualizar()}
      >{ocupado ? 'Aguarde…' : 'Baixar e instalar'}</button>
    </div>
  )
}
