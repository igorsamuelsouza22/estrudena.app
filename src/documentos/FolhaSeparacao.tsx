import { necessidadesProducao } from '../producao'
import { nomeProposta } from '../shared/types'
import { catalogoDoPedido } from '../historico'
import { useMemo } from 'react'
import { fn, hoje } from '../format'
import { MateriaisDoPedido } from '../MateriaisDoPedido'
import { SEP_VAZIA, useApp } from '../store'
import { muted45 } from '../ui'
import type { Orcamento } from '../shared/types'

/**
 * Pedido de separação de material em A4.
 * Documento interno de produção — sem nenhum valor comercial.
 */
export function FolhaSeparacao({ orc }: { orc: Orcamento }) {
  const app = useApp()
  const { motor } = app
  const db = catalogoDoPedido(app.db, orc)
  const sep = db.separacoes[orc.id] ?? SEP_VAZIA
  const c = useMemo(() => motor.calc(orc), [motor, orc])

  const linhas = c.rows.map(r => {
    const feito = sep.conf[String(r.i)] ?? 0
    return { r, feito, falta: Math.max(0, r.qtd - feito) }
  })

  const {ferragens} = necessidadesProducao(app.db,orc)

  const totSep = linhas.reduce((a, l) => a + Math.min(l.feito, l.r.qtd), 0)
  const totFalta = linhas.reduce((a, l) => a + l.falta, 0)
  const cliente = db.clientes.find(x => x.id === orc.clienteId)?.nome ?? '—'

  const campos: [string, string][] = [
    ['Ordem de produção', app.db.pedidos?.find(p=>p.orcamentoId===orc.id)?.ordemProducaoId||'Histórico anterior'], ['Cliente', cliente], ['Obra', orc.obra], ['Cidade', orc.cidade],
    ['Contato na obra', orc.contato], ['Prazo de entrega', orc.prazo],
    ['Proposta de origem', nomeProposta(orc)],
    ['Separado por', sep.responsavel || '—'],
    ['Volume', `${fn(c.pecas, 0)} peças · ${linhas.length} tipologias`]
  ]

  const rot = {
    fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase' as const,
    color: 'color-mix(in srgb, var(--color-text) 48%, transparent)'
  }

  return (
    <div className="printdoc printonly" style={{
      background: '#fff', border: '1px solid var(--color-divider)', padding: '22px 26px', maxWidth: 920
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, borderBottom: '2px solid var(--color-text)', paddingBottom: 11 }}>
        <img src="assets/logo-estrudena.png" alt="Estrudena" style={{ height: 34, width: 'auto' }} />
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
            Pedido de separação de material
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 25, lineHeight: 1.05 }}>SEP {orc.numero}</div>
          <div style={{ fontSize: 10.5, color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>
            emitido {hoje()} · {orc.rev} · {sep.status}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '9px 18px', padding: '12px 0 14px' }}>
        {campos.map(([l, v]) => (
          <div key={l}>
            <div style={rot}>{l}</div>
            <div style={{ fontSize: 12, lineHeight: 1.35 }}>{v}</div>
          </div>
        ))}
      </div>

      <table className="table fluida" style={{ fontSize: 11 }}>
        <thead><tr>
          <th style={{ width: 20 }}>✓</th><th style={{ width: 18 }}>#</th><th style={{ width: 52 }}>Cód</th>
          <th>Descrição / tipologia</th><th style={{ width: 58 }}>Série</th>
          <th style={{ width: 62 }}>Acabamento</th><th style={{ width: 62 }}>Vidro</th>
          <th style={{ width: 78, textAlign: 'right' }}>Corte L × A</th>
          <th style={{ width: 34, textAlign: 'right' }}>Ped.</th>
          <th style={{ width: 34, textAlign: 'right' }}>Sep.</th>
          <th style={{ width: 34, textAlign: 'right' }}>Falta</th>
          <th style={{ width: 42, textAlign: 'right' }}>m²</th>
          <th style={{ width: 46, textAlign: 'right' }}>Kg</th>
        </tr></thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.r.i}>
              <td><span style={{ width: 14, height: 14, border: '1px solid var(--color-text)', display: 'grid', placeItems: 'center', fontSize: 10, lineHeight: 1 }}>
                {l.falta === 0 ? '✓' : ''}
              </span></td>
              <td style={{ color: 'color-mix(in srgb, var(--color-text) 45%, transparent)', fontSize: 10.5 }}>{l.r.i + 1}</td>
              <td style={{ fontFamily: 'var(--font-heading)', fontSize: 14, whiteSpace: 'nowrap' }}>{l.r.m?.cod ?? '—'}</td>
              <td style={{ fontSize: 11, lineHeight: 1.3 }}>
                {l.r.it.desc ?? l.r.m?.desc ?? ''}
                <div style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>{l.r.it.local}</div>
              </td>
              <td style={{ fontSize: 10.5 }}>{l.r.it.serie ?? l.r.m?.serie ?? '—'}</td>
              <td style={{ fontSize: 10.5 }}>{l.r.it.perfil}</td>
              <td style={{ fontSize: 10.5 }}>{l.r.it.vidro}</td>
              {/* nowrap + 13px estourava a largura do A4 nesta coluna. */}
              <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontFamily: 'var(--font-heading)', fontSize: 11 }}>
                {fn(l.r.L, 0)} × {fn(l.r.H, 0)}
              </td>
              <td className="tnum" style={{ textAlign: 'right' }}>{fn(l.r.qtd, 0)}</td>
              <td className="tnum" style={{ textAlign: 'right' }}>{fn(l.feito, 0)}</td>
              <td className="tnum" style={{ textAlign: 'right', fontWeight: 'bold' }}>{fn(l.falta, 0)}</td>
              <td className="tnum" style={{ textAlign: 'right' }}>{fn(l.r.im2, 2)}</td>
              <td className="tnum" style={{ textAlign: 'right' }}>{fn(l.r.ikg, 1)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr style={{ borderTop: '2px solid var(--color-text)' }}>
          <td colSpan={8} style={{ fontFamily: 'var(--font-heading)', fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase' }}>Total</td>
          <td className="tnum" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{fn(c.pecas, 0)}</td>
          <td className="tnum" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{fn(totSep, 0)}</td>
          <td className="tnum" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{fn(totFalta, 0)}</td>
          <td className="tnum" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{fn(c.m2, 2)}</td>
          <td className="tnum" style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: 14 }}>{fn(c.kg, 1)}</td>
        </tr></tfoot>
      </table>

      <MateriaisDoPedido orc={orc} compacto />

      <div style={{ paddingTop: 12 }}>
        <div style={{ ...rot, marginBottom: 4 }}>Ferragens e vedação</div>
        <table className="table fluida" style={{ fontSize: 11 }}>
          <tbody>
            {ferragens.map(f => (
              <tr key={f.a!.cod}>
                <td style={{ fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap', width: 70 }}>{f.a!.cod}</td>
                <td>{f.a!.nome}</td>
                <td style={{ width: 110, color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>{f.a!.fornecedor}</td>
                <td className="tnum" style={{ width: 80, textAlign: 'right', whiteSpace: 'nowrap' }}>{fn(f.qtd, 1)} {f.a!.unidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, paddingTop: 14 }}>
        <div>
          <div style={{ ...rot, marginBottom: 4 }}>Observações da produção</div>
          <div style={{ fontSize: 11, lineHeight: 1.55 }}>{sep.obs || '—'}</div>
          <div style={{ fontSize: 10, paddingTop: 6, color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>
            Início {sep.iniciado || '—'} · Conclusão {sep.concluido || '—'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, borderTop: '1px solid var(--color-text)', paddingTop: 5, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            Separado por {sep.responsavel}
          </div>
          <div style={{ flex: 1, borderTop: '1px solid var(--color-text)', paddingTop: 5, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            Conferido por
          </div>
        </div>
      </div>

      <div style={{ fontSize: 9, color: muted45, borderTop: '1px solid var(--color-divider)', marginTop: 12, paddingTop: 7 }}>
        Documento interno de produção — sem valores comerciais.
        Rua Quintino Bocaiúva, 1591 · Nova Americana · Americana/SP · 19 3406 5236
      </div>
    </div>
  )
}
