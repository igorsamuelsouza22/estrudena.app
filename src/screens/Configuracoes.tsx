import { useEffect, useState } from 'react'
import { chamar, ponte } from '../api'
import { fm, fn, num } from '../format'
import { useAcoes } from '../Shell'
import { useApp } from '../store'
import { Card, muted45 } from '../ui'
import { PublicarVersao } from './PublicarVersao'
import type { Config } from '../shared/types'

type CampoNum = Exclude<{
  [K in keyof Config]: Config[K] extends number ? K : never
}[keyof Config], undefined>

type CampoTxt = Exclude<{
  [K in keyof Config]: Config[K] extends string ? K : never
}[keyof Config], undefined>

// `maiuscula` acompanha o cadastro existente: séries, tipos e os textos que
// saem no documento do cliente são em caixa alta; grupos, acabamentos e
// fornecedores são escritos como nomes próprios.
// `padrao` liga a lista ao campo da configuração que guarda qual dos itens vem
// preenchido numa proposta nova. Antes esse valor era digitado à parte, em
// texto livre, e nada impedia que ele divergisse das opções cadastradas aqui.
const LISTAS: {
  titulo: string; categoria: string; ph: string; maiuscula: boolean; padrao?: CampoTxt
}[] = [
  { titulo: 'Séries / linhas', categoria: 'series', ph: 'Nova série', maiuscula: true },
  { titulo: 'Tipos de material', categoria: 'tipos', ph: 'Novo tipo', maiuscula: true },
  { titulo: 'Grupos de acessório', categoria: 'acesGrupos', ph: 'Novo grupo', maiuscula: false },
  { titulo: 'Condições de pagamento', categoria: 'condicoesPag', ph: 'Nova condição', maiuscula: true, padrao: 'condPag' },
  { titulo: 'Prazos de entrega', categoria: 'prazosEntrega', ph: 'Novo prazo', maiuscula: true, padrao: 'prazo' },
  { titulo: 'Acabamentos', categoria: 'acabamentos', ph: 'Novo acabamento', maiuscula: false },
  { titulo: 'Fornecedores', categoria: 'fornecedores', ph: 'Novo fornecedor', maiuscula: false }
]

export function Configuracoes() {
  const app = useApp()
  const { db } = app
  const [cfg, setCfg] = useState<Config>(() => structuredClone(db.config))
  const [novos, setNovos] = useState<Record<string, string>>({})

  // Recarrega o rascunho quando o banco muda por fora.
  useEffect(() => { setCfg(structuredClone(db.config)) }, [db.config])

  const soma = cfg.impMaterial + cfg.impIndust + cfg.impMo

  // Linha em branco no meio das observações é intenção de espaçamento; no fim
  // é só o Enter que sobrou de quem estava digitando, e viraria linha vazia no
  // PDF de toda proposta.
  const paraSalvar = (): Config => {
    const obs = [...cfg.observacoes]
    while (obs.length && !obs[obs.length - 1].trim()) obs.pop()
    return { ...cfg, observacoes: obs }
  }

  useAcoes(
    <button className="btn btn-primary" onClick={() => void app.gravar(() => chamar(ponte().salvarConfig(paraSalvar())), 'Configurações salvas')}>
      Salvar configurações
    </button>,
    [cfg]
  )

  const rowN = (label: string, campo: CampoNum) => ({
    label,
    valor: String(cfg[campo]),
    on: (v: string) => setCfg(c => ({ ...c, [campo]: num(v) })),
    largura: 96, align: 'right' as const
  })
  const rowT = (label: string, campo: CampoTxt) => ({
    label,
    valor: cfg[campo],
    on: (v: string) => setCfg(c => ({ ...c, [campo]: v })),
    largura: 240, align: 'left' as const
  })

  const paineis = [
    {
      titulo: 'Custo de matéria-prima', nota: 'base do cálculo',
      rows: [
        rowN('Alumínio — R$ / kg', 'precoKg'), rowN('Perda padrão (%)', 'perda'),
        rowN('Mão de obra — R$ / kg', 'moKg'), rowN('Instalação — R$ / m²', 'moM2'),
        rowN('Diária de equipe (R$)', 'moHora'), rowN('Deslocamento — R$ / km', 'moKm')
      ]
    },
    {
      titulo: 'Markup, imposto e comissão', nota: 'padrão de novas propostas',
      rows: [
        rowN('Markup padrão (%)', 'markup'), rowN('Imposto (%)', 'imposto'),
        rowN('Comissão 1 (%)', 'com1'), rowN('Comissão 2 (%)', 'com2')
      ]
    },
    {
      titulo: 'Rateio do imposto', nota: 'divisão na nota',
      rows: [
        rowN('Faturamento de material (%)', 'impMaterial'),
        rowN('Industrialização (%)', 'impIndust'),
        rowN('M.O. de instalação (%)', 'impMo')
      ],
      msg: soma === 100 ? 'Rateio fechado em 100%.' : `O rateio soma ${fn(soma, 0)}% — ajuste para 100%.`,
      msgCor: soma === 100 ? 'var(--color-accent-700)' : 'var(--color-accent-800)'
    },
    {
      // Só o que sai impresso igual em toda proposta. A condição de pagamento
      // e o prazo de entrega saíram daqui: eles mudam de proposta para
      // proposta, e o padrão agora se marca na própria lista de opções.
      titulo: 'Textos da proposta', nota: 'documento do cliente',
      rows: [rowN('Validade (dias)', 'validade')],
      extra: (
        <div style={{ paddingTop: 9 }}>
          <div style={{ fontSize: 13, paddingBottom: 5, color: 'color-mix(in srgb, var(--color-text) 78%, transparent)' }}>
            Observações — uma por linha
          </div>
          <textarea
            className="input" rows={6}
            style={{ width: '100%', minHeight: 0, padding: '5px 7px', fontSize: 13, lineHeight: 1.5, resize: 'vertical' }}
            value={cfg.observacoes.join('\n')}
            onChange={e => setCfg(c => ({ ...c, observacoes: e.target.value.split('\n') }))}
          />
        </div>
      )
    },
    {
      titulo: 'Dados da empresa', nota: 'cabeçalho do PDF',
      rows: [
        rowT('Nome', 'empresa'), rowT('Endereço', 'endereco'), rowT('Complemento', 'endereco2'),
        rowT('Telefone', 'fone'), rowT('E-mail', 'email'), rowT('Site', 'site')
      ]
    }
  ]

  // O 4º campo marca valor de texto: a coluna é desenhada para número grande,
  // e frase em caixa alta naquele corpo fica desproporcional.
  const globais: [string, string, string, boolean?][] = [
    ['Alumínio', `${fm(cfg.precoKg)} / kg`, 'custo de matéria-prima'],
    ['Markup padrão', `${fn(cfg.markup, 1)}%`, 'divide o custo para chegar à venda'],
    ['Imposto', `${fn(cfg.imposto, 1)}%`, 'embutido, não aparece ao cliente'],
    ['Comissões', `${fn(cfg.com1, 1)}% + ${fn(cfg.com2, 1)}%`, 'sobre o valor da proposta'],
    ['Perda de alumínio', `${fn(cfg.perda, 1)}%`, 'sobre a matéria-prima'],
    ['Mão de obra', `${fm(cfg.moKg)} / kg`, 'custo interno de produção'],
    ['Instalação', `${fm(cfg.moM2)} / m²`, 'valor cobrado do cliente'],
    ['Diária de equipe', fm(cfg.moHora), 'quando cobrado por diária'],
    ['Deslocamento', `${fm(cfg.moKm)} / km`, 'frete de equipe'],
    ['Rateio do imposto', `${fn(cfg.impMaterial, 0)}/${fn(cfg.impIndust, 0)}/${fn(cfg.impMo, 0)}`, 'material / industrialização / M.O.'],
    ['Validade da proposta', `${fn(cfg.validade, 0)} dias`, 'texto do documento'],
    ['Condição de pagamento', cfg.condPag || '—', 'marcada na lista de condições', true],
    ['Prazo de entrega', cfg.prazo || '—', 'marcado na lista de prazos', true],
    ['Cadastros', `${db.materiais.length} · ${db.acessorios.length} · ${db.kits.length} · ${db.kitsVenda.length} · ${db.cores.length}`,
      'itens · acessórios · kits ferragem · kits venda · cores']
  ]

  // As listas gerenciáveis são carregadas no DB com o mesmo nome da categoria.
  const valoresDaLista = (categoria: string): string[] =>
    (db as unknown as Record<string, string[]>)[categoria] ?? []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14, maxWidth: 1000, alignItems: 'start' }}>
      {paineis.map(p => (
        <Card key={p.titulo} titulo={p.titulo}
              direita={<span style={{ fontSize: 12, color: muted45 }}>{p.nota}</span>}>
          <div style={{ padding: '8px 11px 11px' }}>
            {p.rows.map(r => (
              <div key={r.label} style={{
                display: 'flex', alignItems: 'center', gap: 10, minHeight: 30, padding: '2px 0',
                borderBottom: '1px solid color-mix(in srgb, var(--color-text) 7%, transparent)'
              }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'color-mix(in srgb, var(--color-text) 78%, transparent)' }}>{r.label}</span>
                <input
                  className="input tnum"
                  style={{ width: r.largura, minHeight: 25, padding: '1px 7px', fontSize: 13, textAlign: r.align }}
                  value={r.valor} onChange={e => r.on(e.target.value)}
                />
              </div>
            ))}
            {'msg' in p && p.msg && (
              <div style={{ fontSize: 12, paddingTop: 8, color: p.msgCor }}>{p.msg}</div>
            )}
            {'extra' in p && p.extra}
          </div>
        </Card>
      ))}

      {LISTAS.map(l => {
        const itens = valoresDaLista(l.categoria)
        const padraoAtual = l.padrao ? cfg[l.padrao] : ''
        // Configuração antiga pode apontar para um texto que nunca esteve na
        // lista — era justamente o que o campo de texto livre permitia.
        const padraoOrfao = !!l.padrao && !!padraoAtual && !itens.includes(padraoAtual)
        return (
        <Card key={l.categoria} titulo={l.titulo}
              direita={l.padrao
                ? <span style={{ fontSize: 12, color: muted45 }}>● vem preenchido em proposta nova</span>
                : undefined}>
          <div style={{ padding: '10px 11px 11px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {itens.map(v => {
                const ehPadrao = !!l.padrao && padraoAtual === v
                return (
                <span key={v} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, background: '#fff',
                  borderRadius: 12, boxShadow: 'var(--el1)', overflow: 'hidden',
                  padding: l.padrao ? '2px 4px 2px 5px' : '2px 4px 2px 8px'
                }}>
                  {l.padrao && (
                    <button
                      className="btn btn-ghost"
                      title={ehPadrao ? 'É o padrão de propostas novas' : 'Usar como padrão em propostas novas'}
                      aria-pressed={ehPadrao}
                      style={{
                        border: 0, padding: '0 2px', fontSize: 12, lineHeight: 1, minHeight: 0,
                        color: ehPadrao ? 'var(--color-accent-700)' : muted45
                      }}
                      onClick={() => setCfg(c => ({ ...c, [l.padrao!]: v }))}
                    >{ehPadrao ? '●' : '○'}</button>
                  )}
                  {v}
                  <button
                    className="btn btn-ghost" title="Remover"
                    style={{ border: 0, padding: '0 3px', fontSize: 13, lineHeight: 1, minHeight: 0, color: muted45 }}
                    onClick={() => {
                      // Sai da lista o item que era o padrão: sem isto a
                      // configuração continuaria apontando para uma opção que
                      // não existe mais.
                      if (ehPadrao) {
                        const resto = itens.filter(x => x !== v)
                        setCfg(c => ({ ...c, [l.padrao!]: resto[0] ?? '' }))
                      }
                      void app.gravar(() => chamar(ponte().listaDel(l.categoria, v)), `"${v}" removido`)
                    }}
                  >✕</button>
                </span>
                )
              })}
            </div>
            {padraoOrfao && (
              <div style={{ fontSize: 12, color: 'var(--color-accent-800)' }}>
                O padrão atual é “{padraoAtual}”, que não está na lista. Marque um dos itens acima.
              </div>
            )}
            <div style={{ display: 'flex', gap: 7 }}>
              <input
                className="input" style={{ minHeight: 26, padding: '2px 7px', fontSize: 13 }}
                placeholder={l.ph} value={novos[l.categoria] ?? ''}
                onChange={e => setNovos(n => ({ ...n, [l.categoria]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              />
              <button
                className="btn btn-secondary" style={{ minHeight: 26, padding: '2px 10px', fontSize: 13 }}
                onClick={() => {
                  const bruto = (novos[l.categoria] ?? '').trim()
                  const v = l.maiuscula ? bruto.toUpperCase() : bruto
                  if (!v) return app.say('Escreva o valor antes de adicionar.')
                  void app.gravar(() => chamar(ponte().listaAdd(l.categoria, v)), `"${v}" cadastrado`)
                  setNovos(n => ({ ...n, [l.categoria]: '' }))
                }}
              >adicionar</button>
            </div>
          </div>
        </Card>
        )
      })}

      <div style={{ gridColumn: '1/-1' }}>
        <Card titulo="Parâmetros globais em uso"
              direita={<span style={{ fontSize: 12, color: muted45 }}>o que todo orçamento herda ao ser criado</span>}>
          <table className="table" style={{ fontSize: 13 }}>
            <tbody>
              {globais.map(([l, v, obs, texto]) => (
                <tr key={l}>
                  <td style={{ paddingLeft: 11, width: 210, fontSize: 11, letterSpacing: '.02em', color: muted45 }}>{l}</td>
                  <td className={texto ? undefined : 'tnum'} style={{
                    width: 190,
                    fontFamily: texto ? 'inherit' : 'var(--font-heading)',
                    fontSize: texto ? 13 : 16
                  }}>{v}</td>
                  <td style={{ paddingRight: 11, fontSize: 13, color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>{obs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <PublicarVersao />

      <div className="card" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15 }}>Banco de dados</div>
          <div style={{ fontSize: 13, color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>
            {db.materiais.length} itens · {db.acessorios.length} acessórios · {db.kits.length} kits de ferragem ·
            {' '}{db.kitsVenda.length} kits de venda · {db.cores.length} cores · {db.orcamentos.length} propostas —
            {' '}PostgreSQL no servidor
          </div>
        </div>
        <button
          className="btn btn-secondary" style={{ minHeight: 26, padding: '3px 10px', fontSize: 13 }}
          onClick={() => void chamar(ponte().exportarJson(JSON.stringify(db, null, 2), 'estrudena-dados.json'))
            .then(p => app.say(p ? 'JSON exportado' : 'Exportação cancelada'))}
        >Exportar JSON</button>
        <button
          className="btn btn-secondary" style={{ minHeight: 26, padding: '3px 10px', fontSize: 13 }}
          onClick={() => void app.gravar(() => chamar(ponte().restaurarExemplo()), 'Dados de exemplo carregados')}
        >Carregar dados de exemplo</button>
      </div>
    </div>
  )
}
