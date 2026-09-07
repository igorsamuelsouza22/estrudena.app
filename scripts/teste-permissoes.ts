import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { Client } from 'pg'
import { DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from '../electron/db/credentials'
import { conectar, encerrar, comCliente } from '../electron/db/pool'
import * as repo from '../electron/db/repo'
import { dadosPorPerfil, executarNegocio } from '../electron/db/negocio'
import { lerPermissoes, salvarPermissoes, exigirPermissao } from '../electron/db/permissoes'
import { alterarPermissao, matrizPadrao, pode, RECURSOS } from '../src/permissoes'

const schema='estrudena_teste_permissoes_'+randomBytes(8).toString('hex')
const controle=new Client({host:'127.0.0.1',port:DB_PORT,database:DB_NAME,user:DB_USER,password:DB_PASSWORD})
async function main(){
 await controle.connect();await controle.query(`CREATE SCHEMA "${schema}"`);process.env.PGOPTIONS=`-c search_path=${schema}`
 try{
  assert.equal((await conectar('127.0.0.1')).status,'conectado');await repo.restaurarExemplo()
  let db=await repo.carregarDB()
  const admin=db.usuarios.find(u=>u.perfil==='Administrador')!,op=db.usuarios.find(u=>u.perfil==='Produção')!
  assert.ok(admin&&op)
  let politica=await lerPermissoes()
  assert.equal(politica.versao,1);assert.deepEqual(politica.matriz,matrizPadrao())
  assert.throws(()=>exigirPermissao(politica,op,'materias_primas'),/permissão/)
  await assert.rejects(salvarPermissoes(politica.matriz,1,op),/administradores/)
  await assert.rejects(salvarPermissoes(politica.matriz,1,{...admin,id:'inexistente'}),/conta/)
  for(const [perfil,cap] of [['Administrador','valores'],['Produção','usuarios']] as const){
   const invalida=structuredClone(politica.matriz);invalida[perfil][cap]=!invalida[perfil][cap]
   await assert.rejects(salvarPermissoes(invalida,1,admin),/administração/)
  }
  const semDependencia=structuredClone(politica.matriz);semDependencia.Produção.produtos=true
  await assert.rejects(salvarPermissoes(semDependencia,1,admin),/depende/)
  const concedida=alterarPermissao(politica.matriz,'Produção','materias_primas',true)
  assert.ok(concedida.Produção.valores)
  await salvarPermissoes(concedida,1,admin)
  politica=await lerPermissoes();assert.equal(politica.versao,2)
  assert.doesNotThrow(()=>exigirPermissao(politica,op,'materias_primas'))
  await assert.rejects(salvarPermissoes(matrizPadrao(),1,admin),/outra sessão/)
  const concorrentes=await Promise.allSettled([salvarPermissoes(concedida,2,admin),salvarPermissoes(concedida,2,admin)])
  assert.equal(concorrentes.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(concorrentes.filter(r=>r.status==='rejected').length,1)
  db=await repo.carregarDB();assert.ok(dadosPorPerfil(db,op).materiais.some(m=>m.preco>0))
  politica=await lerPermissoes()
  let revogada=alterarPermissao(politica.matriz,'Produção','valores',false)
  assert.equal(revogada.Produção.materias_primas,false)
  revogada=alterarPermissao(revogada,'Produção','pedidos',false)
  assert.equal(revogada.Produção.producao,false);assert.equal(revogada.Produção.planejamento,false)
  await salvarPermissoes(revogada,politica.versao,admin)
  db=await repo.carregarDB();const restrito=dadosPorPerfil(db,op)
  assert.deepEqual(restrito.pedidos,[]);assert.deepEqual(restrito.orcamentos,[]);assert.deepEqual(restrito.materiais,[])
  assert.deepEqual(restrito.usuarios,[op])
  await assert.rejects(executarNegocio(db,{acao:'planejar',id:'inexistente'},op),/não permite/)
  assert.ok(db.orcamentos.length>0,'Redação não pode alterar o banco original')
  let relatorios=matrizPadrao();for(const [cap] of RECURSOS)relatorios.Produção[cap]=false
  relatorios=alterarPermissao(relatorios,'Produção','relatorios',true)
  db.permissoes!.matriz=relatorios
  assert.equal(dadosPorPerfil(db,op).orcamentos.length,db.orcamentos.length)
  assert.equal(pode(relatorios,'Produção','orcamentos'),false,'Relatórios não concedem edição')
  await assert.rejects(repo.salvarUsuario({...admin,ativo:false},admin.id),/própria conta/)
  await assert.rejects(repo.salvarUsuario({...admin,perfil:'Vendedor'},admin.id),/próprio perfil/)
  for(const outro of db.usuarios.filter(u=>u.perfil==='Administrador'&&u.id!==admin.id))await repo.salvarUsuario({...outro,ativo:false},admin.id)
  await assert.rejects(repo.salvarUsuario({...admin,ativo:false},'outro'),/administrador ativo/)
  await assert.rejects(repo.excluir('usuarios',admin.id,admin.id),/desativ/i)
  const auditoria=await comCliente(c=>c.query('SELECT * FROM permissoes_historico ORDER BY id'))
  assert.equal(auditoria.rows.length,3);assert.equal(auditoria.rows[0].autor_id,admin.id)
  assert.deepEqual(auditoria.rows[0].anterior,matrizPadrao());assert.deepEqual(auditoria.rows[0].nova,concedida)
  await encerrar();assert.equal((await conectar('127.0.0.1')).status,'conectado')
  assert.deepEqual((await lerPermissoes()).matriz,revogada,'Permissões persistem após reconectar e migrar novamente')
  console.log('OK: matriz persistente, dependências, concessão/revogação, dados filtrados, concorrência, auditoria e proteção dos administradores.')
 }finally{await encerrar();await controle.query(`DROP SCHEMA "${schema}" CASCADE`);await controle.end()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
