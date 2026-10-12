import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { Client } from 'pg'
import { DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from '../electron/db/credentials'
import { comCliente, conectar, encerrar } from '../electron/db/pool'
import { simplificarSituacoes } from '../electron/db/migrate'
import * as repo from '../electron/db/repo'
import { executarNegocio, dadosPorPerfil } from '../electron/db/negocio'
import { Motor } from '../src/calc'
import { nomeProposta, type ComandoNegocio, type Usuario } from '../src/shared/types'
const schema='estrudena_teste_negocio_'+randomBytes(8).toString('hex')
const controle=new Client({host:'127.0.0.1',port:DB_PORT,database:DB_NAME,user:DB_USER,password:DB_PASSWORD})
async function main(){
 await controle.connect();await controle.query(`CREATE SCHEMA "${schema}"`);process.env.PGOPTIONS=`-c search_path=${schema}`
 try{
  assert.equal((await conectar('127.0.0.1')).status,'conectado');await repo.restaurarExemplo()
  let db=await repo.carregarDB();const admin:Usuario={id:'teste',nome:'Teste',usuario:'teste',perfil:'Administrador',ativo:true}
  const op={...admin,perfil:'Produção' as const};const vendedor={...admin,perfil:'Vendedor' as const}
  const materia=db.materiais.find(m=>m.categoria==='materia_prima')!
  const produto={...db.materiais.find(m=>m.categoria==='produto')!,id:'fluxo-porta',cod:'FLUXO-PORTA',unidade:'UN' as const,kitId:'',aces:[],composicao:[{materialId:materia.id,qtd:2,base:'UN' as const}]}
  await repo.salvarMaterial(produto)
  const base=db.orcamentos[0]
  let o=await repo.salvarOrcamento({...base,id:'',numero:'(automático)',atualizadoEm:undefined,referenciaPrecos:undefined,status:'Rascunho',obra:'Teste de fluxo',itens:[{...base.itens[0],matId:produto.id,qtd:4,larg:1000,alt:2000}]},admin.nome)
  assert.equal(o.rev,'rev1');assert.equal(nomeProposta(o),o.numero+'.rev1')
  const primeira=o
  o=await repo.salvarOrcamento({...o,obra:'Teste de fluxo editado'},admin.nome);assert.equal(o.rev,'rev2');assert.notEqual(o.id,primeira.id)
  assert.equal((await repo.salvarOrcamento(o)).rev,'rev2')
  await assert.rejects(repo.salvarOrcamento({...primeira,obra:'Sessão antiga'}),/outra sessão|mais recente/)
  o=await repo.salvarOrcamento({...o,status:'Proposta'});assert.equal(o.rev,'rev2');assert.ok(o.validadeAte)
  await assert.rejects(repo.salvarOrcamento({...o,status:'Aprovado'}),/ações do fluxo/)
  const cmd=async(c:ComandoNegocio,u=admin)=>executarNegocio(await repo.carregarDB(),c,u)
  await assert.rejects(cmd({acao:'aprovar',id:o.id,atualizadoEm:o.atualizadoEm},op),/comercial/)
  await assert.rejects(cmd({acao:'aprovar',id:o.id,atualizadoEm:o.atualizadoEm}),/quem aprovou/)
  await cmd({acao:'enviar',id:o.id,atualizadoEm:o.atualizadoEm,motivo:'E-mail arquivado'})
  o=(await repo.carregarDB()).orcamentos.find(x=>x.id===o.id)!
  assert.ok(o.enviadaEm);assert.equal(o.status,'Enviada')
  await assert.rejects(cmd({acao:'negociar',id:o.id,atualizadoEm:o.atualizadoEm}),/unificada/)
  const aceite:ComandoNegocio={acao:'aprovar',id:o.id,atualizadoEm:o.atualizadoEm,responsavel:'Cliente de teste',evidencia:'Documento assinado',instalacaoContratada:true}
  await Promise.all([cmd(aceite),cmd(aceite)])
  db=await repo.carregarDB();assert.equal(db.pedidos?.filter(p=>p.numero===o.numero).length,1)
  let p=db.pedidos!.find(p=>p.numero===o.numero)!
  const atualizar=async()=>{db=await repo.carregarDB();p=db.pedidos!.find(x=>x.id===p.id)!}
  const pc=async(c:Omit<ComandoNegocio,'id'>)=>{await cmd({...c,id:p.id,versao:c.versao??p.versao});await atualizar()}
  const aprovado=db.orcamentos.find(x=>x.id===o.id)!
  const rev3=await repo.salvarOrcamento({...aprovado,id:'',origemId:aprovado.id,status:'Rascunho',obra:'Aditivo não aceito'})
  await atualizar();assert.equal(p.orcamentoId,aprovado.id);assert.equal(p.proposta.obra,'Teste de fluxo editado')
  assert.equal(rev3.rev,'rev3');assert.equal(p.total,new Motor(db).calc(aprovado).total)
  await assert.rejects(pc({acao:'liberar',data:'2026-12-01'}),/medidas/)
  await pc({acao:'liberar',data:'2026-12-01',medidasConferidas:true,requisitosConferidos:true})
  await assert.rejects(pc({acao:'planejar',data:'2026-12-02',versao:1}),/outra sessão/)
  const s={status:'Em separação' as const,conf:{'0':4},insumos:{['mp:'+materia.id]:8},responsavel:'Conferente',obs:'',iniciado:'',concluido:''}
  await assert.rejects(repo.salvarSeparacao(o.id,{...s,conf:{'0':5}}),/acima do pedido/)
  await repo.salvarSeparacao(o.id,s,admin.nome);await atualizar()
  const salvo=db.separacoes[o.id];await assert.rejects(repo.salvarSeparacao(o.id,s),/Outra pessoa/)
  await assert.rejects(repo.salvarSeparacao(o.id,{...salvo,status:'Concluída',insumos:{}}),/todos os produtos/)
  // v8: concluir a separação já põe o pedido em fabricação; fabricação e conferência final são uma ação.
  await repo.salvarSeparacao(o.id,{...salvo,status:'Concluída'});await atualizar();assert.equal(p.etapa,'Em fabricação')
  await assert.rejects(pc({acao:'conferir',responsavel:'Fábrica'}),/qualidade/)
  await pc({acao:'conferir',responsavel:'Fábrica',requisitosConferidos:true});assert.equal(p.etapa,'Pronta para expedição')
  await assert.rejects(pc({acao:'concluir'}),/a entregar/)
  await pc({acao:'entrega',entrega:{id:'',data:'2026-12-01',status:'Programada',responsavel:'Motorista',comprovante:'',quantidades:{0:2}}})
  const e=p.entregas[0]
  await assert.rejects(pc({acao:'entrega',entrega:{...e,status:'Em transporte' as never}}),/inválida/)
  await assert.rejects(pc({acao:'entrega',entrega:{...e,status:'Entregue'}}),/comprovante/)
  await pc({acao:'entrega',entrega:{...e,status:'Entregue',comprovante:'Recibo 1'}})
  await assert.rejects(pc({acao:'entrega',entrega:{...p.entregas[0],status:'Ocorrência',comprovante:'Avaria'}}),/imutável/)
  await assert.rejects(pc({acao:'entrega',entrega:{id:'',data:'2026-12-02',status:'Programada',responsavel:'Motorista',comprovante:'',quantidades:{0:3}}}),/excede o saldo/)
  // Entrega registrada já entregue, sem agendar antes. A instalação contratada segura a conclusão.
  await pc({acao:'entrega',entrega:{id:'',data:'2026-12-02',status:'Entregue',responsavel:'Motorista',comprovante:'Recibo 2',quantidades:{0:2}}})
  assert.equal(p.status,'Em execução')
  await assert.rejects(pc({acao:'concluir'}),/instalação/)
  await assert.rejects(pc({acao:'instalacao',instalacao:'Em execução' as never,data:'2026-12-03',responsavel:'Instaladores'}),/inválida/)
  await pc({acao:'instalacao',instalacao:'Programada',data:'2026-12-03',responsavel:'Instaladores'})
  await pc({acao:'instalacao',instalacao:'Programada',data:'2026-12-04',responsavel:'Instaladores',motivo:'Pendência: reagendada a pedido do cliente'})
  await assert.rejects(pc({acao:'instalacao',instalacao:'Concluída',data:'2026-12-04',responsavel:'Instaladores'}),/aceite/)
  // A instalação concluída encerra o pedido, sem a ação "Concluir pedido".
  await pc({acao:'instalacao',instalacao:'Concluída',data:'2026-12-04',responsavel:'Instaladores',motivo:'Aceite do cliente'})
  assert.equal(p.status,'Concluído');assert.equal(p.etapa,'Concluída')
  await assert.rejects(pc({acao:'cancelar',motivo:'Teste'}),/encerrado/)
  const dto=dadosPorPerfil(db,op);assert.equal(dto.pedidos!.find(x=>x.id===p.id)!.total,0);assert.equal(dto.pedidos!.find(x=>x.id===p.id)!.proposta.markup,0);assert.equal(dto.orcamentos.some(x=>x.id===rev3.id),false)
  assert.ok(db.eventos!.filter(x=>x.numero===p.numero).length>=13)
  // Aditivo antes de entrega: aceite administrativo, reinício operacional e conferência antiga preservada.
  let a=await repo.salvarOrcamento({...primeira,id:'',numero:'(automático)',atualizadoEm:undefined,status:'Proposta'})
  await cmd({...aceite,id:a.id,atualizadoEm:a.atualizadoEm});db=await repo.carregarDB();a=db.orcamentos.find(x=>x.id===a.id)!
  let ad=await repo.salvarOrcamento({...a,id:'',origemId:a.id,status:'Proposta',obra:'Aditivo aprovado'})
  const pa=db.pedidos!.find(x=>x.numero===a.numero)!
  await assert.rejects(cmd({...aceite,id:ad.id,atualizadoEm:ad.atualizadoEm,versao:pa.versao,impactoConfirmado:true,motivo:'Ajuste de preço e prazo'},vendedor),/administrador/)
  await cmd({...aceite,id:ad.id,atualizadoEm:ad.atualizadoEm,versao:pa.versao,impactoConfirmado:true,motivo:'Ajuste de preço e prazo'})
  db=await repo.carregarDB();const pad=db.pedidos!.find(x=>x.id===pa.id)!
  assert.equal(pad.orcamentoId,ad.id);assert.equal(pad.revisoesAnteriores[0].proposta.id,a.id);assert.equal(pad.etapa,'Aguardando liberação')
  await cmd({acao:'cancelar',id:pad.id,versao:pad.versao,motivo:'Cliente cancelou; sem materiais consumidos'})
  await assert.rejects(repo.excluir('orcamentos',ad.id),/histórico/)
  // Validade vencida: aparece como Expirada sem ação manual e não pode mais ser aprovada.
  let v=await repo.salvarOrcamento({...primeira,id:'',numero:'(automático)',atualizadoEm:undefined,referenciaPrecos:undefined,status:'Proposta'})
  await controle.query(`UPDATE "${schema}".orcamentos SET validade_ate='2000-01-01' WHERE id=$1`,[v.id])
  v=(await repo.carregarDB()).orcamentos.find(x=>x.id===v.id)!
  assert.equal(v.status,'Expirada')
  await assert.rejects(cmd({acao:'aprovar',id:v.id,atualizadoEm:v.atualizadoEm,responsavel:'Cliente',evidencia:'E-mail'}),/expirada/i)
  // Migração v8: situações antigas convertidas, sem apagar o pedido.
  db=await repo.carregarDB();const cancelado=db.pedidos!.find(x=>x.id===pad.id)!
  const antigo={...cancelado,status:'Em execução',etapa:'Em conferência',instalacao:'Pendência',entregas:[{id:'e-antiga',data:'2026-12-01',status:'Em transporte',responsavel:'Motorista',comprovante:'',quantidades:{0:1}}]}
  await controle.query(`UPDATE "${schema}".pedidos_venda SET dados=$2 WHERE id=$1`,[pad.id,JSON.stringify(antigo)])
  await controle.query(`UPDATE "${schema}".orcamentos SET status='Em análise' WHERE id=$1`,[a.id])
  await comCliente(c=>simplificarSituacoes(c))
  const migrado=(await repo.carregarDB()).pedidos!.find(x=>x.id===pad.id)!
  assert.deepEqual([migrado.etapa,migrado.instalacao,migrado.entregas[0].status,migrado.versao],['Em fabricação','Programada','Programada',cancelado.versao+1])
  assert.equal((await controle.query(`SELECT status FROM "${schema}".orcamentos WHERE id=$1`,[a.id])).rows[0].status,'Enviada')
  console.log('OK: rev1/rev2, histórico, no-op, concorrência, emissão/envio, aprovação idempotente e permissões.')
  console.log('OK: pedido congelado, aditivo, liberação, separação validada, fabricação e qualidade.')
  console.log('OK: entregas parciais, saldo, comprovante, instalação, encerramento, cancelamento e auditoria.')
  console.log('OK: v8 — separação avança, fabricação conferida, entrega direta, instalação simplificada, conclusão automática, expiração calculada e migração.')
 }finally{await encerrar();await controle.query(`DROP SCHEMA "${schema}" CASCADE`);await controle.end()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
