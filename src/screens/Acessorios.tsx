import { useMemo } from 'react'
import { chamar, ponte } from '../api'
import { fm, num } from '../format'
import { useApp } from '../store'
import { Campo, FichaHead, InputFicha, ListaFicha, SelectComAdd, Vazio, muted45 } from '../ui'
import { novoId, useCadastro } from './useCadastro'
import type { Acessorio } from '../shared/types'

export function Acessorios() {
  const app = useApp()
  const { db } = app

  const vazio = (): Acessorio => ({
    id: novoId('aces'), cod: '', nome: '', grupo: db.acesGrupos[0] ?? '',
    fornecedor: db.fornecedores[0] ?? '', unidade: 'UN', preco: 0, ativo: true
  })

  const cad = useCadastro(db.acessorios, vazio)
  const f = cad.form

  const lista = useMemo(() => {
    const t = cad.filtro.trim().toLowerCase()
    if (!t) return db.acessorios
    return db.acessorios.filter(a => [a.cod, a.nome, a.grupo, a.fornecedor].join(' ').toLowerCase().includes(t))
  }, [db.acessorios, cad.filtro])

  const kitsQueUsam = f ? db.kits.filter(k => k.itens.some(i => i.acesId === f.id)) : []
  const itensQueUsam = f ? db.materiais.filter(m => m.aces.some(i => i.acesId === f.id)) : []
  const emUso = kitsQueUsam.length + itensQueUsam.length > 0
  const existe = f ? db.acessorios.some(a => a.id === f.id) : false

  return (
    <ListaFicha
      filtro={cad.filtro} onFiltro={cad.setFiltro}
      placeholder="Filtrar acessório, grupo ou fornecedor"
      resumo={`${lista.length} de ${db.acessorios.length} acessórios`}
      rotuloNovo="+ novo acessório" onNovo={cad.criarNovo}
      lista={lista.map(a => (
        <div key={a.id} onClick={() => cad.selecionar(a)}
             className={'linha' + (f?.id === a.id ? ' sel' : '')} style={{ height: 40 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, width: 56, flex: 'none' }}>{a.cod}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="trunc" style={{ fontSize: 13, lineHeight: 1.2 }}>{a.nome}</div>
            <div style={{ fontSize: 11, letterSpacing: '.02em', color: 'color-mix(in srgb, var(--color-text) 42%, transparent)' }}>
              {a.grupo} · {a.fornecedor}
            </div>
          </div>
          <span className="tnum" style={{ fontSize: 13, whiteSpace: 'nowrap', color: 'color-mix(in srgb, var(--color-text) 60%, transparent)' }}>
            {fm(a.preco)}
          </span>
        </div>
      ))}
      ficha={f ? (
        <div className="card">
          <FichaHead titulo={existe ? `Acessório ${f.cod}` : 'Novo acessório'}>
            {existe && !emUso && (
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 6px' }}
                      onClick={() => void app.gravar(() => chamar(ponte().excluir('acessorios', f.id)), 'Acessório excluído').then(() => cad.setForm(null))}>
                excluir
              </button>
            )}
            <button className="btn btn-primary" style={{ minHeight: 24, padding: '2px 11px', fontSize: 13 }}
                    onClick={() => {
                      if (!f.cod.trim()) return app.say('Informe o código do acessório.')
                      void app.gravar(() => chamar(ponte().salvarAcessorio(f)), `${f.cod} salvo`)
                    }}>Salvar acessório</button>
          </FichaHead>

          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '11px 13px' }}>
            <Campo label="Código"><InputFicha valor={f.cod} onChange={v => cad.alterar({ cod: v.toUpperCase() })} /></Campo>
            <Campo label="Nome do acessório" span={3}><InputFicha valor={f.nome} onChange={v => cad.alterar({ nome: v })} /></Campo>

            <Campo label="Grupo">
              <SelectComAdd
                style={{ minHeight: 28, fontSize: 13 }}
                valor={f.grupo} opcoes={db.acesGrupos.map(a => ({ id: a, label: a }))}
                onChange={v => cad.alterar({ grupo: v })}
                onAdicionar={v => chamar(ponte().listaAdd('acesGrupos', v)).then(app.recarregar)}
                rotuloAdd="+ adicionar…" placeholder="Novo grupo"
              />
            </Campo>
            <Campo label="Fornecedor">
              <SelectComAdd
                style={{ minHeight: 28, fontSize: 13 }}
                valor={f.fornecedor} opcoes={db.fornecedores.map(a => ({ id: a, label: a }))}
                onChange={v => cad.alterar({ fornecedor: v })}
                onAdicionar={v => chamar(ponte().listaAdd('fornecedores', v)).then(app.recarregar)}
                rotuloAdd="+ adicionar…" placeholder="Novo fornecedor"
              />
            </Campo>
            <Campo label="Cobrado por">
              <select className="input" style={{ minHeight: 28, fontSize: 13 }} value={f.unidade}
                      onChange={e => cad.alterar({ unidade: e.target.value as Acessorio['unidade'] })}>
                <option value="UN">Unidade</option>
                <option value="ML">Metro linear</option>
              </select>
            </Campo>
            <Campo label="Custo (R$)"><InputFicha numero valor={f.preco} onChange={v => cad.alterar({ preco: num(v) })} /></Campo>

            <div style={{ gridColumn: '1/-1', background: 'var(--color-surface)', padding: '9px 11px' }}>
              <div style={{ fontSize: 11, letterSpacing: '.02em', color: muted45 }}>Onde é usado</div>
              <div style={{ fontSize: 13, paddingTop: 2 }}>
                {emUso
                  ? [
                      kitsQueUsam.length ? `Kits: ${kitsQueUsam.map(k => k.cod).join(' · ')}` : '',
                      itensQueUsam.length ? `Itens: ${itensQueUsam.map(m => m.cod).join(' · ')}` : ''
                    ].filter(Boolean).join(' — ')
                  : 'Não usado em nenhum kit ou item — pode excluir.'}
              </div>
            </div>
          </div>
        </div>
      ) : <Vazio>Selecione um acessório ou cadastre um novo.</Vazio>}
    />
  )
}
