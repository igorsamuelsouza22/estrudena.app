import { nomeProposta } from '../shared/types'
import { fm, fn } from '../format'
import { useApp } from '../store'
import type { Orcamento } from '../shared/types'

/**
 * Proposta comercial em A4 — réplica do PDF que a empresa já emite.
 * Deliberadamente fora do sistema Material: Arial, preto sobre branco,
 * bordas de 1px.
 */
export function FolhaProposta({ orc }: { orc: Orcamento }) {
  const { db, motor } = useApp()
  const c = motor.calc(orc)
  const cfg = orc.referenciaPrecos?.config ?? db.config
  const cliente = db.pedidos?.find(p=>p.orcamentoId===orc.id)?.cliente ?? db.clientes.find(x => x.id === orc.clienteId)
  const b = '1px solid #000'
  const td = { border: b, padding: '3px 5px' } as const
  const tdb = { ...td, fontWeight: 'bold' as const }

  return (
    <div
      className="printdoc printonly"
      style={{
        background: '#fff', border: '1px solid var(--color-divider)', width: 794,
        maxWidth: '100%', padding: '22px 26px', fontSize: 11
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, paddingBottom: 8, borderBottom: '2px solid #000' }}>
        <img src="assets/logo-estrudena.png" alt="Estrudena" style={{ width: 96, height: 'auto', flex: 'none' }} />
        <div style={{ flex: 1, textAlign: 'right', lineHeight: 1.45, fontSize: 10.5 }}>
          <div>{cfg.endereco}</div>
          <div>{cfg.endereco2}</div>
          <div>{cfg.fone}</div>
          <div>{cfg.email}</div>
          <div>{cfg.site}</div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 4 }}>
        <tbody>
          <tr>
            <td style={{ ...tdb, width: 78 }}>PROPOSTA</td>
            <td style={tdb}>{nomeProposta(orc)}</td>
            <td style={{ ...tdb, width: 70 }}>Data :</td>
            <td style={{ ...td, width: 96 }}>{orc.data}</td>
          </tr>
          <tr>
            <td style={tdb}>OPÇÃO A</td>
            <td style={td} />
            <td style={tdb}>{orc.rev} :</td>
            <td style={td}>{orc.data}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 6 }}>
        <tbody>
          <tr>
            <td style={{ ...tdb, width: 74 }}>Cliente</td>
            <td style={tdb}>{cliente?.nome ?? '—'}</td>
            <td style={{ ...tdb, width: 62 }}>e-mail</td>
            <td style={{ ...td, width: 190 }}>{cliente?.email ?? ''}</td>
          </tr>
          <tr>
            <td style={tdb}>Endereço</td>
            <td style={td}>{cliente?.endereco ?? ''}</td>
            <td style={tdb}>Fone</td>
            <td style={td}>{cliente?.fone ?? ''}</td>
          </tr>
          <tr>
            <td style={tdb}>Cidade</td>
            <td style={td}>{cliente?.cidade ?? ''}</td>
            <td colSpan={2} rowSpan={2} style={{ ...td, verticalAlign: 'top', fontSize: 10, lineHeight: 1.4 }}>
              <div style={{ fontWeight: 'bold' }}>DADOS PARA FATURAMENTO</div>
              <div>{cliente?.razao ?? ''}</div>
              <div>CNPJ/MF: {cliente?.cnpj ?? ''}</div>
            </td>
          </tr>
          <tr>
            <td style={tdb}>Contato</td>
            <td style={td}>{orc.contato}</td>
          </tr>
          <tr>
            <td style={tdb}>Obra</td>
            <td style={tdb}>{orc.obra}</td>
            <td colSpan={2} rowSpan={2} style={{ ...td, verticalAlign: 'top', fontSize: 10, lineHeight: 1.4 }}>
              <div>ENDEREÇO DE COBRANÇA: {cliente?.endereco ?? ''}</div>
              <div>CIDADE: {cliente?.cidade ?? ''}</div>
            </td>
          </tr>
          <tr>
            <td style={tdb}>Endereço</td>
            <td style={td}>{cliente?.endereco ?? ''}</td>
          </tr>
          <tr>
            <td style={tdb}>Cidade</td>
            <td colSpan={3} style={td}>{orc.cidade}</td>
          </tr>
        </tbody>
      </table>

      {c.rows.map(r => {
        const m = r.m
        const cor = db.cores.find(x => x.id === m?.corId)
        const kit = db.kits.find(k => k.id === m?.kitId)
        // Fornecedores únicos do kit, unidos por " / " — padrão do PDF original.
        const fornecedores = [...new Set(
          (kit?.itens ?? [])
            .map(i => db.acessorios.find(a => a.id === i.acesId)?.fornecedor)
            .filter((x): x is string => !!x)
        )].map(x => x.toUpperCase()).join(' / ')
        const img = m?.imgData || (m?.img ? `assets/${m.img}.png` : '')

        return (
          <table
            key={r.i}
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 8, pageBreakInside: 'avoid', breakInside: 'avoid' }}
          >
            <tbody>
              <tr>
                <td rowSpan={7} style={{ ...td, padding: 4, width: 104, textAlign: 'center', verticalAlign: 'middle' }}>
                  {/* Tag <img> e não background-image: o Chromium não busca
                      imagem de fundo dentro de subárvore display:none, e esta
                      folha fica oculta na tela — o desenho sairia em branco no
                      PDF. Elemento <img> carrega mesmo oculto. */}
                  {img && (
                    <img
                      src={img} alt=""
                      style={{ width: 94, height: 118, objectFit: 'contain', display: 'block', margin: '0 auto' }}
                    />
                  )}
                </td>
                <td style={{ ...tdb, width: 22, textAlign: 'center' }}>{r.i + 1}</td>
                <td style={{ ...tdb, width: 44 }}>Local</td>
                <td style={{ ...tdb, width: 70 }}>{m?.cod ?? '—'}</td>
                <td style={td}>{r.it.local}</td>
                <td style={{ ...tdb, width: 40 }}>Série</td>
                <td style={{ ...tdb, width: 104 }}>{r.it.serie ?? m?.serie ?? '—'}</td>
              </tr>
              <tr>
                <td colSpan={2} style={tdb}>Descrição</td>
                <td colSpan={3} style={td}>{r.it.desc ?? m?.desc ?? ''}</td>
                <td style={tdb}>Qtdade</td>
                <td style={{ ...td, textAlign: 'right' }}>{fn(r.qtd, 0)}</td>
              </tr>
              <tr>
                <td colSpan={2} style={td} />
                <td colSpan={3} style={td}>{r.it.detalhe ?? ''}</td>
                <td style={tdb}>Largura (mm)</td>
                <td style={{ ...td, textAlign: 'right' }}>{fn(r.L, 0)}</td>
              </tr>
              <tr>
                <td colSpan={2} style={tdb}>Perfil</td>
                <td colSpan={3} style={td}>{(cor?.nome ?? r.it.perfil ?? '—').toUpperCase()}</td>
                <td style={tdb}>Altura (mm)</td>
                <td style={{ ...td, textAlign: 'right' }}>{fn(r.H, 0)}</td>
              </tr>
              <tr>
                <td colSpan={2} style={tdb}>Acessórios</td>
                <td colSpan={3} style={{ ...td, fontSize: 10 }}>{fornecedores}</td>
                <td style={tdb}>total m2</td>
                <td style={{ ...td, textAlign: 'right' }}>{fn(r.im2, 2)}</td>
              </tr>
              <tr>
                <td colSpan={2} style={tdb}>Vidro</td>
                <td colSpan={3} style={td}>{r.it.vidro}</td>
                <td style={tdb}>Unitário</td>
                <td style={{ ...td, textAlign: 'right' }}>{fm(r.unit)}</td>
              </tr>
              <tr>
                <td colSpan={5} style={td} />
                <td style={tdb}>Total</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>{fm(r.venda)}</td>
              </tr>
            </tbody>
          </table>
        )
      })}

      {!c.rows.length && (
        <div style={{ padding: '30px 6px', textAlign: 'center', fontSize: 12, color: '#666' }}>
          Este orçamento ainda não tem itens.
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 10, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <tbody>
          <tr>
            <td style={{ ...tdb, width: 150 }}>Validade :</td>
            <td style={td}>{cfg.validade} DIAS</td>
          </tr>
          <tr>
            <td style={tdb}>Cond. De Pagamento :</td>
            <td style={td}>{orc.condPag}</td>
          </tr>
          <tr>
            <td style={tdb}>Prazo de entrega:</td>
            <td style={td}>{orc.prazo}</td>
          </tr>
          <tr>
            <td style={{ ...tdb, verticalAlign: 'top' }}>Observações :</td>
            <td style={{ ...td, lineHeight: 1.55 }}>
              {cfg.observacoes.map((o, i) => <div key={i}>{o}</div>)}
            </td>
          </tr>
          <tr>
            <td style={{ ...tdb, padding: 5, fontSize: 12 }}>VALOR FINAL PROPOSTA</td>
            <td style={{ ...td, padding: 5, fontWeight: 'bold', fontSize: 14, textAlign: 'right' }}>{fm(c.total)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#444', paddingTop: 10 }}>
        <span>{cfg.empresa} — {cfg.site}</span>
        <span>Depto de Vendas</span>
      </div>
    </div>
  )
}
