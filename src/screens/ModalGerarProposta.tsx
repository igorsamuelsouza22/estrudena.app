import { useState } from 'react'
import { muted45, muted50 } from '../ui'

/**
 * Perguntado logo depois de gerar a proposta: quais documentos emitir em PDF.
 * Os dois podem ser marcados — saem em sequência, um arquivo cada.
 */
export function ModalGerarProposta(p: {
  numero: string
  rev: string
  onConfirmar: (opcoes: { proposta: boolean; separacao: boolean }) => void
  onFechar: () => void
}) {
  const [proposta, setProposta] = useState(true)
  const [separacao, setSeparacao] = useState(false)

  return (
    <div
      className="dialog-backdrop noprint" style={{ zIndex: 70, alignItems: 'center', paddingTop: 0 }}
      onMouseDown={e => { if (e.target === e.currentTarget) p.onFechar() }}
    >
      <div className="dialog" style={{ width: 'min(460px, 92vw)', overflow: 'hidden', animation: 'eIn .16s ease' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, height: 56,
          padding: '0 20px', borderBottom: '1px solid var(--color-divider)'
        }}>
          <span style={{ fontSize: 16 }}>Proposta gerada</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: '#5f6368', whiteSpace: 'nowrap' }}>{p.numero} · {p.rev}</span>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: muted50, lineHeight: 1.45 }}>
            Escolha o que deseja salvar em PDF agora. Você pode gerar os dois — cada um
            abre uma janela para escolher onde gravar.
          </div>

          <Opcao
            marcado={proposta} onMudar={setProposta}
            titulo="Proposta comercial"
            detalhe="Documento do cliente, com valores, desenhos e condições."
          />
          <Opcao
            marcado={separacao} onMudar={setSeparacao}
            titulo="Pedido de separação"
            detalhe="Documento da fábrica, sem nenhum valor comercial."
          />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '10px 20px',
          background: 'var(--color-surface)', borderTop: '1px solid var(--color-divider)'
        }}>
          <span style={{ fontSize: 12, color: muted45 }}>
            {proposta || separacao ? 'Os PDFs são gerados em seguida.' : 'Nenhum documento marcado.'}
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={p.onFechar}>Agora não</button>
          <button
            className="btn btn-primary"
            onClick={() => p.onConfirmar({ proposta, separacao })}
          >
            {proposta || separacao ? 'Gerar PDF' : 'Concluir'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Opcao(p: {
  marcado: boolean
  onMudar: (v: boolean) => void
  titulo: string
  detalhe: string
}) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 11, padding: '10px 12px',
        border: `1px solid ${p.marcado ? 'var(--color-accent)' : 'var(--color-accent-300)'}`,
        borderRadius: 12, cursor: 'pointer',
        background: p.marcado ? 'var(--color-surface)' : '#fff',
        transition: 'border-color .15s, background .15s'
      }}
    >
      <input
        type="checkbox" checked={p.marcado} onChange={e => p.onMudar(e.target.checked)}
        style={{ width: 16, height: 16, marginTop: 2, accentColor: '#202124' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14 }}>{p.titulo}</div>
        <div style={{ fontSize: 12, color: muted50, lineHeight: 1.4 }}>{p.detalhe}</div>
      </div>
    </label>
  )
}
