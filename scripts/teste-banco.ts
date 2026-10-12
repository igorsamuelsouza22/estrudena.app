/**
 * Exercita a camada de dados contra um PostgreSQL real: migração, seed,
 * autenticação, gravação de orçamento, separação e o motor de cálculo.
 * Rodado por `node scripts/teste-banco.mjs` (que empacota este arquivo).
 *
 * Roda num schema temporário, removido no fim: revisões gravadas não podem
 * ser excluídas, então o teste não pode escrever na base de trabalho.
 */
import { randomBytes } from 'node:crypto'
import { Client } from 'pg'
import { DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from '../electron/db/credentials'
import { conectar, encerrar } from '../electron/db/pool'
import * as repo from '../electron/db/repo'
import { executarNegocio } from '../electron/db/negocio'
import { Motor } from '../src/calc'
import type { ComandoNegocio, Orcamento, Usuario } from '../src/shared/types'

const schema = 'estrudena_teste_banco_' + randomBytes(8).toString('hex')
const controle = new Client({ host: '127.0.0.1', port: DB_PORT, database: DB_NAME, user: DB_USER, password: DB_PASSWORD })

let falhas = 0
let testes = 0

function ok(condicao: boolean, descricao: string, detalhe?: unknown): void {
  testes++
  if (condicao) {
    console.log(`  ok   ${descricao}`)
  } else {
    falhas++
    console.log(`  FALHA ${descricao}${detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`)
  }
}

function perto(a: number, b: number, tol = 0.01): boolean {
  return Math.abs(a - b) <= tol
}

async function main(): Promise<void> {
  await controle.connect()
  await controle.query(`CREATE SCHEMA "${schema}"`)
  // O pool lê PGOPTIONS: todas as conexões do app passam a usar o schema temporário.
  process.env.PGOPTIONS = `-c search_path=${schema}`
  try {
    await verificar()
  } finally {
    await encerrar()
    await controle.query(`DROP SCHEMA "${schema}" CASCADE`)
    await controle.end()
  }

  console.log(`\n${testes - falhas}/${testes} verificações passaram`)
  if (falhas) {
    console.log(`${falhas} FALHA(S)`)
    process.exitCode = 1
  }
}

async function verificar(): Promise<void> {
  console.log('\n— conexão e migração —')
  const st = await conectar('127.0.0.1')
  ok(st.status === 'conectado', `conectou em ${st.host}:${st.porta}`, st.mensagem)
  if (st.status !== 'conectado') throw new Error(st.mensagem)

  let db = await repo.carregarDB()
  ok(db.materiais.length === 19, `19 itens de catálogo carregados`, db.materiais.length)
  ok(db.cores.length === 8, '8 cores', db.cores.length)
  ok(db.acessorios.length === 12, '12 acessórios', db.acessorios.length)
  ok(db.kits.length === 6, '6 kits de ferragem', db.kits.length)
  ok(db.kitsVenda.length === 5, '5 kits de venda', db.kitsVenda.length)
  ok(db.instaladores.length === 4, '4 equipes de instalação', db.instaladores.length)
  ok(db.config.precoKg === 35.25, 'alumínio a R$ 35,25/kg', db.config.precoKg)
  ok(db.config.markup === 52, 'markup padrão 52%', db.config.markup)
  ok(db.config.observacoes.length === 6, '6 linhas de observação da proposta', db.config.observacoes.length)
  ok(db.series.includes('SUPREMA'), 'lista de séries populada')
  ok(db.prazosEntrega.length === 7, '7 prazos de entrega', db.prazosEntrega.length)

  console.log('\n— usuários pedidos —')
  ok(db.usuarios.length === 3, 'exatamente 3 usuários', db.usuarios.map(u => u.usuario))
  const wilson = db.usuarios.find(u => u.usuario === 'wilson')
  const ana = db.usuarios.find(u => u.usuario === 'ana')
  const prod = db.usuarios.find(u => u.usuario === 'producao')
  ok(wilson?.nome === 'Wilson' && wilson?.perfil === 'Administrador', 'Wilson é Administrador', wilson)
  ok(ana?.nome === 'Ana' && ana?.perfil === 'Administrador', 'Ana é Administrador', ana)
  ok(prod?.perfil === 'Produção', 'conta de Produção com perfil Produção', prod)

  console.log('\n— autenticação —')
  const bom = await repo.autenticar('wilson', 'estrudena')
  ok(bom.ok && bom.usuario?.perfil === 'Administrador', 'login correto entra', bom)
  const ruim = await repo.autenticar('wilson', 'errada')
  ok(!ruim.ok, 'senha errada é recusada', ruim)
  const maiuscula = await repo.autenticar('WILSON', 'estrudena')
  ok(maiuscula.ok, 'login não diferencia maiúsculas', maiuscula)
  const inexistente = await repo.autenticar('ninguem', 'estrudena')
  ok(!inexistente.ok, 'usuário inexistente é recusado')

  console.log('\n— dados de exemplo —')
  await repo.restaurarExemplo()
  db = await repo.carregarDB()
  const numerosExemplo = ['8026-01-26', '8031-02-26', '8034-03-26', '8029-02-26', '8018-11-25']
  const faltando = numerosExemplo.filter(n => !db.orcamentos.some(o => o.numero === n))
  ok(db.clientes.some(c => c.nome === 'PORTO BAY CONSTRUTORA'), 'clientes de exemplo carregados')
  ok(faltando.length === 0, 'as 5 propostas de exemplo estão na base', faltando)
  const portobay = db.orcamentos.find(o => o.numero === '8026-01-26')
  ok(portobay?.itens.length === 13, 'Porto Bay com 13 tipologias', portobay?.itens.length)

  console.log('\n— motor de cálculo (proposta real da planilha) —')
  const motor = new Motor(db)
  const c = motor.calc(portobay!)
  ok(perto(c.pecas, 166, 0.5), '166 peças', c.pecas)
  ok(c.m2 > 400 && c.m2 < 460, `m² na faixa esperada (~434)`, Math.round(c.m2 * 100) / 100)
  ok(c.custoTotal > 0 && c.total > c.custoTotal, 'venda acima do custo', { total: c.total, custo: c.custoTotal })
  ok(perto(c.total, c.subtotal - c.desc), 'total = subtotal − desconto')
  ok(perto(c.subtotal, c.vendaMat + c.mo), 'subtotal = venda de material + instalação')
  ok(perto(c.imposto, c.total * 0.07), 'imposto embutido de 7% sobre o total')
  ok(perto(c.margem, c.total - c.custoTotal), 'margem = total − custo total')

  // Item KG: kg × (precoKg + cor.precoKg) + kit, dividido por (1 − markup).
  const linhaPa150 = c.rows.find(r => r.m?.cod === 'PA150')!
  const custoKitPc3 = motor.kitCusto('KIT-PC3')
  const esperadoCusto = 34.90 * 10 * (35.25 + 31.90) + custoKitPc3 * 10
  ok(perto(linhaPa150.cm, esperadoCusto, 0.02), 'custo do PA150 bate com a fórmula', {
    calculado: Math.round(linhaPa150.cm * 100) / 100, esperado: Math.round(esperadoCusto * 100) / 100
  })
  ok(perto(linhaPa150.venda, esperadoCusto / (1 - 0.52), 0.05), 'venda do PA150 = custo / (1 − markup)')
  ok(perto(linhaPa150.ikg, 349, 0.01), 'kg do PA150 = 34,90 × 10', linhaPa150.ikg)

  console.log('\n— markup ↔ margem —')
  const alvo = 25
  const mku = motor.markupParaMargem(portobay!, alvo)
  const recalc = motor.calc({
    ...portobay!, markup: mku, itens: portobay!.itens.map(i => ({ ...i, markup: null }))
  })
  ok(perto(recalc.margemPct, alvo, 0.15), `margem alvo de ${alvo}% resolve markup ${mku}%`, recalc.margemPct)

  console.log('\n— gravação de orçamento —')
  const novo: Orcamento = {
    ...portobay!, id: '', numero: '', atualizadoEm: undefined, referenciaPrecos: undefined,
    status: 'Rascunho', obra: 'OBRA DE TESTE AUTOMATIZADO', itens: portobay!.itens.slice(0, 3)
  }
  const gravado = await repo.salvarOrcamento(novo)
  ok(!!gravado.id, 'id gerado na criação', gravado.id)
  ok(/^80\d{2}-\d{2}-\d{2}$/.test(gravado.numero), 'número no formato 80NN-MM-AA', gravado.numero)
  ok(gravado.rev === 'rev1', 'primeira gravação é a rev1', gravado.rev)

  let semOrigem = ''
  try {
    await repo.salvarOrcamento({ ...gravado, id: '' })
  } catch (e) {
    semOrigem = (e as Error).message
  }
  ok(/revisão de origem/.test(semOrigem), 'número existente sem revisão de origem é recusado', semOrigem)

  // Revisão nova: sem id, apontando a revisão de origem (numero.revN).
  const revisao = await repo.salvarOrcamento({ ...gravado, id: '', origemId: gravado.id })
  ok(revisao.numero === gravado.numero, 'revisão preserva o número do pedido', {
    original: gravado.numero, revisao: revisao.numero
  })
  ok(revisao.id !== gravado.id, 'revisão é um registro novo')
  ok(revisao.rev === 'rev2', 'revisão recebe a rev2', revisao.rev)

  db = await repo.carregarDB()
  const relido = db.orcamentos.find(o => o.id === revisao.id)!
  ok(relido.itens.length === 3, 'itens gravados e relidos na ordem', relido.itens.length)
  ok(relido.itens[0].matId === novo.itens[0].matId, 'primeiro item preservado')
  ok(relido.obra === 'OBRA DE TESTE AUTOMATIZADO', 'campos de texto preservados')
  const anterior = db.orcamentos.find(o => o.id === gravado.id)
  ok(anterior?.status === 'Substituída', 'rev1 fica como Substituída', anterior?.status)

  console.log('\n— separação —')
  // A separação exige um pedido liberado: emite a rev2, registra o aceite e libera.
  const emitida = await repo.salvarOrcamento({ ...revisao, status: 'Proposta' })
  ok(emitida.id === revisao.id && emitida.rev === 'rev2', 'emitir um rascunho não cria revisão', emitida.rev)
  const comando = async (c: ComandoNegocio) => executarNegocio(await repo.carregarDB(), c, wilson as Usuario)
  await comando({ acao: 'aprovar', id: emitida.id, atualizadoEm: emitida.atualizadoEm, responsavel: 'Cliente de teste', evidencia: 'Aceite de teste' })
  let pedido = (await repo.carregarDB()).pedidos?.find(p => p.numero === emitida.numero)
  ok(pedido?.orcamentoId === emitida.id, 'aceite gera o pedido de venda da rev2', pedido?.orcamentoId)
  // Os produtos do exemplo não têm composição: entram como comprados prontos.
  await comando({
    acao: 'liberar', id: pedido!.id, versao: pedido!.versao, data: '2026-12-01',
    medidasConferidas: true, requisitosConferidos: true, compradosProntos: [0, 1, 2]
  })
  await repo.salvarSeparacao(emitida.id, {
    status: 'Em separação', conf: { '0': 4, '1': 5 },
    responsavel: 'Conferente Teste', obs: 'teste', iniciado: '28/07/2026', concluido: ''
  })
  db = await repo.carregarDB()
  const sep = db.separacoes[emitida.id]
  ok(sep?.status === 'Em separação', 'status da separação gravado', sep?.status)
  ok(sep?.conf['0'] === 4 && sep?.conf['1'] === 5, 'conferência por item gravada', sep?.conf)
  ok(sep?.responsavel === 'Conferente Teste', 'responsável gravado')
  pedido = db.pedidos?.find(p => p.id === pedido!.id)
  ok(pedido?.etapa === 'Em separação', 'pedido acompanha a separação', pedido?.etapa)

  console.log('\n— listas gerenciáveis —')
  await repo.adicionarLista('series', 'SERIE DE TESTE')
  db = await repo.carregarDB()
  ok(db.series.includes('SERIE DE TESTE'), 'valor adicionado à lista')
  await repo.removerLista('series', 'SERIE DE TESTE')
  db = await repo.carregarDB()
  ok(!db.series.includes('SERIE DE TESTE'), 'valor removido da lista')

  console.log('\n— exclusão e vínculos —')
  let historico = ''
  try {
    await repo.excluir('orcamentos', gravado.id)
  } catch (e) {
    historico = (e as Error).message
  }
  ok(/histórico/.test(historico), 'revisão gravada não pode ser excluída', historico)
  db = await repo.carregarDB()
  ok(db.orcamentos.some(o => o.id === gravado.id), 'revisão continua na base')

  let bloqueou = false
  try {
    await repo.excluir('materiais', 'PA150')
  } catch {
    bloqueou = true
  }
  ok(bloqueou, 'exclusão de item usado em proposta é bloqueada pelo banco')

  console.log('\n— idempotência da migração —')
  const antes = (await repo.carregarDB()).materiais.length
  await conectar('127.0.0.1')
  const depois = (await repo.carregarDB()).materiais.length
  ok(antes === depois, 'reconectar não duplica o catálogo', { antes, depois })
}

main().catch(e => {
  console.error('\nerro no teste:', e)
  process.exitCode = 1
})
