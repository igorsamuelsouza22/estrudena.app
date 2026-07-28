import { useMemo } from 'react'
import { chamar, ponte } from '../api'
import { fm, num } from '../format'
import { useApp } from '../store'
import { Campo, FichaHead, InputFicha, ListaFicha, SelectComAdd, Vazio, muted45 } from '../ui'
import { novoId, useCadastro } from './useCadastro'
import type { Cor } from '../shared/types'

export function Cores() {
  const app = useApp()
  const { db } = app

  const vazio = (): Cor => ({
    id: novoId('cor'), cod: '', nome: '', acabamento: db.acabamentos[0] ?? '',
    fornecedor: db.fornecedores[0] ?? '', precoKg: 0, precoM2: 0, ativo: true
  })

  const cad = useCadastro(db.cores, vazio)
  const f = cad.form

  const lista = useMemo(() => {
    const t = cad.filtro.trim().toLowerCase()
    if (!t) return db.cores
    return db.cores.filter(c => [c.cod, c.nome, c.acabamento, c.fornecedor].join(' ').toLowerCase().includes(t))
  }, [db.cores, cad.filtro])

  const usos = f ? db.materiais.filter(m => m.corId === f.id) : []
  const existe = f ? db.cores.some(c => c.id === f.id) : false

  return (
    <ListaFicha
      filtro={cad.filtro} onFiltro={cad.setFiltro}
      placeholder="Filtrar cor, acabamento ou fornecedor"
      resumo={`${lista.length} de ${db.cores.length} cores`}
      rotuloNovo="+ nova cor" onNovo={cad.criarNovo}
      lista={lista.map(c => (
        <div key={c.id} onClick={() => cad.selecionar(c)}
             className={'linha' + (f?.id === c.id ? ' sel' : '')} style={{ height: 40 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, width: 64, flex: 'none' }}>{c.cod}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="trunc" style={{ fontSize: 13, lineHeight: 1.2 }}>{c.nome}</div>
            <div style={{ fontSize: 11, letterSpacing: '.02em', color: 'color-mix(in srgb, var(--color-text) 42%, transparent)' }}>
              {c.acabamento} · {c.fornecedor}
            </div>
          </div>
          <span className="tnum" style={{ fontSize: 13, whiteSpace: 'nowrap', color: 'color-mix(in srgb, var(--color-text) 60%, transparent)' }}>
            {fm(c.precoKg)}
          </span>
        </div>
      ))}
      ficha={f ? (
        <div className="card">
          <FichaHead titulo={existe ? `Cor ${f.cod}` : 'Nova cor'}>
            {existe && !usos.length && (
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 6px' }}
                      onClick={() => void app.gravar(() => chamar(ponte().excluir('cores', f.id)), 'Cor excluída').then(() => cad.setForm(null))}>
                excluir
              </button>
            )}
            <button className="btn btn-primary" style={{ minHeight: 24, padding: '2px 11px', fontSize: 13 }}
                    onClick={() => {
                      if (!f.cod.trim()) return app.say('Informe o código da cor.')
                      void app.gravar(() => chamar(ponte().salvarCor(f)), `${f.cod} salva`)
                    }}>Salvar cor</button>
          </FichaHead>

          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '11px 13px' }}>
            <Campo label="Código"><InputFicha valor={f.cod} onChange={v => cad.alterar({ cod: v.toUpperCase() })} /></Campo>
            <Campo label="Nome da cor" span={3}><InputFicha valor={f.nome} onChange={v => cad.alterar({ nome: v })} /></Campo>

            <Campo label="Acabamento">
              <SelectComAdd
                style={{ minHeight: 28, fontSize: 13 }}
                valor={f.acabamento} opcoes={db.acabamentos.map(a => ({ id: a, label: a }))}
                onChange={v => cad.alterar({ acabamento: v })}
                onAdicionar={v => chamar(ponte().listaAdd('acabamentos', v)).then(app.recarregar)}
                rotuloAdd="+ adicionar…" placeholder="Novo acabamento"
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
            <Campo label="Acréscimo por kg (R$)"><InputFicha numero valor={f.precoKg} onChange={v => cad.alterar({ precoKg: num(v) })} /></Campo>
            <Campo label="Acréscimo por m² (R$)"><InputFicha numero valor={f.precoM2} onChange={v => cad.alterar({ precoM2: num(v) })} /></Campo>

            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 24, background: 'var(--color-surface)', padding: '9px 11px' }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: '.02em', color: muted45 }}>Custo do kg com esta cor</div>
                <div className="tnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>{fm(db.config.precoKg + f.precoKg)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, letterSpacing: '.02em', color: muted45 }}>Itens que usam</div>
                <div style={{ fontSize: 13, paddingTop: 2 }}>
                  {usos.length ? usos.map(m => m.cod).join(' · ') : 'Nenhum item vinculado — pode excluir.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : <Vazio>Selecione uma cor ou cadastre uma nova.</Vazio>}
    />
  )
}
