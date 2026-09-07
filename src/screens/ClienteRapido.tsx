import { useState } from 'react'
import { Modal, Campo, InputFicha } from '../ui'
import { chamar, ponte } from '../api'
import { useApp } from '../store'
import { novoId } from './useCadastro'
import type { Cliente } from '../shared/types'

export function ClienteRapido(p: { onFechar: () => void; onCriado: (c: Cliente) => void }) {
  const app = useApp()
  const [c, setC] = useState<Cliente>(() => ({ id: novoId('cli'), nome: '', razao: '', cnpj: '', endereco: '', cidade: '', contato: '', fone: '', email: '' }))
  const [erro, setErro] = useState('')
  return <Modal titulo="Novo cliente para este orçamento" onFechar={p.onFechar}>
    <p style={{ color: '#5f6368' }}>Cadastre os dados essenciais. Os demais podem ser completados na ficha do cliente.</p>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {(['nome', 'cidade', 'contato', 'fone'] as const).map((k, i) => <Campo key={k} label={['Nome comercial *', 'Cidade / UF', 'Contato', 'Telefone'][i]} erro={k === 'nome' ? erro : undefined}><InputFicha valor={c[k]} onChange={v => setC(x => ({ ...x, [k]: v }))} /></Campo>)}
    </div>
    {app.db.clientes.filter(x => c.nome.trim().length > 2 && x.nome.toLowerCase().includes(c.nome.trim().toLowerCase())).map(x => <button key={x.id} className="search-result" onClick={() => p.onCriado(x)}>Usar cliente existente: {x.nome} · {x.cidade}</button>)}
    <div className="toolbar"><button className="btn btn-primary" disabled={app.gravando} onClick={async () => {
      if (!c.nome.trim()) { setErro('Informe o nome comercial.'); return }
      if (await app.gravar(() => chamar(ponte().salvarCliente(c)), 'Cliente cadastrado')) p.onCriado(c)
    }}>Salvar e selecionar cliente</button><button className="btn btn-ghost" onClick={p.onFechar}>Cancelar</button></div>
  </Modal>
}
