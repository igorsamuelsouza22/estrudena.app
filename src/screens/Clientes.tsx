import { useMemo, useRef, useState } from 'react'
import { chamar, ponte } from '../api'
import { useApp } from '../store'
import { Campo, FichaHead, InputFicha, ListaFicha, Vazio, muted45 } from '../ui'
import { novoId, useCadastro } from './useCadastro'
import type { Cliente } from '../shared/types'

/** Máscara 00.000.000/0000-00, aplicada enquanto se digita. */
function formatarCnpj(bruto: string): string {
  const c = bruto.replace(/\D/g, '').slice(0, 14)
  return c
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function Clientes() {
  const app = useApp()
  const { db } = app

  const vazio = (): Cliente => ({
    id: novoId('cli'), nome: '', razao: '', cnpj: '', endereco: '',
    cidade: '', contato: '', fone: '', email: ''
  })

  const cad = useCadastro(db.clientes, vazio)
  const f = cad.form
  const [avisoCnpj, setAvisoCnpj] = useState('')
  // Evita repetir a consulta a cada tecla depois que o número já está completo.
  const ultimoCnpj = useRef('')

  const lista = useMemo(() => {
    const t = cad.filtro.trim().toLowerCase()
    if (!t) return db.clientes
    return db.clientes.filter(c => [c.nome, c.razao, c.cidade, c.contato, c.cnpj].join(' ').toLowerCase().includes(t))
  }, [db.clientes, cad.filtro])

  const propostas = f ? db.orcamentos.filter(o => o.clienteId === f.id) : []
  const existe = f ? db.clientes.some(c => c.id === f.id) : false

  /**
   * Ao completar os 14 dígitos, busca os dados na Receita pela BrasilAPI e
   * preenche o restante da ficha. Depende de internet — sem ela, o aviso
   * explica e o cadastro segue à mão, como sempre foi.
   */
  const buscarPorCnpj = async (valor: string) => {
    const digitos = valor.replace(/\D/g, '')
    if (digitos.length !== 14 || digitos === ultimoCnpj.current) return
    ultimoCnpj.current = digitos
    setAvisoCnpj('Consultando a Receita…')
    try {
      const d = await chamar(ponte().consultarCnpj(digitos))
      cad.setForm(atual => atual && {
        ...atual,
        cnpj: d.cnpj,
        // Só preenche o que estiver vazio: nada do que o usuário digitou se perde.
        razao: atual.razao || d.razao,
        nome: atual.nome || d.nome,
        endereco: atual.endereco || d.endereco,
        cidade: atual.cidade || d.cidade,
        fone: atual.fone || d.fone,
        email: atual.email || d.email
      })
      setAvisoCnpj(`Dados de ${d.razao || 'empresa'} carregados.`)
    } catch (e) {
      setAvisoCnpj(e instanceof Error ? e.message : 'Não consegui consultar o CNPJ.')
    }
  }

  return (
    <ListaFicha
      filtro={cad.filtro} onFiltro={cad.setFiltro}
      placeholder="Filtrar cliente, cidade ou contato"
      resumo={`${lista.length} de ${db.clientes.length} clientes`}
      rotuloNovo="+ novo cliente" onNovo={cad.criarNovo}
      lista={lista.map(c => {
        const n = db.orcamentos.filter(o => o.clienteId === c.id).length
        return (
          <div key={c.id} onClick={() => cad.selecionar(c)}
               className={'linha' + (f?.id === c.id ? ' sel' : '')} style={{ height: 46 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="trunc" style={{ fontSize: 13, lineHeight: 1.2 }}>{c.nome}</div>
              <div className="trunc" style={{ fontSize: 11, letterSpacing: '.02em', color: 'color-mix(in srgb, var(--color-text) 42%, transparent)' }}>
                {c.cidade} · {c.contato}
              </div>
            </div>
            <span style={{ fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap', color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}>
              {n} proposta{n === 1 ? '' : 's'}
            </span>
          </div>
        )
      })}
      ficha={f ? (
        <div className="card">
          <FichaHead titulo={existe ? f.nome || 'Cliente' : 'Novo cliente'}>
            {existe && !propostas.length && (
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 6px' }}
                      onClick={() => void app.gravar(() => chamar(ponte().excluir('clientes', f.id)), 'Cliente excluído').then(() => cad.setForm(null))}>
                excluir
              </button>
            )}
            <button className="btn btn-primary" style={{ minHeight: 24, padding: '2px 11px', fontSize: 13 }}
                    onClick={() => {
                      if (!f.nome.trim()) return app.say('Informe o nome comercial.')
                      void app.gravar(() => chamar(ponte().salvarCliente(f)), 'Cliente salvo')
                    }}>Salvar cliente</button>
          </FichaHead>

          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '11px 13px' }}>
            <Campo label="CNPJ" nota={avisoCnpj}>
              <InputFicha
                valor={f.cnpj}
                onChange={v => {
                  const formatado = formatarCnpj(v)
                  cad.alterar({ cnpj: formatado })
                  void buscarPorCnpj(formatado)
                }}
                placeholder="00.000.000/0000-00"
              />
            </Campo>
            <Campo label="Razão social" span={3}><InputFicha valor={f.razao} onChange={v => cad.alterar({ razao: v })} /></Campo>
            <Campo label="Nome comercial" span={2}><InputFicha valor={f.nome} onChange={v => cad.alterar({ nome: v })} /></Campo>
            <Campo label="Endereço" span={2}><InputFicha valor={f.endereco} onChange={v => cad.alterar({ endereco: v })} /></Campo>
            <Campo label="Cidade / UF"><InputFicha valor={f.cidade} onChange={v => cad.alterar({ cidade: v })} /></Campo>
            <Campo label="Contato"><InputFicha valor={f.contato} onChange={v => cad.alterar({ contato: v })} /></Campo>
            <Campo label="Telefone"><InputFicha valor={f.fone} onChange={v => cad.alterar({ fone: v })} /></Campo>
            <Campo label="E-mail"><InputFicha valor={f.email} onChange={v => cad.alterar({ email: v })} /></Campo>

            <div style={{ gridColumn: '1/-1', background: 'var(--color-surface)', padding: '9px 11px' }}>
              <div style={{ fontSize: 11, letterSpacing: '.02em', color: muted45 }}>Histórico</div>
              <div style={{ fontSize: 13, paddingTop: 2 }}>
                {propostas.length
                  ? propostas.map(o => `${o.numero} ${o.rev} · ${o.status}`).join(' — ')
                  : 'Nenhuma proposta vinculada.'}
              </div>
              {!!propostas.length && (
                <div style={{ fontSize: 12, paddingTop: 5, color: 'var(--color-accent-800)' }}>
                  Exclusão bloqueada: há {propostas.length} proposta(s) vinculada(s) a este cliente.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : <Vazio>Selecione um cliente ou cadastre um novo.</Vazio>}
    />
  )
}
