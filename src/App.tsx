import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { chamar, ponte } from './api'
import { Provider } from './store'
import { Shell } from './Shell'
import type { ConnState, DB, Usuario, VersaoPublicada } from './shared/types'

export function App() {
  const [conn, setConn] = useState<ConnState>({
    status: 'desconectado', host: '', porta: 5432, mensagem: '', modoServidor: false
  })
  const [etapa, setEtapa] = useState('')
  const [db, setDb] = useState<DB | null>(null)
  const [user, setUser] = useState<Usuario | null>(null)
  const iniciou = useRef(false)

  const recarregar = useCallback(async () => {
    setDb(await chamar(ponte().carregar()))
  }, [])

  const conectar = useCallback(async (host?: string) => {
    setEtapa('Procurando o servidor…')
    const st = await chamar(ponte().conectar(host))
    setConn(st)
    setEtapa('')
    if (st.status === 'conectado') await recarregar()
  }, [recarregar])

  useEffect(() => {
    if (iniciou.current) return
    iniciou.current = true
    const off = ponte().onProgresso(setEtapa)
    void conectar()
    return off
  }, [conectar])

  if (conn.status !== 'conectado' || !db) {
    return <TelaConexao conn={conn} etapa={etapa} onTentar={conectar} />
  }

  if (!user) {
    return <TelaLogin db={db} onEntrar={setUser} conn={conn} />
  }

  return (
    <Provider db={db} user={user} onRecarregar={recarregar} onSair={() => setUser(null)}>
      <Shell />
    </Provider>
  )
}

// ------------------------------------------------------------------ conexão

function TelaConexao(p: {
  conn: ConnState
  etapa: string
  onTentar: (host?: string) => Promise<void>
}) {
  const [host, setHost] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const procurando = p.conn.status === 'procurando' || p.conn.status === 'desconectado' || ocupado

  const tentar = async (h?: string) => {
    setOcupado(true)
    try { await p.onTentar(h) } finally { setOcupado(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      color: '#202124', background: '#f1f3f4'
    }}>
      <div style={{ width: 400, background: '#fff', borderRadius: 16, boxShadow: 'var(--el2)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '32px 32px 0' }}>
          <img src="assets/logo-estrudena.png" alt="Estrudena" style={{ height: 44, width: 'auto', alignSelf: 'flex-start' }} />
          <div style={{ fontSize: 22, paddingTop: 20 }}>Conectando ao servidor</div>
          <div style={{ fontSize: 14, color: '#5f6368' }}>Banco de dados da Estrudena na rede local</div>
        </div>

        <div style={{ padding: '20px 32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {procurando && (
            <div style={{ fontSize: 13, color: '#5f6368', background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
              {p.etapa || 'Procurando o servidor na rede…'}
            </div>
          )}

          {p.conn.status === 'erro' && (
            <>
              <div style={{ fontSize: 13, color: '#b3261e', background: '#fce8e6', borderRadius: 8, padding: '10px 12px' }}>
                {p.conn.mensagem}
              </div>
              <div className="field">
                <label>Endereço do servidor (opcional)</label>
                <input
                  className="input" style={{ fontSize: 14 }} placeholder="ex.: 192.168.0.10"
                  value={host} onChange={e => setHost(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void tentar(host.trim() || undefined) }}
                />
              </div>
            </>
          )}

          <button
            className="btn btn-primary btn-block" style={{ minHeight: 40 }}
            disabled={procurando}
            onClick={() => void tentar(host.trim() || undefined)}
          >
            {procurando ? 'Procurando…' : 'Procurar novamente'}
          </button>
        </div>

        <div style={{
          background: '#f8f9fa', borderTop: '1px solid var(--color-divider)',
          padding: '12px 32px', fontSize: 12, color: '#9aa0a6', lineHeight: 1.5
        }}>
          O sistema encontra o PC servidor sozinho. Se não achar, confirme que o
          computador com o banco está ligado e na mesma rede.
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------- login

function TelaLogin(p: { db: DB; conn: ConnState; onEntrar: (u: Usuario) => void }) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  // Fechada por padrão: quem usa o sistema todo dia já sabe o próprio usuário,
  // e a lista aberta empurrava o rodapé para fora da janela em telas menores.
  const [contasAbertas, setContasAbertas] = useState(false)

  const entrar = async () => {
    if (!usuario.trim()) return setErro('Informe o usuário.')
    if (!senha) return setErro('Informe a senha.')
    setOcupado(true)
    try {
      const r = await chamar(ponte().login(usuario, senha))
      if (!r.ok || !r.usuario) setErro(r.erro ?? 'Não foi possível entrar.')
      else p.onEntrar(r.usuario)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao falar com o banco.')
    } finally {
      setOcupado(false)
    }
  }

  const ativos = p.db.usuarios.filter(u => u.ativo)

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      color: '#202124', background: '#f1f3f4'
    }}>
      <div style={{ width: 400, background: '#fff', borderRadius: 16, boxShadow: 'var(--el2)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '32px 32px 0' }}>
          <img src="assets/logo-estrudena.png" alt="Estrudena" style={{ height: 44, width: 'auto', alignSelf: 'flex-start' }} />
          <div style={{ fontSize: 22, paddingTop: 20 }}>Entrar</div>
          <div style={{ fontSize: 14, color: '#5f6368' }}>Orçamento e separação de material</div>
        </div>

        <div style={{ padding: '20px 32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label>Usuário</label>
            <input
              className="input" style={{ fontSize: 14 }} type="text" autoComplete="username" autoFocus
              value={usuario} onChange={e => { setUsuario(e.target.value); setErro('') }}
            />
          </div>
          <div className="field">
            <label>Senha</label>
            <input
              className="input" style={{ fontSize: 14 }} type="password" autoComplete="current-password"
              value={senha} onChange={e => { setSenha(e.target.value); setErro('') }}
              onKeyDown={e => { if (e.key === 'Enter') void entrar() }}
            />
          </div>
          {erro && (
            <div style={{ fontSize: 13, color: '#b3261e', background: '#fce8e6', borderRadius: 8, padding: '10px 12px' }}>
              {erro}
            </div>
          )}
          <button
            className="btn btn-primary btn-block" style={{ minHeight: 40, marginTop: 4 }}
            disabled={ocupado} onClick={() => void entrar()}
          >
            {ocupado ? 'Entrando…' : 'Entrar'}
          </button>
        </div>

        <div style={{ background: '#f8f9fa', borderTop: '1px solid var(--color-divider)' }}>
          <button
            type="button"
            onClick={() => setContasAbertas(a => !a)}
            aria-expanded={contasAbertas}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '13px 32px', border: 0, background: 'none',
              font: 'inherit', fontSize: 12, color: '#5f6368', cursor: 'pointer', textAlign: 'left'
            }}
          >
            <span>Contas cadastradas <span style={{ color: '#9aa0a6' }}>({ativos.length})</span></span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
              style={{ transform: contasAbertas ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
            >
              <path d="M7 10l5 5 5-5" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {contasAbertas && ativos.map(u => (
            <div
              key={u.id}
              onClick={() => { setUsuario(u.usuario); setErro('') }}
              title="Preencher o usuário"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 32px',
                cursor: 'pointer', borderTop: '1px solid #ebedef'
              }}
            >
              <span style={{ fontSize: 13, width: 62, color: '#5f6368' }}>{u.usuario}</span>
              <span style={{ flex: 1, fontSize: 14 }}>{u.nome}</span>
              <span style={{ fontSize: 12, color: '#5f6368' }}>{u.perfil}</span>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 40,
            padding: '0 32px', borderTop: '1px solid var(--color-divider)', fontSize: 12, color: '#9aa0a6'
          }}>
            <span>{p.db.materiais.length} itens · {p.db.orcamentos.length} propostas</span>
            <span>servidor {p.conn.host}</span>
          </div>

          <VerificarAtualizacao />
        </div>
      </div>
    </div>
  )
}

/**
 * Conferência de versão a pedido, na tela de entrada.
 *
 * O aviso automático só aparece depois de entrar, e a atualização instala com
 * o sistema fechado — então a hora natural de resolver isso é antes de começar
 * o dia, não no meio de um orçamento. O clique ignora o intervalo de uma
 * consulta por hora da rede: quem apertou quer a resposta de agora.
 */
function VerificarAtualizacao() {
  type Fase = 'ocioso' | 'verificando' | 'atual' | 'nova' | 'baixando' | 'pronto' | 'erro'
  const [fase, setFase] = useState<Fase>('ocioso')
  const [recado, setRecado] = useState('')
  const [nova, setNova] = useState<VersaoPublicada | null>(null)
  const [pct, setPct] = useState(0)
  const [caminho, setCaminho] = useState('')

  useEffect(() => ponte().onProgressoDownload(p => {
    if (p.total > 0) setPct(Math.min(100, Math.round(p.recebido / p.total * 100)))
  }), [])

  const verificar = async () => {
    setFase('verificando')
    setRecado('')
    try {
      const e = await chamar(ponte().estadoAtualizacao(true))
      if (e.temNova && e.disponivel) {
        setNova(e.disponivel)
        setFase('nova')
      } else {
        setRecado(`Esta máquina já está na versão ${e.versaoLocal}, a mais recente.`)
        setFase('atual')
      }
    } catch (err) {
      setRecado(err instanceof Error ? err.message : 'Não consegui verificar agora.')
      setFase('erro')
    }
  }

  const baixar = async () => {
    if (!nova) return
    setFase('baixando')
    setPct(0)
    try {
      setCaminho(await chamar(ponte().baixarVersao(nova.versao, nova.url, nova.arquivo)))
      setFase('pronto')
    } catch (err) {
      setRecado(err instanceof Error ? err.message : 'Não consegui baixar a atualização.')
      setFase('erro')
    }
  }

  const instalar = async () => {
    try {
      await chamar(ponte().abrirInstalador(caminho))
    } catch (err) {
      setRecado(err instanceof Error ? err.message : 'Não consegui abrir o instalador.')
      setFase('erro')
    }
  }

  const link: CSSProperties = {
    border: 0, background: 'none', font: 'inherit', fontSize: 12, padding: 0,
    color: 'var(--color-accent-700)', cursor: 'pointer', textDecoration: 'underline'
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      minHeight: 38, padding: '0 32px', borderTop: '1px solid var(--color-divider)',
      fontSize: 12, color: '#5f6368'
    }}>
      {fase === 'nova' ? (
        <>
          <span className="trunc">Versão {nova!.versao} disponível</span>
          <button type="button" style={link} onClick={() => void baixar()}>baixar e instalar</button>
        </>
      ) : fase === 'baixando' ? (
        <span className="tnum">Baixando {pct}%…</span>
      ) : fase === 'pronto' ? (
        <>
          <span className="trunc">Baixado. O sistema fecha para instalar.</span>
          <button type="button" style={link} onClick={() => void instalar()}>instalar agora</button>
        </>
      ) : (
        <>
          <span className="trunc" style={{ color: fase === 'erro' ? '#b3261e' : '#5f6368' }}>{recado}</span>
          <button
            type="button" style={{ ...link, opacity: fase === 'verificando' ? 0.6 : 1 }}
            disabled={fase === 'verificando'} onClick={() => void verificar()}
          >
            {fase === 'verificando' ? 'verificando…' : 'verificar atualização'}
          </button>
        </>
      )}
    </div>
  )
}
