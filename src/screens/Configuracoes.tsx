import { useEffect, useMemo, useRef, useState } from 'react'
import { chamar, ponte } from '../api'
import { fm, fn } from '../format'
import { guardarLocal, lerLocal } from '../rascunhos'
import { useApp } from '../store'
import { useAcoes } from '../Shell'
import { Modal } from '../ui'
import { PublicarVersao } from './PublicarVersao'
import { CAMPOS_CONFIG, SECOES_CONFIG, errosConfig, montarConfig, valoresConfig, type CampoConfig, type SecaoConfig, type ValoresConfig } from '../configuracao'
import type { Config, ConnState } from '../shared/types'

const LISTAS = [
 {id:'condicoesPag',nome:'Condições de pagamento',nota:'Opções disponíveis nas propostas.',padrao:'condPag' as keyof Config,maiuscula:true},
 {id:'prazosEntrega',nome:'Prazos de entrega',nota:'Textos de prazo para os orçamentos.',padrao:'prazo' as keyof Config,maiuscula:true},
 {id:'series',nome:'Séries e linhas',nota:'Linhas utilizadas no catálogo de produtos.',maiuscula:true},
 {id:'tipos',nome:'Tipos de produto e material',nota:'Classificação disponível nos cadastros.',maiuscula:true},
 {id:'acesGrupos',nome:'Grupos de ferragens',nota:'Organização dos acessórios e ferragens.',maiuscula:false},
 {id:'acabamentos',nome:'Acabamentos',nota:'Opções para cores e tratamentos.',maiuscula:false},
 {id:'fornecedores',nome:'Fornecedores',nota:'Nomes disponíveis nos cadastros de apoio.',maiuscula:false},
 {id:'tiposEquipe',nome:'Tipos de equipe',nota:'Classificação das equipes de instalação.',maiuscula:false}
]
type Rascunho = {base:Config;valores:ValoresConfig}
const igual=(a:Config,b:Config)=>CAMPOS_CONFIG.every(f=>JSON.stringify(a[f.id])===JSON.stringify(b[f.id]))
const normalizar=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()

export function Configuracoes(){
 const app=useApp(), {db}=app
 const chave=`estrudena:config:v2:${app.user.id}`
 const [draft,setDraft]=useState<Rascunho>(()=>{
  const salvo=lerLocal<Rascunho|null>(chave,null)
  if(salvo?.base&&salvo.valores)return salvo
  const antigo=lerLocal<Config>(`estrudena:config:${app.user.id}`,db.config)
  return {base:structuredClone(db.config),valores:valoresConfig(antigo)}
 })
 const [secao,setSecao]=useState<SecaoConfig>('empresa')
 const [busca,setBusca]=useState('')
 const [protegido,setProtegido]=useState(true)
 const [salvando,setSalvando]=useState(false)
 const trava=useRef(false)
 const [tentou,setTentou]=useState(false)
 const [tocados,setTocados]=useState<string[]>([])
 const [erro,setErro]=useState('')
 const [revisar,setRevisar]=useState(false)
 const [descartar,setDescartar]=useState(false)
 const [listaId,setListaId]=useState('condicoesPag')
 const [novo,setNovo]=useState('')
 const [remover,setRemover]=useState<string|null>(null)
 const [erroLista,setErroLista]=useState('')
 const [custoExemplo,setCustoExemplo]=useState('100')
 const [conn,setConn]=useState<ConnState|null>(null)
 const [avancado,setAvancado]=useState(false)
 const [exemplo,setExemplo]=useState(false)
 const [sistemaOcupado,setSistemaOcupado]=useState(false)
 const cfg=useMemo(()=>montarConfig(draft.valores),[draft.valores])
 const erros=errosConfig(cfg,draft.valores)
 const alterados=CAMPOS_CONFIG.filter(f=>draft.valores[f.id]!==valoresConfig(draft.base)[f.id])
 const pendente=alterados.length>0
 const externo=!igual(db.config,draft.base)
 const atual=SECOES_CONFIG.find(s=>s.id===secao)!
 const lista=LISTAS.find(l=>l.id===listaId)!
 const itens=(db as unknown as Record<string,string[]>)[listaId]||[]
 useEffect(()=>{setProtegido(guardarLocal(chave,draft))},[chave,draft])
 useEffect(()=>{if(!pendente&&!salvando&&externo)setDraft({base:structuredClone(db.config),valores:valoresConfig(db.config)})},[db.config,pendente,salvando,externo])
 useEffect(()=>{if(secao==='sistema')void chamar(ponte().estadoConexao()).then(setConn).catch(e=>setErro((e as Error).message))},[secao])
 useAcoes(null,[])
 const alterar=(id:keyof Config,v:string)=>{setDraft(d=>({...d,valores:{...d.valores,[id]:v}}));setErro('')}
 const abrirCampo=(f:CampoConfig)=>{setSecao(f.secao);setBusca('');requestAnimationFrame(()=>document.getElementById('config-'+f.id)?.focus())}
 const salvar=async()=>{
  setTentou(true);setErro('')
  const primeiro=CAMPOS_CONFIG.find(f=>erros[f.id])
  if(primeiro){abrirCampo(primeiro);setRevisar(false);return}
  if(trava.current||!pendente)return
  trava.current=true;setSalvando(true)
  try{
   await chamar(ponte().salvarConfig(cfg,draft.base))
   setDraft({base:structuredClone(cfg),valores:valoresConfig(cfg)})
   guardarLocal(`estrudena:config:${app.user.id}`,cfg)
   setRevisar(false);setTentou(false);setTocados([])
   try{await app.recarregar();app.say('Configurações salvas. Os novos padrões já estão disponíveis.')}catch{app.say('Configurações salvas no servidor. Reconecte para atualizar os dados da tela.')}
  }catch(e){setErro((e as Error).message);try{await app.recarregar()}catch{/* O rascunho continua disponível se o servidor estiver fora. */}}finally{trava.current=false;setSalvando(false)}
 }
 const campo=(id:keyof Config)=>{
  const f=CAMPOS_CONFIG.find(f=>f.id===id)!, erroCampo=(tentou||tocados.includes(id))?erros[id]:undefined
  const opcoes=id==='condPag'?db.condicoesPag:id==='prazo'?db.prazosEntrega:null
  const props={id:'config-'+id,'aria-invalid':!!erroCampo,'aria-describedby':'config-'+id+'-nota',className:'input',value:draft.valores[id],onBlur:()=>setTocados(a=>a.includes(id)?a:[...a,id]),onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>alterar(id,e.target.value)}
  return <div className={'config-field'+(id==='observacoes'?' config-wide':'')} key={id}>
   <label htmlFor={'config-'+id}>{f.titulo}{alterados.some(x=>x.id===id)&&<span className="config-dot" aria-hidden="true" title="Alterado"/>}</label>
   {id==='observacoes'?<textarea {...props} rows={6}/>:opcoes?<select {...props}>{!opcoes.includes(draft.valores[id])&&<option value={draft.valores[id]}>{draft.valores[id]||'Selecione uma opção'}</option>}{opcoes.map(o=><option key={o}>{o}</option>)}</select>:<div className="config-input-wrap"><input {...props} type="text" inputMode={f.unidade?'decimal':id==='email'?'email':id==='fone'?'tel':'text'}/>{f.unidade&&<span>{f.unidade}</span>}</div>}
   <div id={'config-'+id+'-nota'} className={erroCampo?'config-error':'config-help'}>{erroCampo||f.nota}</div>
   {opcoes&&<button className="config-text-button" onClick={()=>{setListaId(id==='condPag'?'condicoesPag':'prazosEntrega');setSecao('listas')}}>Gerenciar opções →</button>}
  </div>
 }
 const grupo=(titulo:string,nota:string,ids:(keyof Config)[]) => <section className="config-card"><div className="config-card-title"><h3>{titulo}</h3><p>{nota}</p></div><div className="config-fields">{ids.map(campo)}</div></section>
 const resultados=CAMPOS_CONFIG.filter(f=>normalizar(f.titulo+' '+f.nota+' '+SECOES_CONFIG.find(s=>s.id===f.secao)?.titulo).includes(normalizar(busca)))
 const soma=cfg.impMaterial+cfg.impIndust+cfg.impMo
 const custo=Number(custoExemplo.replace(',','.')), venda=cfg.markup<98?custo/(1-cfg.markup/100):NaN
 const adicionar=async()=>{
  const valor=lista.maiuscula?novo.trim().toUpperCase():novo.trim();setErroLista('')
  if(!valor)return setErroLista('Digite o nome da opção antes de adicionar.')
  if(itens.some(v=>normalizar(v)===normalizar(valor)))return setErroLista('Esta opção já está cadastrada.')
  if(await app.gravar(()=>chamar(ponte().listaAdd(lista.id,valor)), 'Opção adicionada à lista.'))setNovo('')
 }
 const excluir=async()=>{
  if(!remover)return
  if(lista.padrao&&(cfg[lista.padrao]===remover||db.config[lista.padrao]===remover)){setErroLista('Escolha e salve outro padrão antes de remover esta opção.');setRemover(null);return}
  if(await app.gravar(()=>chamar(ponte().listaDel(lista.id,remover)), 'Opção removida. Os documentos existentes foram preservados.'))setRemover(null)
 }
 const operacaoSistema=async(fn:()=>Promise<unknown>)=>{setSistemaOcupado(true);setErro('');try{await fn()}catch(e){setErro((e as Error).message)}finally{setSistemaOcupado(false)}}
 const exibicao=(f:CampoConfig,c:Config)=>f.unidade?`${fn(c[f.id] as number, f.inteiro?0:2)} ${f.unidade}`:Array.isArray(c[f.id])?(c[f.id] as string[]).join('\n')||'Sem observações':String(c[f.id]||'Não informado')
 return <div className="config-page">
  <div className="config-layout">
   <aside className="config-navigation"><label className="config-search"><span>Encontrar um ajuste</span><input className="input" type="search" aria-label="Buscar configurações" placeholder="Ex.: imposto, telefone…" value={busca} onChange={e=>setBusca(e.target.value)}/></label>
    <nav aria-label="Seções das configurações">{SECOES_CONFIG.filter(s=>s.id!=='sistema'||app.pode('sistema')).map(s=><button key={s.id} aria-current={!busca&&secao===s.id?'page':undefined} onClick={()=>{setSecao(s.id);setBusca('');setErroLista('')}}><span>{s.numero}</span><strong>{s.titulo}</strong>{alterados.some(f=>f.secao===s.id)&&<i className="config-dot" aria-hidden="true" title="Alterações pendentes"/>}</button>)}</nav>
    <div className="config-scope"><strong>Padrões da empresa</strong><p>Válidos para a equipe. Novos orçamentos usam estes valores; revisões salvas preservam seus próprios preços.</p></div>
   </aside>
   <div className="config-content">
    <header className="config-section-head"><small>CONFIGURAÇÕES / {busca?'BUSCA':atual.numero}</small><h2>{busca?'O que você quer ajustar?':atual.titulo}</h2><p>{busca?`${resultados.length} ajustes encontrados para “${busca}”`:atual.descricao}</p></header>
    {erro&&<div className="notice warning" role="alert">{erro}</div>}
    {externo&&pendente&&<div className="notice warning">As configurações do servidor mudaram desde o início desta edição. Seu rascunho foi preservado. Revise as alterações ou descarte o rascunho para carregar os dados atuais.</div>}
    {busca?<section className="config-card">{resultados.map(f=><button key={f.id} className="config-search-result" onClick={()=>abrirCampo(f)}><span><strong>{f.titulo}</strong><small>{SECOES_CONFIG.find(s=>s.id===f.secao)?.titulo} · {f.nota}</small></span><span>→</span></button>)}{!resultados.length&&<p className="config-empty">Nenhum ajuste encontrado. Tente “pagamento”, “alumínio” ou “empresa”.</p>}</section>:<>
     <fieldset className="config-editor" disabled={salvando}>
     {secao==='empresa'&&<div className="config-columns"><div>{grupo('Identificação e contato','Dados usados para apresentar a empresa ao cliente.',['empresa','fone','email','site'])}{grupo('Endereço','Informações que acompanham o cabeçalho dos documentos.',['endereco','endereco2'])}</div><aside className="config-preview"><small>PRÉVIA DOS DADOS</small><img src="assets/logo-estrudena.png" alt="Estrudena"/><h3>{cfg.empresa||'Nome da empresa'}</h3><p>{cfg.endereco||'Endereço da empresa'}<br/>{cfg.endereco2}</p><hr/><p>{cfg.fone}<br/>{cfg.email}<br/>{cfg.site}</p><div className="config-preview-note">A prévia acompanha suas alterações. Salve para aplicar os dados.</div></aside></div>}
     {secao==='propostas'&&<>{grupo('Condições iniciais','O ponto de partida para cada nova negociação.',['validade','condPag','prazo'])}{grupo('Texto do documento','Escreva instruções e observações que devem acompanhar as propostas.',['observacoes'])}<section className="config-note-preview"><small>PRÉVIA DAS OBSERVAÇÕES</small>{cfg.observacoes.length?<ul>{cfg.observacoes.map((o,i)=><li key={i}>{o||'\u00a0'}</li>)}</ul>:<p>Nenhuma observação padrão definida.</p>}</section></>}
     {secao==='custos'&&<>{grupo('Fabricação','Referências de custo para calcular os novos orçamentos.',['precoKg','perda','moKg'])}{grupo('Instalação e deslocamento','Valores iniciais dos serviços, ajustáveis em cada orçamento.',['moM2','moHora','moKm'])}<div className="config-inline-help">Custos específicos de matérias-primas são definidos no catálogo. <button className="config-text-button" onClick={()=>app.irPara('materiasprimas')}>Abrir matérias-primas →</button></div></>}
     {secao==='precos'&&<><div className="config-columns"><div>{grupo('Formação do preço','Padrões comerciais para os novos orçamentos.',['markup','imposto','com1','com2'])}</div><aside className="config-preview config-simulation"><small>ENTENDA O MARKUP</small><label htmlFor="custo-exemplo">Experimente um custo (R$)</label><input className="input" id="custo-exemplo" inputMode="decimal" value={custoExemplo} onChange={e=>setCustoExemplo(e.target.value)}/><p>Preço de venda ilustrativo</p><strong>{Number.isFinite(venda)&&custo>=0?fm(venda):'—'}</strong><div className="config-formula">Custo ÷ (1 − markup / 100)</div><p>Exemplo apenas do markup. Serviços, desconto, imposto e comissões entram nas demais etapas do cálculo.</p></aside></div>{grupo('Rateio do faturamento','Distribuição utilizada nos relatórios. As três partes precisam somar 100%.',['impMaterial','impIndust','impMo'])}<div className={'config-allocation'+(Math.abs(soma-100)<.00001?' valid':' invalid')}><div className="config-allocation-bar">{(['impMaterial','impIndust','impMo'] as const).map((id,i)=><span key={id} style={{width:`${Math.max(0,Math.min(100,cfg[id]||0))}%`,background:['#0b5366','#e8bd22','#9aafb6'][i]}}/>)}</div><strong>{Number.isFinite(soma)?fn(soma,2):'—'}% de 100%</strong><span>{Math.abs(soma-100)<.00001?'Distribuição completa':`Ajuste os percentuais para fechar em 100%.`}</span></div></>}
     </fieldset>
     {secao==='listas'&&<section className="config-card"><div className="config-list-select"><label htmlFor="lista-config">Qual lista você quer organizar?</label><select id="lista-config" className="input" value={listaId} onChange={e=>{setListaId(e.target.value);setNovo('');setErroLista('')}}>{LISTAS.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select><p>{lista.nota} Adições e remoções são salvas imediatamente.</p></div><div className="config-list-add"><input className="input" aria-label="Nome da nova opção" placeholder="Digite uma nova opção…" value={novo} disabled={app.gravando} onChange={e=>setNovo(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void adicionar()}}}/><button className="btn btn-primary" disabled={app.gravando||!novo.trim()} onClick={()=>void adicionar()}>Adicionar opção</button></div>{erroLista&&<p className="config-error config-list-message" role="alert">{erroLista}</p>}<div className="config-list-summary">{itens.length} opções {lista.padrao&&'· A escolha do padrão precisa ser salva no rodapé.'}</div>{itens.map(v=><div className="config-list-row" key={v}><strong>{v}</strong>{lista.padrao&&(cfg[lista.padrao]===v?<span className="config-default">Padrão {db.config[lista.padrao]===v?'atual':'pendente'}</span>:<button className="config-text-button" disabled={salvando} onClick={()=>alterar(lista.padrao!,v)}>Usar como padrão</button>)}<button className="btn btn-ghost" aria-label={`Remover ${v}`} disabled={app.gravando} onClick={()=>setRemover(v)}>Remover</button></div>)}{!itens.length&&<p className="config-empty">A lista está vazia. Adicione a primeira opção acima.</p>}</section>}
     {secao==='sistema'&&app.pode('sistema')&&<div className="config-system"><section className="config-card"><div className="config-card-title"><h3>Conexão com o servidor</h3><p>Disponibilidade do banco compartilhado pela equipe.</p></div><div className="config-system-row"><div><span className={'config-connection '+(conn?.status==='conectado'?'online':'')}>{conn?.status==='conectado'?'Conectado':conn?.status==='erro'?'Conexão indisponível':'Verificando conexão'}</span><p>{conn?.host||'Servidor local'}{conn?.porta?` · porta ${conn.porta}`:''}</p></div><button className="btn btn-secondary" disabled={sistemaOcupado} onClick={()=>void operacaoSistema(async()=>{setConn(await chamar(ponte().conectar()));await app.recarregar()})}>Verificar e reconectar</button></div></section><section className="config-card"><div className="config-card-title"><h3>Exportar dados</h3><p>Gere um arquivo JSON com os dados disponíveis no aplicativo. O arquivo não inclui arquivos de instalação do sistema nem substitui um backup completo do banco.</p></div><div className="config-system-row"><div><strong>{db.materiais.length} produtos e insumos · {db.clientes.length} clientes</strong><p>{db.orcamentos.length} revisões de orçamento · {db.pedidos?.length||0} pedidos de venda</p></div><button className="btn btn-secondary" disabled={sistemaOcupado} onClick={()=>void operacaoSistema(async()=>{const caminho=await chamar(ponte().exportarJson(JSON.stringify(db,null,2),'estrudena-dados.json'));app.say(caminho?'Dados exportados.':'Exportação cancelada.')})}>Exportar dados em JSON</button></div></section><section className="config-card config-advanced"><button className="config-advanced-toggle" aria-expanded={avancado} onClick={()=>setAvancado(v=>!v)}><span><strong>Atualizações e manutenção</strong><small>Distribuição de versões e dados de demonstração.</small></span><span>{avancado?'−':'+'}</span></button>{avancado&&<div className="config-advanced-body"><p className="config-help">Estas ações têm botões próprios e não dependem de “Salvar alterações”.</p><PublicarVersao/><div className="config-system-row"><div><strong>Dados de demonstração</strong><p>Acrescenta clientes e orçamentos de exemplo ao banco compartilhado.</p></div><button className="btn btn-secondary" disabled={sistemaOcupado} onClick={()=>setExemplo(true)}>Adicionar exemplos…</button></div></div>}</section></div>}
    </>}
   </div>
  </div>
  <footer className="config-savebar"><div aria-live="polite"><strong>{salvando?'Salvando no servidor…':pendente?`${alterados.length} ${alterados.length===1?'ajuste pendente':'ajustes pendentes'}`:'Tudo salvo'}</strong><small>{!protegido?'Não foi possível proteger o rascunho neste computador.':pendente?'Rascunho protegido neste computador.':'Os padrões estão atualizados com o servidor.'}</small></div><div className="config-save-actions">{pendente&&<><button className="btn btn-ghost" disabled={salvando} onClick={()=>setDescartar(true)}>Descartar</button><button className="btn btn-secondary" disabled={salvando} onClick={()=>setRevisar(true)}>Revisar alterações</button></>}<button className="btn btn-primary" disabled={!pendente||salvando} onClick={()=>void salvar()}>Salvar alterações</button></div></footer>
  {revisar&&<Modal titulo="Revisar alterações" onFechar={()=>{if(!salvando)setRevisar(false)}} largura={780}><p className="config-help">Confira os padrões que serão alterados para a equipe.</p><div className="config-change-list">{alterados.map(f=><div key={f.id}><strong>{f.titulo}</strong><span>{exibicao(f,draft.base)}</span><b aria-hidden="true">→</b><span>{exibicao(f,cfg)}</span></div>)}</div>{erro&&<p className="config-error" role="alert">{erro}</p>}<div className="config-dialog-actions"><button className="btn btn-secondary" disabled={salvando} onClick={()=>setRevisar(false)}>Continuar editando</button><button className="btn btn-primary" disabled={salvando} onClick={()=>void salvar()}>Salvar alterações</button></div></Modal>}
  {descartar&&<Modal titulo="Descartar alterações locais?" onFechar={()=>setDescartar(false)} largura={480}><p>Os {alterados.length} ajustes pendentes serão substituídos pelas configurações atuais do servidor.</p><div className="config-dialog-actions"><button className="btn btn-secondary" onClick={()=>setDescartar(false)}>Continuar editando</button><button className="btn btn-primary" onClick={()=>{setDraft({base:structuredClone(db.config),valores:valoresConfig(db.config)});setDescartar(false);setTentou(false);setErro('');setTocados([])}}>Descartar alterações</button></div></Modal>}
  {remover!==null&&<Modal titulo="Remover opção da lista?" onFechar={()=>setRemover(null)} largura={500}><p>“{remover}” deixará de aparecer para novos cadastros. Os registros existentes mantêm seus dados.</p><div className="config-dialog-actions"><button className="btn btn-secondary" onClick={()=>setRemover(null)}>Voltar</button><button className="btn btn-primary" disabled={app.gravando} onClick={()=>void excluir()}>Remover opção</button></div></Modal>}
  {exemplo&&<Modal titulo="Adicionar dados de demonstração?" onFechar={()=>setExemplo(false)} largura={520}><p>Clientes e orçamentos de exemplo serão acrescentados ao banco usado por toda a equipe. Essa ação é destinada a demonstrações do sistema.</p><div className="config-dialog-actions"><button className="btn btn-secondary" onClick={()=>setExemplo(false)}>Voltar</button><button className="btn btn-primary" disabled={sistemaOcupado} onClick={()=>void operacaoSistema(async()=>{await chamar(ponte().restaurarExemplo());await app.recarregar();setExemplo(false);app.say('Dados de exemplo adicionados.')})}>Adicionar exemplos ao banco</button></div></Modal>}
 </div>
}
