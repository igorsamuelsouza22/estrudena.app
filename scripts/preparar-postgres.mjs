import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
if(!existsSync('resources/pgsql/bin/postgres.exe'))throw Error('Execute npm run fetch:pg antes de gerar o instalador.')
execFileSync(resolve('node_modules/7zip-bin/win/x64/7za.exe'),['a','-t7z','-mx=7','pgsql.7z','pgsql'],{cwd:resolve('resources'),windowsHide:true,stdio:'inherit'})
