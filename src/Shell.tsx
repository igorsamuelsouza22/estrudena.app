import { PERMISSAO_TELA } from './permissoes'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { BuscaGlobal } from './BuscaGlobal'
import { StatusConexao } from './StatusConexao'
import { lerLocal, guardarLocal } from './rascunhos'
import { Ico } from './icons'
import { useApp, type Tela } from './store'

import { AvisoAtualizacao } from './AvisoAtualizacao'
import { AreaImpressao } from './documentos/AreaImpressao'
import { Dashboard } from './screens/Dashboard'
import { Orcamento } from './screens/Orcamento'
import { Pedidos } from './screens/Pedidos'
import { Propostas } from './screens/Propostas'
import { Separacao } from './screens/Separacao'
import { Itens } from './screens/Itens'
import { MateriasPrimas } from './screens/MateriasPrimas'
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

const TITULOS: Record<Tela, [string, string, string]> = {
  pedidos: ['Comercial', 'Pedidos de venda', 'Da revisão aceita à entrega e instalação.'],
  dashboard: ['Início', 'Início', ''],
  novo: ['Orçamentos', 'Orçamento', 'Da primeira estimativa à proposta do cliente.'],
  lista: ['Comercial', 'Orçamentos', 'Cada obra em um lugar. Da estimativa à aprovação.'],
  separacao: ['Produção', 'Produção', 'Organize os pedidos e confira produtos, matérias-primas e ferragens.'],
  itens: ['Catálogo', 'Produtos', 'Portas, janelas e produtos para incluir nos orçamentos.'],
  materiasprimas: ['Catálogo', 'Matérias-primas', 'Insumos e custos usados na composição dos produtos.'],
  apoio: ['Catálogo', 'Cadastros de apoio', 'Ferragens, kits, acabamentos e equipes de instalação.'],
  clientes: ['Comercial', 'Clientes', 'Contatos, obras e histórico de atendimento.'],
  cores: ['Catálogo', 'Cores e acabamentos', 'Pintura e acabamento das esquadrias.'],
  acessorios: ['Catálogo', 'Ferragens e acessórios', 'Componentes utilizados na fabricação.'],
  kits: ['Catálogo', 'Kits de ferragem', 'Conjuntos de componentes para os produtos.'],
  kitsvenda: ['Catálogo', 'Kits de venda', 'Combinações de produtos para os orçamentos.'],
  instaladores: ['Catálogo', 'Equipes de instalação', 'Contatos e custos das equipes.'],
  relatorios: ['Gestão', 'Resultados', 'Acompanhe as vendas e o resultado do seu negócio.'],
  usuarios: ['Gestão', 'Pessoas e acessos', 'Gerencie quem pode acessar cada área do sistema.'],
  config: ['Gestão', 'Configurações', 'Organização e padrões para toda a equipe.']
}
const APOIO: {tela: Tela; titulo: string; descricao: string; icone: ReactNode}[] = [
  {tela:'acessorios', titulo:'Ferragens e acessórios', descricao:'Fechos, roldanas e vedação', icone:Ico.aces()},
  {tela:'kits', titulo:'Kits de ferragem', descricao:'Conjuntos de componentes', icone:Ico.kit()},
  {tela:'kitsvenda', titulo:'Kits de venda', descricao:'Combinações de produtos', icone:Ico.kv()},
  {tela:'cores', titulo:'Cores e acabamentos', descricao:'Pintura e tratamentos', icone:Ico.cor()},
  {tela:'instaladores', titulo:'Equipes de instalação', descricao:'Contatos e custos da equipe', icone:Ico.inst()}
]

export function Shell() {
  const app = useApp()
  const [densidade, setDensidade] = useState(() => lerLocal('estrudena:densidade', 'confortavel'))
  const [acoes, setAcoes] = useState<ReactNode>(null)
  const [menus, setMenus] = useState({catalogo: true, gestao: true})
  const [preferencias, setPreferencias] = useState(false)
  const catalogo = ['itens','materiasprimas','apoio',...APOIO.map(x=>x.tela)].includes(app.tela)
  const gestao = ['relatorios','usuarios','config'].includes(app.tela)
  useEffect(() => {
    if(catalogo) setMenus(m=>({...m,catalogo:true}))
    if(gestao) setMenus(m=>({...m,gestao:true}))
  }, [app.tela, catalogo, gestao])
  useEffect(() => {
    const permissao=PERMISSAO_TELA[app.tela]
    if(permissao&&!app.pode(permissao))app.irPara('dashboard')
  }, [app.tela, app.perfil, app.db.permissoes])
  const [crumb,titulo,descricao] = TITULOS[app.tela]
  const iniciais = app.user.nome.split(' ').map(x=>x[0]).slice(0,2).join('')
  const nav = (tela: Tela, label: string, icone?: ReactNode, active=app.tela===tela) => PERMISSAO_TELA[tela]&&!app.pode(PERMISSAO_TELA[tela]!)?null:<button key={tela} className={'navbtn'+(active?' on':'')} aria-current={active?'page':undefined} onClick={()=>{if(tela==='separacao')app.setSepId('');app.irPara(tela)}}>{icone}<span>{label}</span></button>
  return <AcoesCtx.Provider value={setAcoes}>
    <div className="appshell" data-density={densidade}>
      <aside className="app-sidebar noprint">
        <div className="app-brand"><span className="brand-stripe"/><strong>estrudena.</strong><small>GESTÃO DE ESQUADRIAS</small></div>
        <nav className="app-nav" aria-label="Áreas do sistema">
          {nav('dashboard','Início',Ico.dash())}
          {app.pode('orcamentos')&&nav('lista','Orçamentos',Ico.novo(),['lista','novo'].includes(app.tela))}
          {nav('pedidos','Pedidos de venda',Ico.kv())}
          {['produtos','materias_primas','apoio'].some(p=>app.pode(p as any)) && <div className="nav-group">
            <button className={'navbtn'+(catalogo?' group-active':'')} aria-expanded={menus.catalogo} aria-controls="menu-catalogo" onClick={()=>setMenus(m=>({...m,catalogo:!m.catalogo}))}>{Ico.itens()}<span>Catálogo</span><span className="nav-chevron" aria-hidden="true">{menus.catalogo?'⌃':'⌄'}</span></button>
            <div className="nav-submenu" id="menu-catalogo" hidden={!menus.catalogo}>
              {nav('itens','Produtos')}{nav('materiasprimas','Matérias-primas')}{nav('apoio','Cadastros de apoio',undefined,app.tela==='apoio'||APOIO.some(x=>x.tela===app.tela))}
            </div>
          </div>}
          {nav('separacao','Produção',Ico.sep())}
          {app.pode('clientes') && nav('clientes','Clientes',Ico.users())}
          {['relatorios','usuarios','config'].some(p=>app.pode(p as any)) && <div className="nav-group">
            <button className={'navbtn'+(gestao?' group-active':'')} aria-expanded={menus.gestao} aria-controls="menu-gestao" onClick={()=>setMenus(m=>({...m,gestao:!m.gestao}))}>{Ico.rel()}<span>Gestão</span><span className="nav-chevron" aria-hidden="true">{menus.gestao?'⌃':'⌄'}</span></button>
            <div className="nav-submenu" id="menu-gestao" hidden={!menus.gestao}>
              {nav('relatorios','Resultados')}{nav('config','Configurações')}{nav('usuarios','Pessoas e acessos')}
            </div>
          </div>}
        </nav>
        <div className="sidebar-bottom"><StatusConexao />
          <button className="btn btn-ghost sidebar-preferences" aria-expanded={preferencias} onClick={()=>setPreferencias(x=>!x)}>Preferências de exibição</button>
          {preferencias && <label className="field">Espaçamento<select aria-label="Densidade da interface" className="input" value={densidade} onChange={e=>{setDensidade(e.target.value);guardarLocal('estrudena:densidade',e.target.value)}}><option value="confortavel">Confortável</option><option value="compacta">Compacta</option></select></label>}
        </div>
        <div className="app-profile"><span className="avatar">{iniciais}</span><div className="profile-name"><div className="trunc">{app.user.nome}</div><small>{app.perfil}</small></div><button className="btn btn-ghost" title="Sair" aria-label="Sair" onClick={app.sair}>{Ico.sair()}</button></div>
      </aside>
      <main className="appmain">
        <header className="app-topbar noprint"><div className="breadcrumb">{crumb}{crumb!==titulo && <><span>/</span><strong>{titulo}</strong></>}</div><BuscaGlobal /></header>
        {app.flash && <div className="flash-panel noprint" role="status" aria-live="polite">{app.flash}<button className="btn btn-ghost" aria-label="Fechar aviso" onClick={()=>app.say('')}>×</button></div>}
        <AvisoAtualizacao />
        <div className="appscroll">
          <div className="noprint screen-content" data-screen={app.tela}>
            {app.tela!=='dashboard' && <div className="page-heading"><div><h1>{titulo}</h1><p>{descricao}</p></div><div className="page-actions">{acoes}</div></div>}
            {APOIO.some(x=>x.tela===app.tela) && <button className="btn btn-ghost back-button" onClick={()=>app.irPara('apoio')}>← Cadastros de apoio</button>}
            {(!PERMISSAO_TELA[app.tela]||app.pode(PERMISSAO_TELA[app.tela]!))&&<Conteudo tela={app.tela}/>}
          </div>
          <AreaImpressao />
        </div>
      </main>
    </div>
  </AcoesCtx.Provider>
}

function CadastrosApoio(){const app=useApp();return <div className="settings-grid">{APOIO.map(x=><button className="settings-link" key={x.tela} onClick={()=>app.irPara(x.tela)}>{x.icone}<span><strong>{x.titulo}</strong><small>{x.descricao}</small></span><span aria-hidden="true">→</span></button>)}</div>}

function Conteudo({ tela }: { tela: Tela }) {
  switch (tela) {
    case 'dashboard': return <Dashboard />
    case 'novo': return <Orcamento />
    case 'lista': return <Propostas />
    case 'pedidos': return <Pedidos />
    case 'separacao': return <Separacao />
    case 'apoio': return <CadastrosApoio />
    case 'itens': return <Itens />
    case 'materiasprimas': return <MateriasPrimas />
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
