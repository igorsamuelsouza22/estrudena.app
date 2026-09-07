import type { PoolClient } from 'pg'
import { comCliente } from './pool'
import { DEPENDENCIAS, PERFIS, RECURSOS, pode, type MatrizPermissoes, type PoliticaPermissoes, type Permissao } from '../../src/permissoes'
import type { Usuario } from '../../src/shared/types'
export async function lerPermissoes(c?:PoolClient):Promise<PoliticaPermissoes>{
 const ler=async(c:PoolClient)=>{const r=(await c.query('SELECT * FROM permissoes_perfis WHERE id')).rows[0];if(!r)throw new Error('Política de acesso indisponível. Reconecte ao servidor.');return {matriz:r.matriz,versao:r.versao,atualizadoPor:r.atualizado_por,atualizadoEm:r.atualizado_em.toISOString()}}
 return c?ler(c):comCliente(ler)
}
export async function salvarPermissoes(matriz:MatrizPermissoes,versao:number,usuario:Usuario){
 if(usuario.perfil!=='Administrador'||!usuario.ativo)throw new Error('Somente administradores podem alterar a matriz.')
 if(!matriz||Object.keys(matriz).some(k=>!PERFIS.includes(k as any)))throw new Error('Perfis inválidos na matriz.')
 for(const perfil of PERFIS){
  const valores=matriz[perfil]
  if(!valores||Object.keys(valores).length!==RECURSOS.length)throw new Error('A matriz deve conter todas as permissões.')
  for(const [p] of RECURSOS){
   if(typeof valores[p]!=='boolean')throw new Error('Informe permissões válidas.')
   if(perfil==='Administrador'&&!valores[p]||perfil!=='Administrador'&&p==='usuarios'&&valores[p])throw new Error('A administração de acessos é exclusiva dos administradores e não pode ser removida.')
   if(valores[p]&&(DEPENDENCIAS[p]||[]).some(dep=>!pode(matriz,perfil,dep)))throw new Error(`A permissão ${p} depende de outras áreas. Revise a matriz.`)
  }
 }
 await comCliente(async c=>{
  await c.query('BEGIN')
  try{
   const u=(await c.query('SELECT perfil,ativo FROM usuarios WHERE id=$1 FOR SHARE',[usuario.id])).rows[0]
   if(!u?.ativo||u.perfil!=='Administrador')throw new Error('A conta não tem mais permissão para alterar acessos.')
   const atual=(await c.query('SELECT * FROM permissoes_perfis WHERE id FOR UPDATE')).rows[0]
   if(atual.versao!==versao)throw new Error('A matriz foi alterada em outra sessão. Recarregue antes de salvar.')
   await c.query('UPDATE permissoes_perfis SET matriz=$1,versao=versao+1,atualizado_por=$2,atualizado_em=clock_timestamp() WHERE id',[JSON.stringify(matriz),usuario.nome])
   await c.query('INSERT INTO permissoes_historico(autor_id,autor_nome,anterior,nova) VALUES($1,$2,$3,$4)',[usuario.id,usuario.nome,JSON.stringify(atual.matriz),JSON.stringify(matriz)])
   await c.query('COMMIT')
  }catch(e){await c.query('ROLLBACK');throw e}
 })
}
export function exigirPermissao(politica:PoliticaPermissoes,usuario:Usuario,p:Permissao){if(!pode(politica.matriz,usuario.perfil,p))throw new Error('Seu perfil não tem permissão para esta ação: '+(RECURSOS.find(x=>x[0]===p)?.[1]||p)+'.')}
