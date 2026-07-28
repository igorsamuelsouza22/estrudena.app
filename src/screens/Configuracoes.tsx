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
const LISTAS: { titulo: string; categoria: string; ph: string; maiuscula: boolean }[] = [
  { titulo: 'Séries / linhas', categoria: 'series', ph: 'Nova série', maiuscula: true },
  { titulo: 'Tipos de material', categoria: 'tipos', ph: 'Novo tipo', maiuscula: true },
  { titulo: 'Grupos de acessório', categoria: 'acesGrupos', ph: 'Novo grupo', maiuscula: false },
  { titulo: 'Condições de pagamento', categoria: 'condicoesPag', ph: 'Nova condição', maiuscula: true },
  { titulo: 'Prazos de entrega', categoria: 'prazosEntrega', ph: 'Novo prazo', maiuscula: true },
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

  useAcoes(
    <button className="btn btn-primary" onClick={() => void app.gravar(() => chamar(ponte().salvarConfig(cfg)), 'Configurações salvas')}>
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
      titulo: 'Textos da proposta', nota: 'documento do cliente',
      rows: [
        rowN('Validade (dias)', 'validade'),
        rowT('Condição de pagamento', 'condPag'),
        rowT('Prazo de entrega', 'prazo')
      ]
    },
    {
      titulo: 'Dados da empresa', nota: 'cabeçalho do PDF',
      rows: [
        rowT('Nome', 'empresa'), rowT('Endereço', 'endereco'), rowT('Complemento', 'endereco2'),
        rowT('Telefone', 'fone'), rowT('E-mail', 'email'), rowT('Site', 'site')
      ]
    }
  ]

  const globais: [string, string, string][] = [
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
          </div>
        </Card>
      ))}

      {LISTAS.map(l => (
        <Card key={l.categoria} titulo={l.titulo}>
          <div style={{ padding: '10px 11px 11px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {valoresDaLista(l.categoria).map(v => (
                <span key={v} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, background: '#fff',
                  borderRadius: 12, boxShadow: 'var(--el1)', overflow: 'hidden', padding: '2px 4px 2px 8px'
                }}>
                  {v}
                  <button
                    className="btn btn-ghost" title="Remover"
                    style={{ border: 0, padding: '0 3px', fontSize: 13, lineHeight: 1, minHeight: 0, color: muted45 }}
                    onClick={() => void app.gravar(() => chamar(ponte().listaDel(l.categoria, v)), `"${v}" removido`)}
                  >✕</button>
                </span>
              ))}
            </div>
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
      ))}

      <div style={{ gridColumn: '1/-1' }}>
        <Card titulo="Parâmetros globais em uso"
              direita={<span style={{ fontSize: 12, color: muted45 }}>o que todo orçamento herda ao ser criado</span>}>
          <table className="table" style={{ fontSize: 13 }}>
            <tbody>
              {globais.map(([l, v, obs]) => (
                <tr key={l}>
                  <td style={{ paddingLeft: 11, width: 210, fontSize: 11, letterSpacing: '.02em', color: muted45 }}>{l}</td>
                  <td className="tnum" style={{ width: 190, fontFamily: 'var(--font-heading)', fontSize: 16 }}>{v}</td>
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
