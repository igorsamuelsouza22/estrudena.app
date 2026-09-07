import { useMemo } from 'react'
import { chamar, ponte } from '../api'
import { ehMateriaPrima, unidadeLabel } from '../catalogo'
import { fm, num } from '../format'
import { useApp } from '../store'
import { Campo, FichaHead, InputFicha, ListaFicha, Secao, SelectComAdd, Vazio, muted50 } from '../ui'
import { novoId, useCadastro } from './useCadastro'
import type { Material } from '../shared/types'

export function MateriasPrimas() {
  const app = useApp()
  const { db, motor } = app
  const materiais = useMemo(() => db.materiais.filter(ehMateriaPrima), [db.materiais])
  const vazio = (): Material => ({
    id: novoId('mp'), cod: '', desc: '', categoria: 'materia_prima', composicao: [],
    tipo: '', serie: '—', unidade: 'KG', pesoUnit: 0, larg: null, alt: null,
    preco: 0, fc: 1, corId: '', kitId: '', aces: [], img: '', imgData: null,
    markup: 0, imposto: 0, comissao: 0, moM2: 0
  })
  const cad = useCadastro(materiais, vazio)
  const f = cad.form
  const lista = useMemo(() => materiais.filter(m =>
    [m.cod, m.desc, m.tipo].join(' ').toLowerCase().includes(cad.filtro.trim().toLowerCase())), [materiais, cad.filtro])
  const existe = !!f && materiais.some(m => m.id === f.id)
  const produtos = f ? db.materiais.filter(m => m.composicao?.some(it => it.materialId === f.id)) : []
  const emUso = !!f && (produtos.length > 0 || db.orcamentos.some(o => o.itens.some(it => it.matId === f.id))
    || db.kitsVenda.some(k => k.itens.some(it => it.matId === f.id)))

  const salvar = async () => {
    if (!f || !cad.validar()) return
    if (!f.cod.trim() || !f.desc.trim()) return app.say('Informe código e descrição da matéria-prima.')
    const salvo = await app.gravar(() => chamar(ponte().salvarMaterial(f)), `${f.cod} salvo`)
    if (salvo && f.categoria === 'produto') app.irPara('itens')
  }

  return <ListaFicha cad={cad} selecionado={app.registroId} largura={348} filtro={cad.filtro} onFiltro={cad.setFiltro}
    placeholder="Filtrar código, descrição ou grupo" resumo={`${lista.length} de ${materiais.length} matérias-primas`}
    rotuloNovo="+ nova matéria-prima" onNovo={cad.criarNovo}
    lista={lista.map(m => <div key={m.id} onClick={() => cad.selecionar(m)} tabIndex={0} role="button" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click() } }} className={'linha' + (f?.id === m.id ? ' sel' : '')}
      style={{ minHeight: 50, gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}><div className="trunc" style={{ fontSize: 13 }}>{m.desc}</div>
        <div style={{ color: muted50, fontSize: 11 }}>{m.cod} · {m.tipo || 'Sem grupo'}</div></div>
      <span className="tnum" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{fm(motor.custoMateriaPrima(m))}/{unidadeLabel(m.unidade)}</span>
    </div>)}
    ficha={f ? <div className="card">
      <FichaHead titulo={existe ? `Matéria-prima ${f.cod}` : 'Nova matéria-prima'}>
        {existe && !emUso && <button className="btn btn-ghost" hidden={!app.pode('excluir')} onClick={async () => {
          if (await app.gravar(() => chamar(ponte().excluir('materiais', f.id)), `${f.cod} excluído`)) cad.setForm(null)
        }}>excluir</button>}
        <button className="btn btn-primary" onClick={() => void salvar()}>Salvar matéria-prima</button>
      </FichaHead>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px 16px' }}>
        <div style={{ gridColumn: '1/-1', background: 'var(--color-surface)', borderLeft: '3px solid var(--color-accent)', padding: '10px 12px', fontSize: 13, lineHeight: 1.5 }}>
          Insumo usado na fabricação. Cadastre o custo de compra e utilize este material na composição dos produtos.
        </div>
        <Secao topo>Identificação</Secao>
        <Campo label="Código *" erro={!f.cod.trim() ? 'Informe o código.' : undefined}><InputFicha valor={f.cod} onChange={v => cad.alterar({ cod: v.toUpperCase() })} /></Campo>
        <Campo label="Descrição" span={3}><InputFicha valor={f.desc} onChange={v => cad.alterar({ desc: v })} /></Campo>
        <Campo label="Grupo de material" span={2}><SelectComAdd valor={f.tipo} opcoes={db.tipos.map(t => ({ id: t, label: t }))}
          onChange={v => cad.alterar({ tipo: v })} onAdicionar={v => chamar(ponte().listaAdd('tipos', v)).then(app.recarregar)}
          rotuloAdd="+ adicionar grupo…" placeholder="Nome do grupo" maiuscula /></Campo>
        <Campo label="Classificação" span={2}><select className="input" value={f.categoria}
          onChange={e => cad.alterar({ categoria: e.target.value as Material['categoria'] })}>
          <option value="materia_prima">Matéria-prima</option><option value="produto">Produto para orçamento</option>
        </select></Campo>
        <Secao>Compra e custo</Secao>
        <div style={{ gridColumn: '1/-1', fontSize: 12, color: muted50 }}>Última atualização: {f.atualizadoEm ? new Date(f.atualizadoEm).toLocaleString('pt-BR') : 'Ainda não salvo'}.</div>
        {f.preco <= 0 && <div className="notice warning" style={{ gridColumn: '1/-1' }}>Custo de compra não informado. Os produtos que usam este insumo podem ficar subavaliados.</div>}
        <Campo label="Unidade de compra"><select className="input" value={f.unidade}
          onChange={e => cad.alterar({ unidade: e.target.value as Material['unidade'] })}>
          <option value="KG">Quilo (kg)</option><option value="M2">Metro quadrado (m²)</option>
          <option value="ML">Metro linear (m)</option><option value="UN">Unidade (un)</option>
        </select></Campo>
        <Campo label={`Custo de compra (R$/${unidadeLabel(f.unidade)})`}>
          <InputFicha numero valor={f.preco} onChange={v => cad.alterar({ preco: num(v) })} />
        </Campo>
        <Campo label="Cor / acabamento" span={2}><select className="input" value={f.corId} onChange={e => cad.alterar({ corId: e.target.value })}>
          <option value="">Sem acréscimo de acabamento</option>
          {db.cores.map(c => <option key={c.id} value={c.id}>{c.cod} · {c.nome}</option>)}
        </select></Campo>
        {f.unidade !== 'KG' && <Campo label={`Peso (kg/${unidadeLabel(f.unidade)})`} span={2} nota="Usado no peso e no custo de fabricação do produto.">
          <InputFicha numero valor={f.pesoUnit} onChange={v => cad.alterar({ pesoUnit: num(v) })} />
        </Campo>}
        <div style={{ gridColumn: '1/-1', background: 'var(--color-surface)', padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div style={{ fontSize: 13 }}>Custo usado na composição</div>
            <div style={{ color: muted50, fontSize: 12 }}>Compra + acabamento, por {unidadeLabel(f.unidade)}</div></div>
          <strong className="tnum" style={{ fontSize: 24, fontFamily: 'var(--font-heading)' }}>{fm(motor.custoMateriaPrima(f))}</strong>
        </div>
        <Secao>Produtos que utilizam este material</Secao>
        {!!produtos.length && <p className="notice" style={{ gridColumn: '1/-1', margin: 0 }}>A alteração afeta o custo atual de {produtos.length} produtos. Propostas gravadas conservam seus valores; a atualização é aplicada explicitamente no rascunho.</p>}
        <div style={{ gridColumn: '1/-1', fontSize: 13, color: muted50 }}>
          {produtos.length ? produtos.map(p => <div key={p.id} style={{ padding: '6px 0' }}><button className="btn btn-ghost" onClick={() => app.irPara('itens', p.id)}><strong>{p.cod}</strong> · {p.desc}</button></div>)
            : 'Este material ainda não foi adicionado à composição de um produto.'}
        </div>
      </div>
    </div> : <Vazio>Cadastre uma matéria-prima para começar a compor os produtos.</Vazio>} />
}
