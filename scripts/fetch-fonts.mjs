/** Fontes da interface aprovada, empacotadas para uso sem internet. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const dir=join(process.cwd(),'src','fonts')
mkdirSync(dir,{recursive:true})
const families=[['Manrope','Manrope:wght@400;500;600;700;800','manrope'],['IBM Plex Sans','IBM+Plex+Sans:wght@400;500;600','ibm-plex-sans']]
let local=''
for(const [family,query,slug] of families){
  const cssResponse=await fetch('https://fonts.googleapis.com/css2?family='+query+'&display=swap',{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}})
  if(!cssResponse.ok)throw Error('Falha ao buscar fonte '+family)
  const css=await cssResponse.text()
  const blocks=css.match(/@font-face\s*\{[^}]+\}/g)||[]
  let count=0
  for(const block of blocks){
    if(!block.includes('U+0000'))continue
    const url=block.match(/url\((https:[^)]+)\)/)?.[1]
    const weight=block.match(/font-weight:\s*([^;]+);/)?.[1]
    if(!url||!weight)continue
    const response=await fetch(url)
    if(!response.ok)throw Error('Falha ao baixar '+family)
    const filename=slug+'-'+weight.replaceAll(' ','-')+'.woff2'
    writeFileSync(join(dir,filename),Buffer.from(await response.arrayBuffer()))
    local+=block.replace(url,'./'+filename)+'\n'
    count++
  }
  if(!count)throw Error('Subset latin ausente: '+family)
  console.log(family+': '+count+' pesos locais')
  const license=await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/'+slug.replaceAll('-','')+'/OFL.txt')
  if(!license.ok)throw Error('Licença indisponível: '+family)
  writeFileSync(join(dir,slug+'-OFL.txt'),await license.text())
}
writeFileSync(join(dir,'fontes.css'),local)
