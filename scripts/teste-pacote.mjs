import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {_electron}=require(process.env.PLAYWRIGHT_PATH||'playwright')
const {Client}=require('pg')
const cred=readFileSync('electron/db/credentials.ts','utf8')
const value=key=>cred.match(new RegExp(key+"\\s*=\\s*'([^']+)'"))[1]
const schema='estrudena_teste_pacote_'+randomBytes(8).toString('hex')
const c=new Client({host:'127.0.0.1',port:5432,database:value('DB_NAME'),user:value('DB_USER'),password:value('DB_PASSWORD')})
const exe=resolve('release/win-unpacked/Sistema Estrudena.exe')
assert.ok(existsSync(exe));assert.ok(existsSync('release/win-unpacked/resources/pgsql.7z'))
assert.ok(existsSync('release/win-unpacked/resources/app-update.yml'))
const dados=mkdtempSync(join(tmpdir(),'estrudena-pacote-'))
await c.connect();await c.query(`CREATE SCHEMA "${schema}"`)
let app
try{
 const env={...process.env,PGOPTIONS:'-c search_path='+schema}
 delete env.ELECTRON_RUN_AS_NODE;delete env.ESTRUDENA_DEV_URL
 app=await _electron.launch({executablePath:exe,args:['--user-data-dir='+dados],env})
 assert.equal(await app.evaluate(({app})=>app.isPackaged),true)
 assert.equal(await app.evaluate(({app})=>app.getVersion()),JSON.parse(readFileSync('package.json','utf8')).version)
 const page=await app.firstWindow();const erros=[];page.on('pageerror',e=>erros.push(e.message))
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.hide()))
 await page.locator('input[autocomplete=username]').waitFor({timeout:30000})
 const bloqueado=await page.evaluate(()=>window.estrudena.carregar());assert.equal(bloqueado.ok,false)
 await page.locator('input[autocomplete=username]').fill('wilson')
 await page.locator('input[autocomplete=current-password]').fill('estrudena')
 await page.getByRole('button',{name:'Entrar',exact:true}).press('Enter')
 await page.locator('nav').getByRole('button',{name:'Pessoas e acessos',exact:true}).press('Enter')
 assert.equal(await page.getByRole('checkbox',{name:'Matérias-primas — Produção',exact:true}).isChecked(),false)
 const estado=await page.evaluate(async()=>{const r=await window.estrudena.carregar();return {ok:r.ok,versao:r.dados?.permissoes?.versao,produtos:r.dados?.materiais?.length}})
 assert.deepEqual(estado,{ok:true,versao:1,produtos:19})
 assert.deepEqual(erros,[])
 console.log('OK: executável empacotado, versão, PostgreSQL incluído, migração, login e matriz de permissões.')
}finally{
 if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
 await c.query(`DROP SCHEMA "${schema}" CASCADE`);await c.end()
}
