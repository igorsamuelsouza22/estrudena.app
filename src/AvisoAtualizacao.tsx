import { useCallback, useEffect, useRef, useState } from 'react'
import { chamar, ponte } from './api'
import { muted45, muted50 } from './ui'
import type { EstadoAtualizacao } from './shared/types'

/** Reconferência periódica: quem deixa o sistema aberto o dia todo também é avisado. */
const INTERVALO = 30 * 60 * 1000
/** Volta do almoço não precisa disparar consulta a cada clique na janela. */
const INTERVALO_FOCO = 5 * 60 * 1000

const mb = (bytes: number): string => (bytes / 1024 / 1024).toFixed(0) + ' MB'

type Fase = 'ocioso' | 'baixando' | 'pronto' | 'instalando' | 'erro'

/**
 * Avisa quando há versão mais nova que a instalada nesta máquina.
 *
 * O instalador é baixado em segundo plano assim que a novidade aparece, para
 * que instalar seja imediato quando a pessoa quiser. A instalação em si nunca
 * acontece sozinha: troca arquivos em uso e derrubaria o sistema no meio de um
 * orçamento. Quem não quiser parar agora pode simplesmente ignorar — ao fechar
 * o sistema, ele oferece instalar.
 */
export function AvisoAtualizacao() {
  const [estado, setEstado] = useState<EstadoAtualizacao | null>(null)
  const [dispensado, setDispensado] = useState('')
  const [fase, setFase] = useState<Fase>('ocioso')
  const [pct, setPct] = useState(0)
  const [recebido, setRecebido] = useState(0)
  const [recado, setRecado] = useState('')
  const [baixado, setBaixado] = useState('')
  const ultimaConferida = useRef(0)
  // Guarda qual versão já foi baixada, para não baixar de novo a cada render.
  const baixando = useRef('')

  const conferir = useCallback(async () => {
    ultimaConferida.current = Date.now()
    try {
      setEstado(await chamar(ponte().estadoAtualizacao()))
    } catch { /* servidor fora do ar ou sem internet: simplesmente não avisa */ }
  }, [])

  useEffect(() => {
    void conferir()
    const t = window.setInterval(conferir, INTERVALO)
    const aoFocar = () => {
      if (Date.now() - ultimaConferida.current > INTERVALO_FOCO) void conferir()
    }
    window.addEventListener('focus', aoFocar)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('focus', aoFocar)
    }
  }, [conferir])

  useEffect(() => ponte().onProgressoDownload(p => {
    setRecebido(p.recebido)
    // O download vindo do banco não informa total; nesse caso a barra fica
    // indeterminada em vez de mostrar uma porcentagem inventada.
    if (p.total > 0) setPct(Math.min(100, Math.round(p.recebido / p.total * 100)))
  }), [])

  // Se o processo principal já tem um instalador baixado (de antes desta tela
  // montar), aproveita em vez de baixar de novo.
  useEffect(() => {
    void (async () => {
      try {
        const p = await chamar(ponte().atualizacaoPendente())
        if (p) { baixando.current = p.versao; setBaixado(p.caminho); setFase('pronto') }
      } catch { /* sem pendência */ }
    })()
  }, [])

  const nova = estado?.temNova ? estado.disponivel : null

  // Baixa em segundo plano assim que a novidade aparece.
  useEffect(() => {
    if (!nova || baixando.current === nova.versao) return
    baixando.current = nova.versao
    setFase('baixando')
    setPct(0)
    setRecebido(0)
    void (async () => {
      try {
        const caminho = await chamar(ponte().baixarVersao(nova.versao, nova.url, nova.arquivo))
        setBaixado(caminho)
        setFase('pronto')
      } catch (e) {
        setRecado(e instanceof Error ? e.message : 'Não consegui baixar a atualização.')
        setFase('erro')
        baixando.current = '' // permite nova tentativa
      }
    })()
  }, [nova])

  if (!nova || dispensado === nova.versao) return null

  const instalar = async () => {
    setFase('instalando')
    try {
      await chamar(ponte().abrirInstalador(baixado))
    } catch (e) {
      setRecado(e instanceof Error ? e.message : 'Não consegui abrir o instalador.')
      setFase('erro')
    }
  }

  return (
    <div
      className="noprint"
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 12, padding: '9px 24px 11px',
        background: 'var(--color-accent-200)', borderBottom: '1px solid var(--color-divider)'
      }}
    >
      {fase === 'baixando' && (
        <div className={'barra-atualizacao' + (pct ? '' : ' indefinida')}>
          <div style={pct ? { width: `${pct}%` } : undefined} />
        </div>
      )}
      <span style={{
        fontFamily: 'var(--font-heading)', fontSize: 12, letterSpacing: '.04em',
        color: 'var(--color-accent-800)', whiteSpace: 'nowrap'
      }}>
        Versão {nova.versao} disponível
      </span>

      <span className="trunc" style={{ flex: 1, fontSize: 13, color: 'var(--color-accent-700)' }}>
        {nova.notas || `Esta máquina está na ${estado?.versaoLocal}.`}
        <span style={{ color: muted50 }}>
          {' '}· {mb(nova.tamanho)} · {nova.origem === 'github' ? 'via GitHub' : `publicada por ${nova.publicadoPor || '—'}`}
        </span>
      </span>

      {fase === 'baixando' && (
        <span className="tnum" style={{ fontSize: 12, color: muted45, whiteSpace: 'nowrap' }}>
          {pct
            ? `Baixando ${pct}% · ${mb(recebido)} de ${mb(nova.tamanho)}`
            : 'Baixando…'}
        </span>
      )}
      {fase === 'erro' && (
        <span style={{ fontSize: 12, color: 'var(--color-accent-800)', whiteSpace: 'nowrap' }}>{recado}</span>
      )}
      {fase === 'pronto' && (
        <span style={{ fontSize: 12, color: muted45, whiteSpace: 'nowrap' }}>
          Baixado — instala em menos de um minuto
        </span>
      )}

      {fase === 'pronto' && (
        <button
          className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 8px' }}
          onClick={() => void chamar(ponte().mostrarNaPasta(baixado))}
        >abrir a pasta</button>
      )}

      <button
        className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 8px' }}
        disabled={fase === 'instalando'}
        onClick={() => setDispensado(nova.versao)}
        title="O sistema oferece instalar quando você fechar"
      >agora não</button>

      <button
        className="btn btn-primary" style={{ minHeight: 28, padding: '3px 12px', fontSize: 13 }}
        disabled={fase === 'baixando' || fase === 'instalando'}
        onClick={() => void instalar()}
      >
        {fase === 'baixando' ? 'Baixando…' : fase === 'instalando' ? 'Abrindo…' : 'Instalar agora'}
      </button>
    </div>
  )
}
