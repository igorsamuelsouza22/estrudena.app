import {createRequire} from 'node:module'
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {randomBytes,createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url),{_electron}=require(process.env.PLAYWRIGHT_PATH||'playwright'),{Client}=require('pg')
const cred=readFileSync('electron/db/credentials.ts','utf8'),value=k=>cred.match(new RegExp(k+"\\s*=\\s*'([^']+)'"))[1]
const id=randomBytes(8).toString('hex'),schema='estrudena_teste_updater_'+id,pasta=mkdtempSync(join(tmpdir(),'estrudena-updater-'))
const c=new Client({host:'127.0.0.1',port:5432,database:value('DB_NAME'),user:value('DB_USER'),password:value('DB_PASSWORD')})
const driver=join(pasta,'driver.cjs'),versao=JSON.parse(readFileSync('package.json','utf8')).version
writeFileSync(join(pasta,'app-update.yml'),JSON.stringify({updaterCacheDirName:'estrudena-teste-'+id}))
writeFileSync(driver,`
const {app,BrowserWindow}=require('electron');
app.setName('estrudena-teste-${id}');app.setPath('userData',${JSON.stringify(pasta)});
const {ElectronAppAdapter}=require(${JSON.stringify(resolve('node_modules/electron-updater/out/ElectronAppAdapter.js'))});
Object.defineProperty(ElectronAppAdapter.prototype,'appUpdateConfigPath',{get:()=>${JSON.stringify(join(pasta,'app-update.yml'))}});
app.getVersion=()=>${JSON.stringify(versao)};Object.defineProperty(app,'isPackaged',{value:true});
BrowserWindow.prototype.show=function(){this.setOpacity(0);this.showInactive()};BrowserWindow.prototype.maximize=function(){};
const {NsisUpdater}=require(${JSON.stringify(resolve('node_modules/electron-updater'))});
global.instalacoes=[];NsisUpdater.prototype.quitAndInstall=function(silent,restart){global.instalacoes.push({silent,restart,autoInstallOnAppQuit:this.autoInstallOnAppQuit})};
require(${JSON.stringify(resolve('dist-electron/main.js'))});
`)
await c.connect();await c.query(`CREATE SCHEMA "${schema}"`)
let app
const iniciar=async()=>{
 const env={...process.env,PGOPTIONS:'-c search_path='+schema};delete env.ELECTRON_RUN_AS_NODE;delete env.ESTRUDENA_DEV_URL
 app=await _electron.launch({executablePath:require('electron'),args:[driver],env,timeout:30000})
 app.process().stderr.on('data',b=>{const s=b.toString();if(!/Autofill|DevTools|GPU/.test(s))process.stderr.write(s)})
 console.log('Electron de teste iniciado')
 const page=await app.firstWindow();page.setDefaultTimeout(30000)
 await page.locator('input[autocomplete=username]').waitFor()
 console.log('Tela de login pronta')
 return page
}
const sair=async()=>{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});app=null}}
const entrar=async page=>{
 await page.locator('input[autocomplete=username]').fill('wilson');await page.locator('input[autocomplete=current-password]').fill('estrudena')
 await page.getByRole('button',{name:'Entrar',exact:true}).press('Enter')
 await page.getByRole('button',{name:'Atualizar e reiniciar',exact:true}).waitFor()
 return page.evaluate(async()=>(await window.estrudena.atualizacaoPendente()).dados.caminho)
}
try{
 let page=await iniciar()
 const exe=Buffer.concat([Buffer.from('MZ'),randomBytes(1024*1024)])
 await c.query(`INSERT INTO "${schema}".versoes(versao,publicado_por,notas,arquivo,tamanho,sha256,conteudo) VALUES($1,$2,$3,$4,$5,$6,$7)`,['9.9.9','Teste','Atualização isolada de teste','teste.exe',exe.length,createHash('sha256').update(exe).digest('hex'),exe])
 await c.query(`UPDATE "${schema}".config SET github_repo='' WHERE id`)
 let caminho=await entrar(page)
 assert.equal(createHash('sha512').update(readFileSync(caminho)).digest('hex'),createHash('sha512').update(exe).digest('hex'))
 await page.locator('nav').getByRole('button',{name:'Pessoas e acessos',exact:true}).press('Enter')
 await page.getByRole('checkbox',{name:'Matérias-primas — Produção',exact:true}).check()
 const bloqueado=await page.evaluate(p=>window.estrudena.abrirInstalador(p),caminho)
 assert.equal(bloqueado.ok,false);assert.match(bloqueado.erro,/matriz com alterações/)
 await page.getByRole('button',{name:'Atualizar e reiniciar',exact:true}).press('Enter')
 await page.getByRole('alert').filter({hasText:'matriz com alterações'}).waitFor()
 await page.getByRole('button',{name:'Descartar alterações',exact:true}).press('Enter')
 assert.equal((await page.evaluate(()=>window.estrudena.abrirInstalador('C:/Windows/notepad.exe'))).ok,false)
 assert.equal((await page.evaluate(()=>window.estrudena.baixarVersao('1.0.0'))).ok,false)
 writeFileSync(caminho,Buffer.from('alterado'))
 const corrompido=await page.evaluate(p=>window.estrudena.abrirInstalador(p),caminho);assert.equal(corrompido.ok,false);assert.match(corrompido.erro,/alterado/)
 writeFileSync(caminho,exe)
 assert.deepEqual(await app.evaluate(()=>global.instalacoes),[])
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await app.close();app=null
 page=await iniciar();caminho=await entrar(page)
 const instalado=await page.evaluate(p=>window.estrudena.abrirInstalador(p),caminho);assert.equal(instalado.ok,true)
 assert.deepEqual(await app.evaluate(()=>global.instalacoes),[{silent:true,restart:true,autoInstallOnAppQuit:false}])
 assert.equal((await page.evaluate(p=>window.estrudena.abrirInstalador(p),caminho)).ok,false)
 console.log('OK: updater real com feed offline, checksum, recuperação após reabrir, edição pendente, caminho arbitrário, downgrade e instalação silenciosa com reinício. Nenhum instalador foi executado.')
}finally{await sair();await c.query(`DROP SCHEMA "${schema}" CASCADE`);await c.end()}
