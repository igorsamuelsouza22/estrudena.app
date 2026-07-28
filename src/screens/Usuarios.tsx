import { useState } from 'react'
import { chamar, ponte } from '../api'
import { useApp } from '../store'
import { Campo, Card, InputFicha, Tag } from '../ui'
import { novoId } from './useCadastro'
import type { Perfil, Usuario } from '../shared/types'

const PERFIS: Perfil[] = ['Administrador', 'Vendedor', 'Produção']

const MATRIZ: [string, string][] = [
  ['Visão geral', 'AVP'], ['Orçamento', 'AV'], ['Propostas', 'AVP'], ['Clientes', 'AV'],
  ['Separação', 'AVP'], ['Itens e materiais', 'AV'], ['Custo e margem', 'AV'],
  ['Relatórios', 'A'], ['Usuários', 'A'], ['Configurações', 'A']
]

const RESUMO_PERMISSOES: Record<Perfil, string> = {
  Administrador: 'Tudo, inclusive custo, margem e configurações',
  Vendedor: 'Orçamentos, propostas, clientes e cadastros',
  Produção: 'Visão geral, propostas e separação — sem valores'
}

export function UsuariosTela() {
  const app = useApp()
  const { db } = app
  const [form, setForm] = useState<(Usuario & { senha: string }) | null>(null)

  const alternar = (u: Usuario) =>
    void app.gravar(
      () => chamar(ponte().salvarUsuario({ ...u, ativo: !u.ativo })),
      u.ativo ? `${u.nome} desativado` : `${u.nome} ativado`
    )

  const salvar = async () => {
    if (!form) return
    if (!form.nome.trim()) return app.say('Informe o nome.')
    if (!form.usuario.trim()) return app.say('Informe o login.')
    const novo = !db.usuarios.some(u => u.id === form.id)
    if (novo && form.senha.length < 4) return app.say('A senha precisa de pelo menos 4 caracteres.')
    const ok = await app.gravar(
      () => chamar(ponte().salvarUsuario({ ...form, senha: form.senha || undefined })),
      `${form.nome} salvo`
    )
    if (ok) setForm(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1060 }}>
      <Card
        titulo="Contas do sistema"
        direita={
          <button
            className="btn btn-secondary"
            style={{ minHeight: 22, padding: '1px 9px', fontSize: 13, background: 'var(--color-bg)' }}
            onClick={() => setForm({
              id: novoId('u'), nome: '', usuario: '', perfil: 'Vendedor', ativo: true, senha: ''
            })}
          >+ novo usuário</button>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 820, fontSize: 13 }}>
            <thead><tr>
              <th style={{ paddingLeft: 11 }}>Usuário</th><th>Login</th><th>Perfil</th>
              <th>Acesso concedido</th><th>Situação</th><th style={{ paddingRight: 11 }} />
            </tr></thead>
            <tbody>
              {db.usuarios.map(u => (
                <tr key={u.id}>
                  <td style={{ paddingLeft: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{
                        width: 24, height: 24, flex: 'none', display: 'grid', placeItems: 'center',
                        background: 'var(--color-accent-100)', color: 'var(--color-accent-800)',
                        fontFamily: 'var(--font-heading)', fontSize: 12
                      }}>{u.nome.split(' ').map(x => x[0]).slice(0, 2).join('')}</span>
                      <span>{u.nome}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-heading)', fontSize: 14 }}>{u.usuario}</td>
                  <td><Tag tipo={u.perfil === 'Administrador' ? 'accent' : 'accent-2'}>{u.perfil}</Tag></td>
                  <td style={{ fontSize: 12, color: 'color-mix(in srgb, var(--color-text) 60%, transparent)' }}>
                    {RESUMO_PERMISSOES[u.perfil]}
                  </td>
                  <td><Tag tipo={u.ativo ? 'accent' : 'neutral'}>{u.ativo ? 'Ativo' : 'Inativo'}</Tag></td>
                  <td style={{ paddingRight: 11, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost" style={{ fontSize: 13, padding: '1px 5px' }}
                            onClick={() => setForm({ ...u, senha: '' })}>editar</button>
                    <button className="btn btn-ghost" style={{ fontSize: 13, padding: '1px 5px' }}
                            disabled={u.id === app.user.id}
                            title={u.id === app.user.id ? 'Você não pode desativar a própria conta' : ''}
                            onClick={() => alternar(u)}>
                      {u.ativo ? 'desativar' : 'ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {form && (
        <Card titulo={db.usuarios.some(u => u.id === form.id) ? `Editar ${form.nome || 'usuário'}` : 'Novo usuário'}
              direita={
                <>
                  <button className="btn btn-ghost" style={{ fontSize: 13, padding: '2px 6px' }} onClick={() => setForm(null)}>cancelar</button>
                  <button className="btn btn-primary" style={{ minHeight: 24, padding: '2px 11px', fontSize: 13 }}
                          onClick={() => void salvar()}>Salvar usuário</button>
                </>
              }>
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '11px 13px' }}>
            <Campo label="Nome" span={2}><InputFicha valor={form.nome} onChange={v => setForm({ ...form, nome: v })} /></Campo>
            <Campo label="Login"><InputFicha valor={form.usuario} onChange={v => setForm({ ...form, usuario: v.toLowerCase().replace(/\s/g, '') })} /></Campo>
            <Campo label="Perfil">
              <select className="input" style={{ minHeight: 28, fontSize: 13 }} value={form.perfil}
                      onChange={e => setForm({ ...form, perfil: e.target.value as Perfil })}>
                {PERFIS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Campo>
            <Campo label="Senha" span={2}
                   nota={db.usuarios.some(u => u.id === form.id) ? 'Deixe em branco para manter a senha atual.' : 'Mínimo de 4 caracteres.'}>
              <input className="input" type="password" style={{ minHeight: 28, fontSize: 13 }}
                     value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} />
            </Campo>
          </div>
        </Card>
      )}

      <Card titulo="Matriz de permissões">
        <table className="table" style={{ fontSize: 13 }}>
          <thead><tr>
            <th style={{ paddingLeft: 11 }}>Tela</th>
            {PERFIS.map(p => <th key={p} style={{ textAlign: 'center' }}>{p}</th>)}
          </tr></thead>
          <tbody>
            {MATRIZ.map(([tela, roles]) => (
              <tr key={tela}>
                <td style={{ paddingLeft: 11 }}>{tela}</td>
                {['A', 'V', 'P'].map(k => (
                  <td key={k} style={{
                    textAlign: 'center', fontFamily: 'var(--font-heading)', fontSize: 14,
                    color: roles.includes(k) ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-text) 28%, transparent)'
                  }}>{roles.includes(k) ? '●' : '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
