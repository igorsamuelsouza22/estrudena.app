import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { Client } from 'pg'
import { DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from '../electron/db/credentials'
import { conectar, encerrar } from '../electron/db/pool'
import { migrar } from '../electron/db/migrate'
import * as repo from '../electron/db/repo'
import { Motor } from '../src/calc'
import { ehProduto, ehMateriaPrima, kitSomenteProdutos } from '../src/catalogo'
import type { Material, Orcamento } from '../src/shared/types'

const schema = `estrudena_teste_catalogo_${randomBytes(8).toString('hex')}`
const controle = new Client({ host: '127.0.0.1', port: DB_PORT, database: DB_NAME,
  user: DB_USER, password: DB_PASSWORD, options: '-c search_path=public', connectionTimeoutMillis: 5000 })
const perto = (valor: number, esperado: number) => assert.ok(Math.abs(valor - esperado) < 1e-7, `${valor} ≠ ${esperado}`)

async function main() {
  await controle.connect()
  const opcoesAnteriores = process.env.PGOPTIONS
  let criou = false
  try {
    // O nome é gerado aqui; nenhum teste acessa as tabelas do schema public.
    assert.match(schema, /^estrudena_teste_catalogo_[a-f0-9]{16}$/)
    await controle.query(`CREATE SCHEMA "${schema}"`)
    criou = true
    process.env.PGOPTIONS = `-c search_path=${schema}`
    const estado = await conectar('127.0.0.1')
    assert.equal(estado.status, 'conectado', estado.mensagem)
    await repo.restaurarExemplo()
    let db = await repo.carregarDB()
    assert.equal(db.materiais.filter(ehProduto).length, 15)
    assert.equal(db.materiais.filter(ehMateriaPrima).length, 4)
    const legados = JSON.parse(readFileSync('scripts/fixtures/calculos-legados.json', 'utf8'))
    for (const esperado of legados) {
      const resultado = new Motor(db).calc(db.orcamentos.find(o => o.numero === esperado.numero)!)
      for (const [campo, valor] of Object.entries(esperado)) {
        if (campo !== 'numero') perto(resultado[campo as keyof typeof resultado] as number, valor as number)
      }
    }
    console.log('OK: 15 produtos, 4 insumos; cálculos das cinco propostas anteriores preservados.')

    // Exercita um banco v3 sem as novas estruturas e a repetição da migração.
    await controle.query(`SET search_path TO "${schema}"`)
    await controle.query('DROP TABLE produto_materiais; ALTER TABLE materiais DROP COLUMN categoria; DELETE FROM schema_versao; INSERT INTO schema_versao (versao) VALUES (3)')
    await migrar(controle as any)
    await migrar(controle as any)
    db = await repo.carregarDB()
    assert.equal(db.materiais.filter(ehMateriaPrima).length, 4)
    assert.equal(db.orcamentos.length, 5)
    console.log('OK: migração v3 → v6 idempotente, com propostas e vínculos preservados.')

    const base = db.materiais.find(m => m.id === 'PA150')!
    const metal: Material = { ...base, id: 'teste-metal', cod: 'MP-METAL', desc: 'Alumínio de teste',
      categoria: 'materia_prima', composicao: [], unidade: 'KG', preco: 10, pesoUnit: 0, corId: '', kitId: '', aces: [] }
    const vidro: Material = { ...metal, id: 'teste-vidro', cod: 'MP-VIDRO', unidade: 'M2', preco: 20, pesoUnit: 2 }
    const vedacao: Material = { ...metal, id: 'teste-vedacao', cod: 'MP-VEDACAO', unidade: 'ML', preco: 3, pesoUnit: 0 }
    for (const m of [metal, vidro, vedacao]) await repo.salvarMaterial(m)
    const produto: Material = { ...base, id: 'teste-porta', cod: 'PORTA-TESTE', desc: 'Porta composta', categoria: 'produto',
      unidade: 'UN', preco: 999, pesoUnit: 999, larg: 1000, alt: 2000, corId: 'RAL9005', kitId: '', aces: [],
      composicao: [{ materialId: metal.id, qtd: 5, base: 'UN' }, { materialId: vidro.id, qtd: 1, base: 'M2' },
        { materialId: vedacao.id, qtd: 2, base: 'ML' }] }
    await repo.salvarMaterial(produto)
    db = await repo.carregarDB()
    assert.deepEqual(db.materiais.find(m => m.id === produto.id)!.composicao, produto.composicao)
    // Comprado pronto: gravado no produto; em matéria-prima não se aplica.
    assert.equal(db.materiais.find(m => m.id === produto.id)!.compradoPronto, false)
    await repo.salvarMaterial({ ...produto, compradoPronto: true })
    await repo.salvarMaterial({ ...metal, compradoPronto: true })
    db = await repo.carregarDB()
    assert.equal(db.materiais.find(m => m.id === produto.id)!.compradoPronto, true)
    assert.equal(db.materiais.find(m => m.id === metal.id)!.compradoPronto, false)
    await repo.salvarMaterial(produto)
    db = await repo.carregarDB()
    const motor = new Motor(db)
    perto(motor.custoNaMedida(produto), 96) // 5 kg × 10 + 2 m² × 20 + 2 m × 3.
    const modelo = db.orcamentos.find(o => o.numero === '8026-01-26')!
    const novo: Orcamento = { ...modelo, referenciaPrecos: undefined, atualizadoEm: undefined, status: 'Rascunho', id: '', numero: '(automático)', markup: 50,
      itens: [{ ...modelo.itens[0], matId: produto.id, larg: 2000, alt: 2000, qtd: 3, markup: null, fc: 1 }] }
    const calculo = motor.calc(novo)
    perto(calculo.custoMat, 426) // (50 + 4 × 20 + 4 × 3) × 3 portas.
    perto(calculo.vendaMat, 852)
    perto(calculo.kg, 39) // (5 kg alumínio + 4 m² × 2 kg/m²) × 3.
    const consumo = motor.materiaisDoPedido(novo)
    perto(consumo.find(it => it.material.id === metal.id)!.qtd, 15)
    perto(consumo.find(it => it.material.id === vidro.id)!.qtd, 12)
    perto(consumo.find(it => it.material.id === vedacao.id)!.qtd, 12)
    const kit = { id: 'teste-kit', cod: 'KIT-TESTE', nome: 'Kit de portas', descricao: '', itens: [{ matId: produto.id, qtd: 2 }] }
    await repo.salvarKitVenda(kit)
    perto(motor.kitVendaResumo(kit).custo, 192)
    const gravado = await repo.salvarOrcamento(novo)
    assert.ok(gravado.id)
    await repo.salvarMaterial({ ...metal, preco: 12 })
    const atualizado = new Motor(await repo.carregarDB())
    perto(atualizado.calc(novo).custoMat, 456)
    perto(atualizado.calc(gravado).custoMat, 426)
    const emitida = await repo.salvarOrcamento({ ...gravado, status: 'Proposta' })
    await assert.rejects(repo.salvarOrcamento({ ...emitida, markup: 60 }), /foi emitida/)
    const revisao = await repo.salvarOrcamento({ ...emitida, id: '', origemId: emitida.id, status: 'Rascunho' })
    perto(atualizado.calc(revisao).custoMat, 426)
    assert.notEqual(revisao.rev, emitida.rev)
    const recalculada = await repo.salvarOrcamento({ ...revisao, referenciaPrecos: undefined })
    perto(atualizado.calc(recalculada).custoMat, 456)
    await assert.rejects(repo.salvarOrcamento({ ...revisao, obra: 'Concorrente' }), /outra sessão/)
    await assert.rejects(repo.salvarSeparacao(emitida.id, {status:'Pendente',conf:{},responsavel:'Teste',obs:'',iniciado:'',concluido:''}), /pedido liberado/)
    console.log('OK: referência de preços, revisão imutável, recálculo explícito, concorrência e conferência de insumos.')
    console.log('OK: composição gravada, custo por unidade/área/largura, peso, consumo e atualização do custo do insumo.')

    const comFerragem = { ...produto, kitId: 'KIT-PC3', aces: [{ acesId: 'FE50', qtd: 2 }] }
    perto(motor.custoNaMedida(comFerragem), 96 + motor.kitCusto('KIT-PC3') + 100)
    perto(motor.custoMateriaPrima({ ...metal, corId: 'RAL9005' }), 41.9)
    await assert.rejects(repo.salvarMaterial({ ...produto, composicao: [{ materialId: base.id, qtd: 1, base: 'UN' }] }), /somente matérias-primas/)
    await assert.rejects(repo.salvarMaterial({ ...produto, composicao: [{ materialId: metal.id, qtd: 0, base: 'UN' }] }), /maior que zero/)
    await assert.rejects(repo.salvarMaterial({ ...produto, composicao: [produto.composicao[0], produto.composicao[0]] }), /repetida/)
    await assert.rejects(repo.salvarMaterial({ ...produto, composicao: [{ materialId: produto.id, qtd: 1, base: 'UN' }] }), /válidas/)
    await assert.rejects(repo.salvarMaterial({ ...metal, categoria: 'produto' }), /em uso/)
    await assert.rejects(repo.excluir('materiais', metal.id))
    await assert.rejects(repo.salvarKitVenda({ ...kit, itens: [{ matId: metal.id, qtd: 1 }] }), /matéria-prima/)
    await assert.rejects(repo.salvarOrcamento({ ...novo, itens: [{ ...novo.itens[0], matId: metal.id }] }), /matéria-prima/)
    assert.equal(kitSomenteProdutos(kit, db.materiais), true)
    assert.equal(kitSomenteProdutos({ ...kit, itens: [{ matId: metal.id, qtd: 1 }] }, db.materiais), false)
    console.log('OK: produtos/insumos não se misturam em composições, orçamentos e kits; vínculos protegidos.')

    const antiga = db.orcamentos.find(o => o.itens.some(it => ehMateriaPrima(db.materiais.find(m => m.id === it.matId))))!
    assert.ok(antiga)
    if(antiga.status==='Rascunho') await repo.salvarOrcamento(antiga)
    else await assert.rejects(repo.salvarOrcamento(antiga))
    await repo.salvarOrcamento({ ...antiga, id: '', origemId: antiga.id, status:'Rascunho' })
    const insumoAntigo = antiga.itens.find(it => ehMateriaPrima(db.materiais.find(m => m.id === it.matId)))!
    await assert.rejects(repo.salvarOrcamento({ ...antiga, atualizadoEm: undefined, itens: [...antiga.itens, insumoAntigo] }), /matéria-prima|foi emitida|ações do fluxo|outra sessão/)
    console.log('OK: propostas antigas podem ser salvas e revisadas, sem lançar novos insumos avulsos.')
  } finally {
    await encerrar()
    if (opcoesAnteriores === undefined) delete process.env.PGOPTIONS
    else process.env.PGOPTIONS = opcoesAnteriores
    if (criou) await controle.query(`DROP SCHEMA "${schema}" CASCADE`)
    await controle.end()
  }
}

main().catch(e => { console.error(e); process.exitCode = 1 })
