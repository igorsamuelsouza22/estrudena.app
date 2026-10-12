import { nomeProposta } from './shared/types'
import { useEffect, useState } from 'react'
import { useApp, type Tela } from './store'
import { Modal, rotuloStatus } from './ui'
import { ehProduto } from './catalogo'
import { propostasVigentes } from './historico'
import { resumoPedido } from './producao'

export function BuscaGlobal() {
  const app = useApp()
  const [aberta, setAberta] = useState(false)
  const [texto, setTexto] = useState('')
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAberta(v => !v) } }
    window.addEventListener('keydown', tecla); return () => window.removeEventListener('keydown', tecla)
  }, [])
  const navegar = (tela: Tela, id: string) => { app.irPara(tela, id); setAberta(false) }
  const itens = [
    ...(app.db.pedidos||[]).map(p=>({id:p.id,tipo:'Pedido',titulo:`Pedido ${p.numero}`,detalhe:`${p.cliente?.nome||''} · ${p.proposta.obra} · ${resumoPedido(p).situacao}`,abrir:()=>navegar('pedidos',p.id)})),
    ...(app.pode('clientes') ? app.db.clientes.map(c => ({ id: c.id, tipo: 'Cliente', titulo: c.nome, detalhe: [c.cnpj, c.cidade, c.contato].join(' · '), abrir: () => navegar('clientes', c.id) })) : []),
    ...(app.verCustos ? app.db.materiais.filter(m=>app.pode(ehProduto(m)?'produtos':'materias_primas')).map(m => ({ id: m.id, tipo: ehProduto(m) ? 'Produto' : 'Matéria-prima', titulo: `${m.cod} · ${m.desc}`, detalhe: m.tipo, abrir: () => navegar(ehProduto(m) ? 'itens' : 'materiasprimas', m.id) })) : []),
    ...propostasVigentes(app.db.orcamentos).map(o => ({ id: o.id, tipo: 'Proposta', titulo: nomeProposta(o), detalhe: `${app.db.clientes.find(c => c.id === o.clienteId)?.nome ?? ''} · ${o.obra} · ${rotuloStatus(o.status)}`, abrir: () => { if (app.pode('orcamentos')) app.abrirOrc(o); else { app.irPara('pedidos',app.db.pedidos?.find(p=>p.orcamentoId===o.id)?.id) } setAberta(false) } }))
  ].filter(x => !texto.trim() || `${x.titulo} ${x.detalhe}`.toLocaleLowerCase().includes(texto.toLocaleLowerCase().trim())).slice(0, 30)
  return <><button className="btn btn-secondary" onClick={() => setAberta(true)} title="Buscar no aplicativo (Ctrl+K)">Buscar <kbd>Ctrl K</kbd></button>
    {aberta && <Modal titulo="Buscar no aplicativo" onFechar={() => setAberta(false)}>
      <input autoFocus aria-label="Buscar cliente, produto ou proposta" className="input" placeholder="Nome, código, obra ou número da proposta" value={texto} onChange={e => setTexto(e.target.value)} />
      <p style={{ color: '#5f6368', fontSize: 12 }}>Até 30 resultados · use Tab e Enter para abrir.</p>
      {itens.map(x => <button key={x.tipo + x.id} className="search-result" onClick={x.abrir}><span style={{ width: 95, fontSize: 12, color: '#5f6368' }}>{x.tipo}</span><span><strong>{x.titulo}</strong><br /><small>{x.detalhe}</small></span></button>)}
      {!itens.length && <p>Nenhum resultado. Tente parte do nome ou do código.</p>}
    </Modal>}
  </>
}
