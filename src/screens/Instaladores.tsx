import { useMemo } from 'react'
import { chamar, ponte } from '../api'
import { fm, num } from '../format'
import { useApp } from '../store'
import { Campo, FichaHead, InputFicha, ListaFicha, Tag, Vazio, muted45 } from '../ui'
import { novoId, useCadastro } from './useCadastro'
import type { Instalador } from '../shared/types'

export function Instaladores() {
  const app = useApp()
  const { db } = app

  const vazio = (): Instalador => ({
    id: novoId('eq'), cod: '', nome: '', tipo: db.tiposEquipe[0] ?? 'Própria', doc: '',
    responsavel: '', fone: '', regiao: '',
    precoM2: db.config.moM2, diaria: db.config.moHora, equipe: 1, ativo: true, obs: ''
  })

  const cad = useCadastro(db.instaladores, vazio)
  const f = cad.form

  const lista = useMemo(() => {
    const t = cad.filtro.trim().toLowerCase()
    if (!t) return db.instaladores
    return db.instaladores.filter(x => [x.cod, x.nome, x.responsavel, x.regiao, x.tipo].join(' ').toLowerCase().includes(t))
  }, [db.instaladores, cad.filtro])

  const obras = f ? db.orcamentos.filter(o => o.instaladorId === f.id) : []
  const existe = f ? db.instaladores.some(x => x.id === f.id) : false

  const salvarCampo = (patch: Partial<Instalador>) => {
    if (!f) return
    void app.gravar(() => chamar(ponte().salvarInstalador({ ...f, ...patch })), 'Equipe atualizada')
    cad.alterar(patch)
  }

  return (
    <ListaFicha
      filtro={cad.filtro} onFiltro={cad.setFiltro}
      placeholder="Filtrar equipe, responsável ou região"
      resumo={`${lista.length} de ${db.instaladores.length} equipes`}
      rotuloNovo="+ nova equipe" onNovo={cad.criarNovo}
      lista={lista.map(x => (
        <div key={x.id} onClick={() => cad.selecionar(x)}
             className={'linha' + (f?.id === x.id ? ' sel' : '')} style={{ height: 48 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, width: 52, flex: 'none' }}>{x.cod}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="trunc" style={{ fontSize: 13, lineHeight: 1.2 }}>{x.nome}</div>
            <div className="trunc" style={{ fontSize: 11, letterSpacing: '.02em', color: 'color-mix(in srgb, var(--color-text) 42%, transparent)' }}>
              {x.tipo} · {x.regiao}
            </div>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div className="tnum" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{fm(x.precoM2)}</div>
            <Tag tipo={x.ativo ? 'accent' : 'neutral'}>{x.ativo ? 'Ativa' : 'Inativa'}</Tag>
          </div>
        </div>
      ))}
      ficha={f ? (
        <div className="card">
          <FichaHead titulo={existe ? `Equipe ${f.cod}` : 'Nova equipe'}>
            <Tag tipo={f.ativo ? 'accent' : 'neutral'}>{f.ativo ? 'Ativa' : 'Inativa'}</Tag>
            <div style={{ flex: 1 }} />
            {existe && (
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 6px' }}
                      onClick={() => salvarCampo({ ativo: !f.ativo })}>
                {f.ativo ? 'desativar' : 'ativar'}
              </button>
            )}
            {existe && !obras.length && (
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 6px' }}
                      onClick={() => void app.gravar(() => chamar(ponte().excluir('instaladores', f.id)), 'Equipe excluída').then(() => cad.setForm(null))}>
                excluir
              </button>
            )}
            <button className="btn btn-primary" style={{ minHeight: 24, padding: '2px 11px', fontSize: 13 }}
                    onClick={() => {
                      if (!f.cod.trim()) return app.say('Informe o código da equipe.')
                      void app.gravar(() => chamar(ponte().salvarInstalador(f)), `${f.cod} salva`)
                    }}>Salvar equipe</button>
          </FichaHead>

          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '11px 13px' }}>
            <Campo label="Código"><InputFicha valor={f.cod} onChange={v => cad.alterar({ cod: v.toUpperCase() })} /></Campo>
            <Campo label="Nome da equipe / empresa" span={3}><InputFicha valor={f.nome} onChange={v => cad.alterar({ nome: v })} /></Campo>
            <Campo label="Vínculo">
              <select className="input" style={{ minHeight: 28, fontSize: 13 }} value={f.tipo}
                      onChange={e => cad.alterar({ tipo: e.target.value })}>
                {db.tiposEquipe.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo label="CNPJ / CPF"><InputFicha valor={f.doc} onChange={v => cad.alterar({ doc: v })} /></Campo>
            <Campo label="Responsável"><InputFicha valor={f.responsavel} onChange={v => cad.alterar({ responsavel: v })} /></Campo>
            <Campo label="Telefone"><InputFicha valor={f.fone} onChange={v => cad.alterar({ fone: v })} /></Campo>
            <Campo label="Região de atendimento" span={2}><InputFicha valor={f.regiao} onChange={v => cad.alterar({ regiao: v })} /></Campo>
            <Campo label="Pessoas na equipe"><InputFicha numero valor={f.equipe} onChange={v => cad.alterar({ equipe: num(v) })} /></Campo>
            <Campo label="Custo por pessoa/dia">
              <div className="tnum" style={{ minHeight: 28, display: 'flex', alignItems: 'center', fontFamily: 'var(--font-heading)', fontSize: 16 }}>
                {fm(f.equipe ? f.diaria / f.equipe : 0)}
              </div>
            </Campo>
            <Campo label="Instalação R$ / m²"><InputFicha numero valor={f.precoM2} onChange={v => cad.alterar({ precoM2: num(v) })} /></Campo>
            <Campo label="Diária da equipe (R$)"><InputFicha numero valor={f.diaria} onChange={v => cad.alterar({ diaria: num(v) })} /></Campo>
            <Campo label="Observações" span={2}><InputFicha valor={f.obs} onChange={v => cad.alterar({ obs: v })} /></Campo>

            <div style={{ gridColumn: '1/-1', background: 'var(--color-surface)', padding: '9px 11px' }}>
              <div style={{ fontSize: 11, letterSpacing: '.02em', color: muted45 }}>Histórico de obras</div>
              <div style={{ fontSize: 13, paddingTop: 2 }}>
                {obras.length ? obras.map(o => `${o.numero} · ${o.obra}`).join(' — ') : 'Nenhuma obra vinculada.'}
              </div>
              {!!obras.length && (
                <div style={{ fontSize: 12, paddingTop: 5, color: 'var(--color-accent-800)' }}>
                  Equipe vinculada a {obras.length} proposta(s) — exclusão bloqueada. Desative se não for mais usar.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : <Vazio>Selecione uma equipe ou cadastre uma nova.</Vazio>}
    />
  )
}
