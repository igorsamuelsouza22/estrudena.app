import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Ico } from './icons'
import { useApp, type Tela } from './store'
import type { Perfil } from './shared/types'

import { AvisoAtualizacao } from './AvisoAtualizacao'
import { AreaImpressao } from './documentos/AreaImpressao'
import { Dashboard } from './screens/Dashboard'
import { Orcamento } from './screens/Orcamento'
import { Propostas } from './screens/Propostas'
import { Separacao } from './screens/Separacao'
import { Itens } from './screens/Itens'
import { Cores } from './screens/Cores'
import { Acessorios } from './screens/Acessorios'
import { Kits } from './screens/Kits'
import { KitsVenda } from './screens/KitsVenda'
import { Instaladores } from './screens/Instaladores'
import { Clientes } from './screens/Clientes'
import { Relatorios } from './screens/Relatorios'
import { UsuariosTela } from './screens/Usuarios'
import { Configuracoes } from './screens/Configuracoes'

// Ações do cabeçalho: cada tela publica as suas.
const AcoesCtx = createContext<(n: ReactNode) => void>(() => {})

export function useAcoes(nodo: ReactNode, deps: unknown[]): void {
  const set = useContext(AcoesCtx)
  useEffect(() => {
    set(nodo)
    return () => set(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

interface ItemNav { k: Tela; label: string; icone: ReactNode; roles: string; badge?: number }

const TITULOS: Record<Tela, [string, string]> = {
  dashboard: ['Painel', 'Visão geral'],
  novo: ['Comercial', 'Orçamento'],
  lista: ['Comercial', 'Propostas'],
  separacao: ['Produção', 'Separação de material'],
  itens: ['Cadastros', 'Itens e materiais'],
  clientes: ['Cadastros', 'Clientes'],
  cores: ['Cadastros', 'Cores e pintura'],
  acessorios: ['Cadastros', 'Acessórios'],
  kits: ['Cadastros', 'Kits de ferragem'],
  kitsvenda: ['Cadastros', 'Kits de venda'],
  instaladores: ['Cadastros', 'Instaladores e equipes'],
  relatorios: ['Gestão', 'Relatórios'],
  usuarios: ['Administração', 'Usuários'],
  config: ['Administração', 'Configurações']
}

const codigoDoPerfil = (p: Perfil): string =>
  p === 'Administrador' ? 'A' : p === 'Vendedor' ? 'V' : 'P'

export function Shell() {
  const app = useApp()
  const [acoes, setAcoes] = useState<ReactNode>(null)

  const grupos = useMemo(() => {
    const abertos = app.db.orcamentos.filter(o => o.status === 'Rascunho' || o.status === 'Em análise').length
    const aprov = app.db.orcamentos.filter(o => o.status === 'Aprovado').length
    const defs: { label: string; items: ItemNav[] }[] = [
      { label: 'Painel', items: [{ k: 'dashboard', label: 'Visão geral', icone: Ico.dash(), roles: 'AVP' }] },
      { label: 'Comercial', items: [
        { k: 'novo', label: 'Orçamento', icone: Ico.novo(), roles: 'AV' },
        { k: 'lista', label: 'Propostas', icone: Ico.lista(), roles: 'AVP', badge: abertos },
        { k: 'clientes', label: 'Clientes', icone: Ico.cli(), roles: 'AV' }
      ] },
      { label: 'Produção', items: [
        { k: 'separacao', label: 'Separação', icone: Ico.sep(), roles: 'AVP', badge: aprov }
      ] },
      { label: 'Cadastros', items: [
        { k: 'itens', label: 'Itens e materiais', icone: Ico.itens(), roles: 'AV' },
        { k: 'cores', label: 'Cores e pintura', icone: Ico.cor(), roles: 'AV' },
        { k: 'acessorios', label: 'Acessórios', icone: Ico.aces(), roles: 'AV' },
        { k: 'kits', label: 'Kits de ferragem', icone: Ico.kit(), roles: 'AV' },
        { k: 'kitsvenda', label: 'Kits de venda', icone: Ico.kv(), roles: 'AV' },
        { k: 'instaladores', label: 'Instaladores', icone: Ico.inst(), roles: 'AV' },
        { k: 'relatorios', label: 'Relatórios', icone: Ico.rel(), roles: 'A' },
        { k: 'usuarios', label: 'Usuários', icone: Ico.users(), roles: 'A' },
        { k: 'config', label: 'Configurações', icone: Ico.cfg(), roles: 'A' }
      ] }
    ]
    const cod = codigoDoPerfil(app.perfil)
    return defs
      .map(g => ({ label: g.label, items: g.items.filter(i => i.roles.includes(cod)) }))
      .filter(g => g.items.length)
  }, [app.db.orcamentos, app.perfil])

  // Perfil sem acesso à tela atual volta para a visão geral.
  const permitidas = useMemo(() => new Set(grupos.flatMap(g => g.items.map(i => i.k))), [grupos])
  useEffect(() => {
    if (!permitidas.has(app.tela)) app.irPara('dashboard')
  }, [permitidas, app])

  const [crumb, titulo] = TITULOS[app.tela]
  const iniciais = app.user.nome.split(' ').map(x => x[0]).slice(0, 2).join('')

  return (
    <AcoesCtx.Provider value={setAcoes}>
      <div className="appshell" style={{
        height: '100vh', display: 'flex', fontFamily: 'var(--font-body)',
        color: 'var(--color-text)', background: 'var(--color-bg)', overflow: 'hidden'
      }}>
        <aside className="noprint" style={{
          width: 236, flex: 'none', background: '#fff',
          borderRight: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column'
        }}>
          <div style={{
            height: 64, flex: 'none', display: 'flex', alignItems: 'center', padding: '0 18px',
            borderBottom: '1px solid var(--color-divider)'
          }}>
            <img src="assets/logo-estrudena.png" alt="Estrudena" style={{ height: 30, width: 'auto' }} />
          </div>

          <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 0 10px' }}>
            {grupos.map(g => (
              <div key={g.label} style={{ padding: '8px 0 2px' }}>
                <div style={{
                  fontSize: 11, fontWeight: 500, letterSpacing: '.06em',
                  color: '#9aa0a6', padding: '0 22px 6px'
                }}>{g.label}</div>
                {g.items.map(n => (
                  <button
                    key={n.k}
                    className={'navbtn' + (app.tela === n.k ? ' on' : '')}
                    style={{ width: 'calc(100% - 16px)', margin: '1px 8px', padding: '9px 14px', borderRadius: 20 }}
                    onClick={() => app.irPara(n.k)}
                  >
                    <span style={{ width: 18, height: 18, flex: 'none', display: 'block' }}>{n.icone}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{n.label}</span>
                    {!!n.badge && <span className="tnum" style={{ fontSize: 12, opacity: .6 }}>{n.badge}</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div style={{
            flex: 'none', borderTop: '1px solid var(--color-divider)', display: 'flex',
            alignItems: 'center', gap: 12, height: 60, padding: '0 16px', background: '#fff'
          }}>
            <span style={{
              width: 32, height: 32, flex: 'none', display: 'grid', placeItems: 'center',
              background: '#e8eaed', color: '#3c4043', borderRadius: '50%', fontSize: 13, fontWeight: 500
            }}>{iniciais}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="trunc" style={{ fontSize: 14, lineHeight: 1.2 }}>{app.user.nome}</div>
              <div style={{ fontSize: 12, color: '#5f6368' }}>{app.perfil}</div>
            </div>
            <button className="btn btn-ghost" title="Sair" onClick={app.sair} style={{ border: 0, padding: 3, minHeight: 0 }}>
              {Ico.sair()}
            </button>
          </div>
        </aside>

        <main className="appmain" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <header className="noprint" style={{
            flex: 'none', height: 64, display: 'flex', alignItems: 'center', gap: 12,
            padding: '0 24px', background: '#fff', borderBottom: '1px solid var(--color-divider)'
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: '#5f6368', whiteSpace: 'nowrap' }}>{crumb}</span>
              <span style={{ fontSize: 22, lineHeight: 1, whiteSpace: 'nowrap' }}>{titulo}</span>
            </div>
            <div style={{ flex: 1 }} />
            {app.flash && <span className="flash">{app.flash}</span>}
            {acoes}
          </header>

          <AvisoAtualizacao />

          <div className="appscroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '20px 24px 28px' }}>
            {/* A tela inteira fica fora da impressão: o PDF é só o documento.
                Sem isso, a lista que estiver aberta vaza para dentro do PDF. */}
            <div className="noprint">
              <Conteudo tela={app.tela} />
            </div>
            {/* Fora das telas: qualquer uma pode pedir um documento em PDF
                sem navegar até ele. Só aparece na impressão. */}
            <AreaImpressao />
          </div>

        </main>
      </div>
    </AcoesCtx.Provider>
  )
}

function Conteudo({ tela }: { tela: Tela }) {
  switch (tela) {
    case 'dashboard': return <Dashboard />
    case 'novo': return <Orcamento />
    case 'lista': return <Propostas />
    case 'separacao': return <Separacao />
    case 'itens': return <Itens />
    case 'cores': return <Cores />
    case 'acessorios': return <Acessorios />
    case 'kits': return <Kits />
    case 'kitsvenda': return <KitsVenda />
    case 'instaladores': return <Instaladores />
    case 'clientes': return <Clientes />
    case 'relatorios': return <Relatorios />
    case 'usuarios': return <UsuariosTela />
    case 'config': return <Configuracoes />
  }
}
