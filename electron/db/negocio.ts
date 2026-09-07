import { pode, permissaoComando } from '../../src/permissoes'
import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import type { ComandoNegocio, DB, EventoNegocio, Orcamento, PedidoVenda, Usuario } from '../../src/shared/types'
import { nomeProposta } from '../../src/shared/types'
import { Motor } from '../../src/calc'
import { catalogoDoPedido, dataISO, numeroRev } from '../../src/historico'
import { comCliente } from './pool'

export async function evento(c: PoolClient, numero: string, autor: string, acao: string, detalhe: string) {
  await c.query('INSERT INTO eventos_negocio(id,numero,autor,acao,detalhe) VALUES($1,$2,$3,$4,$5)', [randomUUID(), numero, autor, acao, detalhe])
}
export function novoPedido(db: DB, o: Orcamento, responsavel: string, evidencia: string, instalacao: boolean): PedidoVenda {
  return { id: randomUUID(), numero: o.numero, orcamentoId: o.id, versao: 1, status: 'Confirmado',
    proposta: structuredClone(o), cliente: structuredClone(db.clientes.find(x => x.id === o.clienteId)),
    total: new Motor(db).calc(o).total, aprovadoEm: new Date().toISOString(), aprovadoPor: responsavel, evidencia,
    etapa: 'Aguardando liberação', entregaPrevista: o.entregaPrevista || '', prioridade: o.prioridade || 'Normal',
    instalacao: instalacao ? 'A programar' : 'Não contratada', instalacaoData: '', instalacaoResponsavel: '',
    compradosProntos: [], entregas: [], revisoesAnteriores: [] }
}
export async function carregarPedidos(c: PoolClient, db: DB) {
  // Importação idempotente dos aprovados legados. Não inventa evidência de aceite.
  const grupos = new Map<string, Orcamento[]>()
  for (const o of db.orcamentos.filter(x => x.status === 'Aprovado')) grupos.set(o.numero, [...(grupos.get(o.numero) || []), o])
  for (const [numero, grupo] of grupos) {
    grupo.sort((a, b) => numeroRev(b.rev) - numeroRev(a.rev))
    const emAndamento = grupo.filter(o => db.separacoes[o.id])
    const o = emAndamento[0] || grupo[0]
    const p = novoPedido(db, o, 'Migração do sistema', 'Aceite anterior ao controle de evidências; conferir documentação original.', false)
    p.legado = true
    p.revisoesAnteriores = grupo.filter(x => x.id !== o.id).map(proposta => ({ proposta, etapa: 'Aguardando liberação', motivo: 'Revisão aprovada anterior à migração; conferências originais preservadas.', data: p.aprovadoEm }))
    if (db.separacoes[o.id]) { p.ordemProducaoId = 'OP-' + nomeProposta(o); p.status = 'Em execução'; p.etapa = db.separacoes[o.id].status === 'Concluída' ? 'Em fabricação' : 'Em separação' }
    const r = await c.query('INSERT INTO pedidos_venda(id,numero,orcamento_id,dados) VALUES($1,$2,$3,$4) ON CONFLICT(numero) DO NOTHING RETURNING id', [p.id, numero, o.id, JSON.stringify(p)])
    if (r.rowCount) await evento(c, numero, 'Sistema', 'Pedido migrado', `${nomeProposta(o)}. Confira liberação técnica, instalação contratada e aceite legado.`)
  }
  db.pedidos = (await c.query('SELECT dados,versao FROM pedidos_venda ORDER BY numero')).rows.map(r => ({ ...r.dados, versao: r.versao }))
  db.eventos = (await c.query('SELECT * FROM eventos_negocio ORDER BY data DESC')).rows.map((r): EventoNegocio => ({ ...r, data: r.data.toISOString() }))
}
function exigir(ok: unknown, msg: string): asserts ok { if (!ok) throw new Error(msg) }
function texto(v: string | undefined, label: string) { exigir(v?.trim(), `Informe ${label}.`); return v!.trim() }
function dataValida(v: string | undefined) { exigir(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'Informe uma data válida.'); return v }
export function validarEmissao(db: DB, o: Orcamento) {
  exigir(db.clientes.some(x => x.id === o.clienteId), 'Escolha um cliente cadastrado.')
  texto(o.obra, 'a obra'); texto(o.condPag, 'a condição de pagamento'); texto(o.prazo, 'o prazo')
  exigir(o.itens.length, 'Adicione produtos à proposta.')
  const cat = catalogoDoPedido(db, o)
  for (const it of o.itens) {
    const m = cat.materiais.find(x => x.id === it.matId)
    exigir(m && Number.isFinite(it.qtd) && it.qtd > 0, 'Confira os produtos e quantidades.')
    exigir([it.larg,it.alt].every(v=>v==null || Number.isFinite(v)&&v>=0), 'Medidas inválidas.')
    if (m.unidade !== 'UN') exigir((it.larg ?? m.larg ?? 0) > 0 && (it.alt ?? m.alt ?? 0) > 0, 'Informe as medidas dos produtos antes de emitir.')
  }
  exigir(Number.isFinite(cat.config.validade) && cat.config.validade > 0, 'Defina a validade da proposta nas configurações.')
  const total = new Motor(db).calc(o).total
  exigir(Number.isFinite(total) && total > 0 && o.desconto >= 0, 'Confira preços e desconto: o total deve ser maior que zero.')
}

export async function executarNegocio(db: DB, cmd: ComandoNegocio, usuario: Usuario): Promise<void> {
  const comercial = ['enviar', 'negociar', 'aprovar', 'recusar', 'expirar'].includes(cmd.acao)
  exigir(usuario.ativo, 'Usuário desativado.')
  exigir(pode(db.permissoes?.matriz,usuario.perfil,permissaoComando(cmd.acao)), 'Seu perfil não permite esta operação comercial ou de produção.')
  await comCliente(async c => {
    await c.query('BEGIN')
    try {
      if (comercial) {
        const o = db.orcamentos.find(x => x.id === cmd.id)
        exigir(o, 'Proposta não encontrada.')
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [o.numero])
        const row = (await c.query('SELECT * FROM orcamentos WHERE id=$1 FOR UPDATE', [o.id])).rows[0]
        exigir(row, 'Proposta não encontrada.')
        const pedidoRow = (await c.query('SELECT * FROM pedidos_venda WHERE numero=$1 FOR UPDATE', [o.numero])).rows[0]
        if (cmd.acao === 'aprovar' && pedidoRow?.orcamento_id === o.id) { await c.query('COMMIT'); return }
        exigir(cmd.atualizadoEm === row.atualizado_em.toISOString(), 'A proposta mudou em outra sessão. Atualize a tela.')
        exigir(['Proposta', 'Enviada', 'Em análise'].includes(row.status), 'Esta situação não permite a ação solicitada.')
        const ultima = (await c.query('SELECT rev FROM orcamentos WHERE numero=$1', [o.numero])).rows
        exigir(numeroRev(o.rev) === Math.max(...ultima.map(x => numeroRev(x.rev))), 'Somente a última revisão pode ser enviada ou aprovada.')
        const vencida = row.validade_ate && row.validade_ate < new Date().toISOString().slice(0, 10)
        if (cmd.acao !== 'expirar' && cmd.acao !== 'recusar') exigir(!vencida, 'Proposta expirada. Crie uma revisão com nova validade.')
        let status = row.status
        let detalhe = cmd.motivo || ''
        if (cmd.acao === 'enviar') { detalhe = texto(cmd.motivo, 'o canal de envio'); status = 'Enviada'; await c.query('UPDATE orcamentos SET enviada_em=$2 WHERE id=$1', [o.id, new Date().toISOString()]) }
        if (cmd.acao === 'negociar') status = 'Em análise'
        if (cmd.acao === 'recusar') { detalhe = texto(cmd.motivo, 'o motivo da recusa'); status = 'Perdido' }
        if (cmd.acao === 'expirar') { exigir(vencida, 'A validade da proposta ainda não terminou.'); status = 'Expirada' }
        if (cmd.acao === 'aprovar') {
          validarEmissao(db, o)
          const responsavel = texto(cmd.responsavel, 'quem aprovou pelo cliente')
          const evidencia = texto(cmd.evidencia, 'a referência do aceite (documento, e-mail ou conversa)')
          status = 'Aprovado'
          let p = novoPedido(db, { ...o, status: 'Aprovado' }, responsavel, evidencia, !!cmd.instalacaoContratada)
          if (pedidoRow) {
            exigir(pode(db.permissoes?.matriz,usuario.perfil,'aditivos'), 'A aprovação de um aditivo exige permissão concedida por um administrador.')
            const antigo: PedidoVenda = { ...pedidoRow.dados, versao: pedidoRow.versao }
            exigir(antigo.proposta.clienteId === o.clienteId, 'O aditivo deve manter o cliente do pedido. Para outro cliente, abra um orçamento novo.')
            exigir(antigo.status !== 'Cancelado' && antigo.status !== 'Concluído', 'Este pedido está encerrado. Abra um novo orçamento.')
            exigir(!antigo.entregas.length, 'Já existem entregas programadas ou realizadas. Resolva-as antes de alterar os produtos contratados; preserve o pedido e abra um orçamento complementar.')
            exigir(cmd.impactoConfirmado, 'Confirme o impacto nos valores, prazos e materiais já separados ou consumidos.')
            const motivo = texto(cmd.motivo, 'o motivo e os impactos do aditivo')
            exigir(cmd.versao === antigo.versao, 'O pedido mudou em outra sessão. Atualize a tela.')
            p = { ...p, id: antigo.id, versao: antigo.versao + 1, revisoesAnteriores: [...antigo.revisoesAnteriores, { proposta: antigo.proposta, etapa: antigo.etapa, motivo, data: new Date().toISOString() }] }
            await c.query('UPDATE pedidos_venda SET orcamento_id=$2,dados=$3,versao=$4 WHERE id=$1', [p.id, o.id, JSON.stringify(p), p.versao])
            await c.query("UPDATE orcamentos SET status='Substituída' WHERE id=$1", [antigo.orcamentoId])
          } else await c.query('INSERT INTO pedidos_venda(id,numero,orcamento_id,dados) VALUES($1,$2,$3,$4)', [p.id, p.numero, p.orcamentoId, JSON.stringify(p)])
          detalhe = `${nomeProposta(o)} aceita por ${responsavel}. Evidência: ${evidencia}. ${cmd.motivo || ''}`
        }
        await c.query('UPDATE orcamentos SET status=$2,atualizado_em=clock_timestamp() WHERE id=$1', [o.id, status])
        await evento(c, o.numero, usuario.nome, cmd.acao, `${row.status} → ${status}. ${detalhe}`)
      } else {
        const r = (await c.query('SELECT dados,versao FROM pedidos_venda WHERE id=$1 FOR UPDATE', [cmd.id])).rows[0]
        exigir(r, 'Pedido não encontrado.')
        const p: PedidoVenda = { ...r.dados, versao: r.versao }
        exigir(cmd.versao === p.versao, 'O pedido mudou em outra sessão. Atualize antes de salvar.')
        exigir(!['Cancelado', 'Concluído'].includes(p.status), 'O pedido está encerrado.')
        const antes = `${p.status} / ${p.etapa} / ${p.instalacao}`
        if (cmd.acao === 'regularizar') {
          exigir(p.legado, 'Este pedido já foi conferido.')
          p.aprovadoPor = texto(cmd.responsavel, 'quem aprovou pelo cliente')
          p.evidencia = texto(cmd.motivo, 'a documentação original do aceite e da instalação')
          p.instalacao = cmd.instalacaoContratada ? 'A programar' : 'Não contratada'
          p.legado = false
        } else if (cmd.acao === 'planejar') {
          p.entregaPrevista = dataValida(cmd.data)
          exigir(['Normal', 'Alta', 'Urgente'].includes(cmd.prioridade || p.prioridade), 'Prioridade inválida.')
          p.prioridade = cmd.prioridade || p.prioridade
        } else if (cmd.acao === 'liberar') {
          exigir(p.etapa === 'Aguardando liberação', 'O pedido já foi liberado.')
          exigir(cmd.medidasConferidas && cmd.requisitosConferidos, 'Confira medidas finais e requisitos internos antes de liberar.')
          p.entregaPrevista = dataValida(cmd.data)
          const cat = catalogoDoPedido(db, p.proposta)
          const comprados = cmd.compradosProntos || []
          exigir(comprados.every(i => Number.isInteger(i) && i >= 0 && i < p.proposta.itens.length), 'Produto comprado inválido.')
          for (const [i, it] of p.proposta.itens.entries()) exigir(comprados.includes(i) || cat.materiais.find(x => x.id === it.matId)?.composicao?.length, `Produto ${i + 1} sem composição. Revise a ficha técnica ou identifique como comprado pronto.`)
          p.ordemProducaoId = 'OP-' + nomeProposta(p.proposta)
          p.compradosProntos = comprados; p.status = 'Liberado'; p.etapa = 'Materiais pendentes'
        } else if (cmd.acao === 'fabricar') {
          exigir(p.etapa === 'Em separação' || p.etapa === 'Materiais pendentes', 'Etapa inválida para iniciar fabricação.')
          const sep = (await c.query('SELECT status FROM separacoes WHERE orcamento_id=$1', [p.orcamentoId])).rows[0]
          exigir(sep?.status === 'Concluída', 'Conclua a separação antes de iniciar fabricação.')
          p.etapa = p.compradosProntos.length === p.proposta.itens.length ? 'Em conferência' : 'Em fabricação'; p.status = 'Em execução'
        } else if (cmd.acao === 'conferir') {
          exigir(p.etapa === 'Em fabricação', 'Conclua a fabricação antes da conferência final.')
          texto(cmd.responsavel, 'o responsável pela fabricação'); p.etapa = 'Em conferência'
        } else if (cmd.acao === 'expedir') {
          exigir(p.etapa === 'Em conferência', 'O pedido deve estar em conferência final.')
          exigir(cmd.requisitosConferidos, 'Confirme qualidade e quantidade de todos os produtos.')
          texto(cmd.responsavel, 'o responsável pela conferência'); p.etapa = 'Pronta para expedição'
        } else if (cmd.acao === 'entrega') {
          exigir(p.etapa === 'Pronta para expedição', 'Finalize a conferência antes de programar entregas.')
          const e = structuredClone(cmd.entrega)
          exigir(e, 'Informe a entrega.'); dataValida(e.data); texto(e.responsavel, 'o responsável pela entrega')
          exigir(['Programada', 'Em transporte', 'Entregue', 'Ocorrência'].includes(e.status), 'Situação da entrega inválida.')
          const antiga = p.entregas.find(x => x.id === e.id)
          exigir(!antiga || antiga.status !== 'Entregue', 'Entrega confirmada é imutável.')
          exigir(antiga ? ({Programada:['Programada','Em transporte','Ocorrência'], 'Em transporte':['Em transporte','Entregue','Ocorrência'], 'Ocorrência':['Programada','Em transporte','Ocorrência'], Entregue:[]}[antiga.status] as string[]).includes(e.status) : e.status === 'Programada', 'Transição de entrega inválida.')
          if (e.status === 'Entregue' || e.status === 'Ocorrência') texto(e.comprovante, 'o comprovante ou a ocorrência')
          exigir(Object.keys(e.quantidades).length > 0 && Object.entries(e.quantidades).every(([i,q]) => /^\d+$/.test(i) && p.proposta.itens[Number(i)] && Number.isFinite(q) && q >= 0) && Object.values(e.quantidades).some(q => q > 0), 'Informe quantidades válidas para a entrega.')
          e.id = antiga?.id || randomUUID()
          for (const [i, it] of p.proposta.itens.entries()) {
            const reservado = p.entregas.filter(x => x.id !== e.id).reduce((s,x) => s + (x.quantidades[i] || 0), 0)
            exigir(reservado + (e.quantidades[i] || 0) <= it.qtd + 0.00001, `Quantidade da entrega excede o saldo do produto ${i+1}.`)
          }
          p.entregas = [...p.entregas.filter(x => x.id !== e.id), e]
        } else if (cmd.acao === 'instalacao') {
          exigir(p.instalacao !== 'Não contratada', 'Instalação não contratada neste pedido.')
          const transicoes: Record<string, string[]> = {'A programar':['Programada'], Programada:['Programada','Em execução','Pendência'], 'Em execução':['Concluída','Pendência'], Pendência:['Programada','Em execução']}
          exigir(cmd.instalacao && transicoes[p.instalacao]?.includes(cmd.instalacao), 'Transição de instalação inválida.')
          if (cmd.instalacao === 'Em execução' || cmd.instalacao === 'Concluída') exigir(p.entregas.some(e => e.status === 'Entregue'), 'Registre a entrega antes de iniciar a instalação.')
          if (cmd.instalacao === 'Concluída') exigir(p.proposta.itens.every((it,i) => p.entregas.filter(e=>e.status==='Entregue').reduce((s,e)=>s+(e.quantidades[i]||0),0) >= it.qtd), 'Entregue todos os produtos antes de concluir a instalação.')
          p.instalacaoData = dataValida(cmd.data); p.instalacaoResponsavel = texto(cmd.responsavel, 'a equipe responsável')
          texto(cmd.motivo, 'o registro da instalação ou aceite'); p.instalacao = cmd.instalacao
        } else if (cmd.acao === 'concluir') {
          exigir(p.proposta.itens.every((it,i) => p.entregas.filter(e=>e.status==='Entregue').reduce((s,e)=>s+(e.quantidades[i]||0),0) >= it.qtd), 'Ainda há produtos a entregar.')
          exigir(['Não contratada', 'Concluída'].includes(p.instalacao), 'Conclua a instalação contratada.')
          p.status = 'Concluído'; p.etapa = 'Concluída'
        } else if (cmd.acao === 'cancelar') { texto(cmd.motivo, 'o motivo do cancelamento e o tratamento dos materiais/entregas'); p.status = 'Cancelado' }
        else throw new Error('Ação desconhecida.')
        p.versao++
        await c.query('UPDATE pedidos_venda SET dados=$2,versao=$3 WHERE id=$1', [p.id, JSON.stringify(p), p.versao])
        await evento(c, p.numero, usuario.nome, cmd.acao, `${antes} → ${p.status} / ${p.etapa} / ${p.instalacao}. ${cmd.motivo || ''} ${cmd.responsavel || ''} ${cmd.entrega ? JSON.stringify(cmd.entrega) : ''}`)
      }
      await c.query('COMMIT')
    } catch (e) { await c.query('ROLLBACK'); throw e }
  })
}

/** Remove valores comerciais em toda a árvore, incluindo snapshots e revisões. */
export function dadosPorPerfil(db: DB, usuario: Usuario): DB {
  const permitido=(p:Parameters<typeof pode>[2])=>pode(db.permissoes?.matriz,usuario.perfil,p)
  const sensiveis = /^(condPag$|observacoes$|evidencia$|moPct$|moFixo$|preco|mo[A-Z]|markup|imposto|com[12]$|comissao|imp[A-Z]|desconto|frete|terceiros|outros|total$|diaria$)/
  const limpar = (v: unknown): unknown => Array.isArray(v) ? v.map(limpar) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k,x]) => [k, sensiveis.test(k) ? (typeof x === 'number' ? 0 : Array.isArray(x) ? [] : '') : limpar(x)])) : v
  const copia = (permitido('valores') ? structuredClone(db) : limpar(db)) as DB
  const permitidos = new Set((copia.pedidos || []).flatMap(p => [p.orcamentoId, ...p.revisoesAnteriores.map(x => x.proposta.id)]))
  if(!permitido('pedidos')&&!permitido('relatorios'))copia.pedidos=[]
  copia.orcamentos = permitido('orcamentos')||permitido('relatorios') ? copia.orcamentos : permitido('pedidos') ? copia.orcamentos.filter(o=>permitidos.has(o.id)) : []
  if(!permitido('pedidos')){copia.separacoes={};copia.eventos=[]}
  if(!permitido('clientes')&&!permitido('orcamentos')&&!permitido('pedidos')&&!permitido('relatorios'))copia.clientes=[]
  if(!permitido('orcamentos')&&!permitido('pedidos')&&!permitido('produtos')&&!permitido('materias_primas')&&!permitido('apoio')&&!permitido('relatorios')) {copia.materiais=[];copia.cores=[];copia.acessorios=[];copia.kits=[];copia.kitsVenda=[];copia.instaladores=[]}
  if(!permitido('usuarios'))copia.usuarios=[usuario]
  if(!permitido('valores'))copia.eventos = (copia.eventos || []).filter(e => ['Separação','fabricar','conferir','expedir','entrega','instalacao','concluir'].includes(e.acao))
  if(!permitido('valores'))for (const p of copia.pedidos || []) { p.evidencia = ''; for (const r of p.revisoesAnteriores) r.motivo = '' }
  return copia
}
