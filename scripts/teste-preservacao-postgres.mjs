import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,existsSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const cache=resolve('node_modules/.cache/estrudena');mkdirSync(cache,{recursive:true})
const raiz=mkdtempSync(join(cache,'nsis-preservacao-'))
const template=readFileSync('node_modules/app-builder-lib/templates/nsis/uninstaller.nsh','utf8')
const inicio=template.indexOf('Function un.restoreFiles'),fim=template.indexOf('FunctionEnd',inicio)+'FunctionEnd'.length
const restore=template.slice(inicio,fim)
const makensis=join(process.env.LOCALAPPDATA,'electron-builder/Cache/nsis/nsis-3.0.4.1/Bin/makensis.exe')
for(const atualizar of [true,false]){
 const alvo=join(raiz,atualizar?'atualizar':'remover'),script=join(raiz,(atualizar?'atualizar':'remover')+'.nsi'),exe=script.replace('.nsi','.exe')
 assert.ok(alvo.startsWith(raiz+'\\'),'Teste deve permanecer dentro da pasta temporária')
 mkdirSync(join(alvo,'resources/pgsql/bin'),{recursive:true})
 writeFileSync(join(alvo,'resources/pgsql/bin/postgres.exe'),'runtime preservado')
 writeFileSync(join(alvo,'resources/app.asar'),'app antigo');writeFileSync(join(alvo,'app.exe'),'app antigo')
 writeFileSync(script,`
Unicode true
RequestExecutionLevel user
SilentInstall silent
SilentUnInstall silent
OutFile "${exe}"
InstallDir "${alvo}"
!include LogicLib.nsh
!define PRODUCT_FILENAME "Teste Estrudena"
!define isUpdated '${atualizar?'1':'0'} == 1'
!include "${resolve('build/preservar-postgres.nsh')}"
${restore}
Section
 WriteUninstaller "$INSTDIR\\Uninstall Teste Estrudena.exe"
SectionEnd
Section "Uninstall"
 !insertmacro customRemoveFiles
SectionEnd
`)
 execFileSync(makensis,['/V2',script],{windowsHide:true,stdio:'pipe'})
 execFileSync(exe,[],{windowsHide:true})
 execFileSync(join(alvo,'Uninstall Teste Estrudena.exe'),['/S',`_?=${alvo}`],{windowsHide:true})
 assert.equal(existsSync(join(alvo,'resources/pgsql/bin/postgres.exe')),atualizar)
 if(atualizar)assert.equal(readFileSync(join(alvo,'resources/pgsql/bin/postgres.exe'),'utf8'),'runtime preservado')
 assert.equal(existsSync(join(alvo,'resources/app.asar')),false)
 assert.equal(existsSync(join(alvo,'app.exe')),false)
}
console.log('OK: NSIS preserva o runtime PostgreSQL na atualização e remove os arquivos do app. Testado apenas com arquivos fictícios em pasta temporária, sem alterar serviços ou registro do Windows.')
