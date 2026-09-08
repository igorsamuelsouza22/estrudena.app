import { app } from 'electron'
import { NsisUpdater } from 'electron-updater'
import { createHash, randomBytes } from 'node:crypto'
import { createReadStream, promises as fs } from 'node:fs'
import { createServer, type Server } from 'node:http'
import path from 'node:path'
import type { VersaoPublicada } from '../src/shared/types'

export async function hashArquivo(arquivo:string){
 const h=createHash('sha512');for await(const parte of createReadStream(arquivo))h.update(parte)
 return h.digest('base64')
}

/** Adapta o canal offline já verificado ao protocolo do electron-updater.
 * Escuta apenas no próprio computador, com endereço aleatório e sem CORS. */
export async function feedLocal(arquivo:string,versao:string){
 const token=randomBytes(24).toString('hex'), tamanho=(await fs.stat(arquivo)).size,sha512=await hashArquivo(arquivo)
 const nome='Sistema-Estrudena-Setup-'+versao+'.exe'
 const info={version:versao,files:[{url:nome,sha512,size:tamanho,isAdminRightsRequired:true}],path:nome,sha512,releaseDate:new Date().toISOString()}
 const servidor=createServer((req,res)=>{
  const rota=req.url?.split('?')[0]
  if(!['GET','HEAD'].includes(req.method||'')){res.writeHead(405).end();return}
  if(rota===`/${token}/latest.yml`){res.setHeader('Content-Type','application/yaml');res.end(JSON.stringify(info));return}
  if(rota!==`/${token}/${nome}`){res.writeHead(404).end();return}
  res.setHeader('Content-Length',tamanho);res.setHeader('Content-Type','application/octet-stream')
  if(req.method==='HEAD'){res.end();return}
  const stream=createReadStream(arquivo);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res)
 })
 await new Promise<void>((resolve,reject)=>{servidor.once('error',reject);servidor.listen(0,'127.0.0.1',()=>resolve())})
 const porta=(servidor.address() as {port:number}).port
 return {url:`http://127.0.0.1:${porta}/${token}/`,servidor}
}

export class Atualizador {
 private updater:NsisUpdater|null=null
 private servidor:Server|null=null
 private pendente:{versao:string;caminho:string;sha512:string}|null=null
 private tarefa:Promise<string>|null=null
 private instalando=false
 constructor(private progresso:(p:{recebido:number;total:number})=>void){}
 get pronto(){return this.pendente?{versao:this.pendente.versao,caminho:this.pendente.caminho}:null}
 async baixar(v:VersaoPublicada,repo:string,baixarBanco:(pasta:string)=>Promise<string>){
  if(this.instalando)throw Error('A atualização já está sendo aplicada.')
  if(this.tarefa)return this.tarefa
  if(this.pendente?.versao===v.versao&&await hashArquivo(this.pendente.caminho).catch(()=>null)===this.pendente.sha512)return this.pendente.caminho
  this.tarefa=this.preparar(v,repo,baixarBanco)
  try{return await this.tarefa}finally{this.tarefa=null}
 }
 private async preparar(v:VersaoPublicada,repo:string,baixarBanco:(pasta:string)=>Promise<string>){
  this.pendente=null;this.servidor?.close();this.servidor=null
  let url:string
  if(v.origem==='github')url=`https://github.com/${repo}/releases/download/v${v.versao}/`
  else {
   const arquivo=await baixarBanco(path.join(app.getPath('userData'),'atualizacao-servidor'))
   const feed=await feedLocal(arquivo,v.versao);url=feed.url;this.servidor=feed.servidor
  }
  const updater=new NsisUpdater({provider:'generic',url,useMultipleRangeRequest:false})
  this.updater=updater
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowDowngrade=false;updater.allowPrerelease=false
  updater.disableWebInstaller=true
  // O canal do banco já fornece o arquivo integral; não há blockmap remoto.
  updater.disableDifferentialDownload=v.origem!=='github'
  updater.on('error',e=>console.error('[atualizacao]',e.message))
  updater.on('download-progress',p=>this.progresso({recebido:p.transferred,total:p.total}))
  try{
   const resultado=await updater.checkForUpdates()
   if(!resultado||resultado.updateInfo.version!==v.versao)throw Error('A versão disponível mudou. Verifique a atualização novamente.')
   const [arquivo]=await updater.downloadUpdate()
   if(!arquivo)throw Error('O download não produziu um instalador válido.')
   const sha512=await hashArquivo(arquivo)
   if(!resultado.updateInfo.files.some(f=>f.sha512===sha512))throw Error('A integridade da atualização não confere. Baixe novamente.')
   this.pendente={versao:v.versao,caminho:arquivo,sha512}
   this.progresso({recebido:(await fs.stat(arquivo)).size,total:(await fs.stat(arquivo)).size})
   return arquivo
  }finally{this.servidor?.close();this.servidor=null}
 }
 async instalar(caminho:string){
  if(!app.isPackaged)throw Error('A atualização só pode ser aplicada no aplicativo instalado.')
  if(this.instalando)throw Error('A atualização já está sendo aplicada.')
  if(!this.updater||!this.pendente||path.resolve(caminho)!==path.resolve(this.pendente.caminho))throw Error('Baixe a atualização pelo aplicativo antes de continuar.')
  if(await hashArquivo(caminho)!==this.pendente.sha512)throw Error('O instalador foi alterado. Baixe a atualização novamente.')
  this.instalando=true
  this.updater.quitAndInstall(true,true)
 }
}
