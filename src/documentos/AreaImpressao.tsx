import { nomeProposta } from '../shared/types'
import { useEffect, useState } from 'react'
import { useFocoModal } from '../ui'
import { chamar, ponte } from '../api'
import { useApp, type PedidoImpressao } from '../store'
import { FolhaProposta } from './FolhaProposta'
import { FolhaSeparacao } from './FolhaSeparacao'

type Etapa = 'proposta' | 'separacao'

/** Espera as imagens da página e mais dois quadros, para o layout assentar. */
async function esperarRender(): Promise<void> {
  await Promise.all([...document.images].map(img =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>(pronto => {
          img.addEventListener('load', () => pronto(), { once: true })
          img.addEventListener('error', () => pronto(), { once: true })
        })
  ))
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
}

/**
 * Monta as folhas A4 fora das telas e gera os PDFs pedidos, um de cada vez.
 *
 * Fica montado no shell: qualquer tela pode pedir um documento sem precisar
 * navegar até ele. Um documento por vez porque a impressão pega a página
 * inteira — os dois juntos sairiam no mesmo arquivo.
 */
export function AreaImpressao() {
  const app = useApp()
  const pedido = app.pedidoImpressao
  const [etapa, setEtapa] = useState<Etapa | null>(null)

  // Escolhe a primeira etapa quando um pedido chega.
  useEffect(() => {
    if (!pedido) { setEtapa(null); return }
    setEtapa(pedido.proposta ? 'proposta' : pedido.separacao ? 'separacao' : null)
  }, [pedido])

  const orc = pedido ? app.db.orcamentos.find(o => o.id === pedido.orcId) ?? null : null

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const salvar = async () => {
    if (!pedido || !etapa || !orc || salvando) return
    setSalvando(true); setErro('')
    try {
      await esperarRender()
      const nome = `${etapa === 'proposta' ? '' : 'Separacao-'}${nomeProposta(orc)}.pdf`
      const caminho = await chamar(ponte().salvarPdf(nome))
      if (!caminho) return
      app.say(etapa === 'proposta' ? 'Proposta salva em PDF' : 'Pedido de separação salvo em PDF')
      if (etapa === 'proposta' && pedido.separacao) setEtapa('separacao')
      else app.encerrarImpressao()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao salvar PDF. Tente novamente.') }
    finally { setSalvando(false) }
  }

  if (!pedido || !etapa || !orc) return null

  const pendencias = [!orc.itens.length && 'Nenhum produto na proposta', !orc.clienteId && 'Cliente não informado', !orc.obra && 'Obra não informada', !orc.prazo && 'Prazo não informado', !orc.condPag && 'Condição de pagamento não informada'].filter(Boolean)
  return <Previa onFechar={() => { if (!salvando) app.encerrarImpressao() }}>
    <div className="preview-toolbar noprint"><strong>{etapa === 'proposta' ? 'Proposta comercial' : 'Pedido de separação'} · {nomeProposta(orc)}</strong>
      <button className="btn btn-primary" disabled={salvando || !orc.itens.length || !orc.clienteId} onClick={() => void salvar()}>{salvando ? 'Preparando PDF…' : 'Salvar PDF'}</button>
      <button className="btn btn-secondary" disabled={salvando} onClick={app.encerrarImpressao}>Fechar prévia</button>
      {!!pendencias.length && <div className="notice warning" style={{ width: '100%' }}>Confira antes de enviar: {pendencias.join(' · ')}</div>}
      {erro && <div role="alert" className="field-error">{erro}</div>}
    </div>
    {etapa === 'proposta' ? <FolhaProposta orc={orc} /> : <FolhaSeparacao orc={orc} />}
  </Previa>
}

export type { PedidoImpressao }

function Previa(p: { children: React.ReactNode; onFechar: () => void }) {
  const ref = useFocoModal(p.onFechar)
  return <div className="preview-layer" ref={ref} tabIndex={-1} role="dialog" aria-label="Prévia do PDF" aria-modal="true">{p.children}</div>
}
