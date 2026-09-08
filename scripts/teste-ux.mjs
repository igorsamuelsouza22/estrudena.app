import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { _electron } = require(process.env.PLAYWRIGHT_PATH || 'playwright')
const { Client } = require('pg')
const credentials = readFileSync('electron/db/credentials.ts', 'utf8')
const credential = key => credentials.match(new RegExp(key + "\\s*=\\s*'([^']+)'"))[1]
const client = new Client({ host: '127.0.0.1', port: 5432, database: credential('DB_NAME'), user: credential('DB_USER'), password: credential('DB_PASSWORD') })
const schema = 'estrudena_teste_ui_' + randomBytes(8).toString('hex')
const userData = mkdtempSync(join(tmpdir(), 'estrudena-ui-'))
const cache = resolve('node_modules/.cache/estrudena')
mkdirSync(cache, { recursive: true })
const driver = join(cache, 'ui-driver.cjs')
writeFileSync(driver, `
  const { app, BrowserWindow, dialog, shell } = require('electron');
  app.setPath('userData', ${JSON.stringify(userData)});
  BrowserWindow.prototype.show = function () { this.setOpacity(0); this.showInactive(); };
  BrowserWindow.prototype.maximize = function () {};
  app.on('browser-window-created', (_event, win) => win.webContents.setBackgroundThrottling(false));
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: ${JSON.stringify(join(cache, 'separacao-composicao.pdf'))} });
  shell.showItemInFolder = () => {};
  require(${JSON.stringify(resolve('dist-electron/main.js'))});
`)
await client.connect()
await client.query(`CREATE SCHEMA "${schema}"`)
let electronApp
try {
  const env = { ...process.env, PGOPTIONS: '-c search_path=' + schema }
  delete env.ESTRUDENA_DEV_URL
  delete env.ELECTRON_RUN_AS_NODE
  electronApp = await _electron.launch({ executablePath: require('electron'), args: [driver], cwd: process.cwd(), env })
  const page = await electronApp.firstWindow()
  const errors = []
  page.setDefaultTimeout(15000)
  console.log('Instância de teste pronta')
  const screenshot = async name => {
    console.log('Captura:',name)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
    const png=await electronApp.evaluate(async({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0]; const image=await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});return image.toPNG().toString('base64')})
    writeFileSync(join(cache,name),Buffer.from(png,'base64'))
  }
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (/Cannot update a component|Maximum update depth/.test(m.text())) errors.push(m.text()) })
  await page.locator('input[autocomplete=username]').waitFor()
  await page.evaluate(async () => {
    const api = window.estrudena
    const bloqueado = await api.carregar(); if(bloqueado.ok) throw Error('Banco exposto sem login')
    const login = await api.login('wilson','estrudena'); if(!login.dados?.ok) throw Error('Falha no login de teste')
    await api.restaurarExemplo()
    const db = (await api.carregar()).dados
    const base = db.materiais.find(m => m.id === 'PA150')
    const materia = { ...base, id: 'mp-demo', cod: 'MP-ALUMINIO', desc: 'Perfil de alumínio para fabricação', categoria: 'materia_prima',
      composicao: [], preco: 35.25, unidade: 'KG', pesoUnit: 0, corId: '', kitId: '', aces: [] }
    const produto = { ...base, id: 'produto-demo', cod: 'PORTA-DEMO', desc: 'Porta de correr com composição',
      composicao: [{ materialId: materia.id, qtd: 34.9, base: 'UN' }, { materialId: 'VD06L', qtd: 1, base: 'M2' }] }
    for (const m of [materia, produto]) {
      const r = await api.salvarMaterial(m)
      if (!r.ok) throw Error(r.erro)
    }
    const q = db.orcamentos.find(o => o.numero === '8026-01-26')
    const r = await api.salvarOrcamento({ ...q, referenciaPrecos: undefined, atualizadoEm: undefined, id: '', numero: 'DEMO-COMPOSICAO', status: 'Proposta',
      itens: [{ ...q.itens[0], matId: produto.id, qtd: 2 }] })
    if (!r.ok) throw Error(r.erro)
    const aceite=await api.negocio({acao:'aprovar',id:r.dados.id,atualizadoEm:r.dados.atualizadoEm,responsavel:'Cliente teste',evidencia:'Aceite de teste'});if(!aceite.ok)throw Error(aceite.erro)
    const pedido=(await api.carregar()).dados.pedidos.find(p=>p.numero==='DEMO-COMPOSICAO')
    const liberar=await api.negocio({acao:'liberar',id:pedido.id,versao:pedido.versao,data:'2026-12-01',medidasConferidas:true,requisitosConferidos:true});if(!liberar.ok)throw Error(liberar.erro)
  })
  await page.reload()
  await page.locator('input[autocomplete=username]').fill('wilson')
  await page.locator('input[autocomplete=current-password]').fill('estrudena')
  await page.getByRole('button', { name: 'Entrar', exact: true }).press('Enter')
  await page.getByRole('button', { name: 'Produtos', exact: true }).press('Enter')
  await page.locator('.catalog-tile').filter({ hasText: 'PORTA-DEMO' }).press('Enter')
  await page.getByText('Produto PORTA-DEMO', { exact: true }).waitFor()
  await page.getByRole('tab', { name: 'Composição', exact: true }).press('Enter')
  await page.getByRole('combobox', { name: 'Adicionar matéria-prima à composição' }).waitFor()
  assert.equal(await page.locator('.linha').filter({ hasText: 'VD06L' }).count(), 0)
  await screenshot('produtos.png')
  // Edita pelo formulário, salva e confere persistência pelo IPC.
  await page.getByRole('spinbutton', { name: 'Consumo de MP-ALUMINIO', exact: true }).fill('40')
  await page.getByRole('button', { name: 'Salvar produto', exact: true }).press('Enter')
  await page.waitForFunction(async () => (await window.estrudena.carregar()).dados.materiais.find(m => m.id === 'produto-demo').composicao[0].qtd === 40)
  await page.getByRole('button', { name: 'Matérias-primas', exact: true }).press('Enter')
  await page.locator('.linha').filter({ hasText: 'MP-ALUMINIO' }).press('Enter')
  await page.getByText('Matéria-prima MP-ALUMINIO', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Salvar matéria-prima', exact: true }).waitFor()
  assert.equal(await page.locator('.linha').filter({ hasText: 'PORTA-DEMO' }).count(), 0)
  await screenshot('materias-primas.png')
  await page.locator('nav').getByRole('button', { name: 'Orçamentos', exact: true }).press('Enter')
  await page.getByRole('button', { name: '+ Novo orçamento', exact: true }).press('Enter')
  await page.getByRole('button', { name: 'Continuar →', exact: true }).press('Enter')
  await page.getByRole('button', { name: '+ Inserir produto', exact: true }).press('Enter')
  const modal = page.locator('.dialog')
  await modal.waitFor()
  for (const cod of ['VD06L', 'VD34P', 'TP08', 'ACM4', 'MP-ALUMINIO']) assert.equal(await modal.locator('tbody tr').filter({ hasText: cod }).count(), 0)
  await modal.locator('tbody tr').filter({ hasText: 'PORTA-DEMO' }).getByRole('button', { name: 'inserir', exact: true }).press('Enter')
  await modal.getByRole('button', { name: 'Concluir', exact: true }).press('Enter')
  const totalAntes=await page.locator('.product-price>strong').first().innerText()
  await page.getByRole('spinbutton',{name:'Quantidade da linha 1',exact:true}).fill('3')
  assert.notEqual(await page.locator('.product-price>strong').first().innerText(),totalAntes)
  await screenshot('ux-orcamento-produtos.png')
  await page.locator('.budget-steps button').nth(2).press('Enter')
  await page.getByRole('combobox',{name:'Condição de pagamento',exact:true}).waitFor()
  await screenshot('ux-orcamento-revisao.png')
  await page.getByRole('button', { name: 'Produção', exact: true }).first().press('Enter')
  await page.locator('.linha').filter({ hasText: 'DEMO-COMPOSICAO' }).first().press('Enter')
  await page.getByRole('tab', { name: /^Matérias-primas/ }).press('Enter')
  await page.getByRole('spinbutton', { name: 'Conferido MP-ALUMINIO', exact: true }).fill('10')
  await page.getByRole('button', { name: 'Salvar conferência', exact: true }).press('Enter')
  await page.waitForFunction(async () => (await window.estrudena.carregar()).dados.separacoes['orc-demo']?.insumos?.['mp:mp-demo'] === 10)
  await screenshot('ux-producao.png')
  await page.getByRole('button', { name: 'Visualizar pedido em PDF', exact: true }).press('Enter')
  await page.getByRole('dialog', { name: 'Prévia do PDF', exact: true }).waitFor()
  await screenshot('ux-previa-pdf.png')
  await page.getByRole('button', { name: 'Salvar PDF', exact: true }).press('Enter')
  await page.getByRole('status').filter({ hasText: 'Pedido de separação salvo em PDF' }).waitFor()
  // Toda a navegação deve renderizar sem falhas.
  for (const nome of ['Início','Orçamentos','Clientes','Cadastros de apoio','Resultados','Pessoas e acessos','Configurações']) {
    await page.locator('nav').getByRole('button',{name:nome,exact:true}).press('Enter')
    await page.locator('.appscroll').waitFor()
    if(['Início','Orçamentos','Configurações'].includes(nome))await screenshot('ux-'+nome+'.png')
  }

  // Configurações: navegação, números em pt-BR, revisão, persistência e conflito.
  const cfgOriginal=await page.evaluate(async()=>(await window.estrudena.carregar()).dados.config)
  const navConfig=page.getByRole('navigation',{name:'Seções das configurações'})
  await page.getByRole('button',{name:'Salvar alterações',exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Salvar alterações',exact:true}).isDisabled(),true)
  await page.getByRole('textbox',{name:'Nome da empresa',exact:true}).fill('ESTRUDENA UX')
  await navConfig.getByRole('button',{name:/Propostas/}).press('Enter')
  await page.getByRole('textbox',{name:'Observações da proposta',exact:true}).fill('Conferir medidas na obra.\nInstalação conforme contratação.')
  await page.getByRole('searchbox',{name:'Buscar configurações',exact:true}).fill('markup')
  await page.locator('.config-search-result').filter({hasText:'Markup padrão'}).press('Enter')
  await page.getByRole('textbox',{name:'Markup padrão',exact:true}).fill('52,5')
  assert.equal(await page.getByRole('textbox',{name:'Markup padrão',exact:true}).inputValue(),'52,5')
  await screenshot('ux-config-precos.png')
  const materialAnterior=await page.getByRole('textbox',{name:'Material',exact:true}).inputValue()
  await page.getByRole('textbox',{name:'Material',exact:true}).fill('99')
  await page.getByRole('button',{name:'Salvar alterações',exact:true}).press('Enter')
  assert.equal(await page.getByRole('textbox',{name:'Material',exact:true}).getAttribute('aria-invalid'),'true')
  await page.getByRole('textbox',{name:'Material',exact:true}).fill(materialAnterior)
  await page.getByRole('button',{name:'Revisar alterações',exact:true}).press('Enter')
  await page.getByRole('dialog',{name:'Revisar alterações'}).getByText('ESTRUDENA UX',{exact:true}).waitFor()
  await screenshot('ux-config-revisar.png')
  await page.getByRole('dialog').getByRole('button',{name:'Salvar alterações',exact:true}).press('Enter')
  await page.getByRole('dialog').waitFor({state:'hidden'})
  await page.waitForFunction(async()=>{const cfg=(await window.estrudena.carregar()).dados.config;return cfg.empresa==='ESTRUDENA UX'&&cfg.markup===52.5})
  await page.getByText('Tudo salvo',{exact:true}).waitFor()
  await navConfig.getByRole('button',{name:/Listas de cadastro/}).press('Enter')
  await page.getByRole('textbox',{name:'Nome da nova opção',exact:true}).fill('condição ux')
  await page.getByRole('textbox',{name:'Nome da nova opção',exact:true}).press('Enter')
  await page.locator('.config-list-row').filter({hasText:'CONDIÇÃO UX'}).waitFor()
  await page.getByRole('button',{name:'Remover CONDIÇÃO UX',exact:true}).press('Enter')
  await page.getByRole('dialog').getByRole('button',{name:'Remover opção',exact:true}).press('Enter')
  await page.getByRole('dialog').waitFor({state:'hidden'})
  await navConfig.getByRole('button',{name:/Empresa/}).press('Enter')
  await page.getByRole('textbox',{name:'Telefone',exact:true}).fill('(11) 99999-1010')
  const protecaoConfig=await page.evaluate(()=>window.estrudena.abrirInstalador('nao-executar.exe'))
  assert.equal(protecaoConfig.ok,false);assert.match(protecaoConfig.erro,/configurações com alterações/)
  await page.locator('nav[aria-label="Áreas do sistema"]').getByRole('button',{name:'Início',exact:true}).press('Enter')
  await page.locator('nav[aria-label="Áreas do sistema"]').getByRole('button',{name:'Configurações',exact:true}).press('Enter')
  assert.equal(await page.getByRole('textbox',{name:'Telefone',exact:true}).inputValue(),'(11) 99999-1010')
  await page.evaluate(async()=>{const api=window.estrudena,db=(await api.carregar()).dados;const r=await api.salvarConfig({...db.config,empresa:'Nome de outra sessão'},db.config);if(!r.ok)throw Error(r.erro)})
  await page.getByRole('button',{name:'Salvar alterações',exact:true}).press('Enter')
  await page.getByRole('alert').filter({hasText:'outra sessão'}).waitFor()
  assert.equal(await page.getByRole('textbox',{name:'Telefone',exact:true}).inputValue(),'(11) 99999-1010')
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Descartar'&&!b.disabled))
  await page.getByRole('button',{name:'Descartar',exact:true}).press('Enter')
  await page.getByRole('dialog').getByRole('button',{name:'Descartar alterações',exact:true}).press('Enter')
  await page.getByRole('dialog').waitFor({state:'hidden'})
  assert.equal(await page.getByRole('textbox',{name:'Nome da empresa',exact:true}).inputValue(),'Nome de outra sessão')
  await page.evaluate(async original=>{const api=window.estrudena,db=(await api.carregar()).dados;const r=await api.salvarConfig(original,db.config);if(!r.ok)throw Error(r.erro)},cfgOriginal)
  await page.getByRole('navigation',{name:'Seções das configurações'}).getByRole('button',{name:/Sistema e dados/}).press('Enter')
  await page.getByRole('button',{name:'Verificar e reconectar',exact:true}).press('Enter')
  await screenshot('ux-config-sistema.png')
  console.log('OK: configurações com busca, prévias, vírgula decimal, validação, revisão, listas, rascunho e conflito entre sessões.')
  for(const nome of ['Ferragens e acessórios','Kits de ferragem','Kits de venda','Cores e acabamentos','Equipes de instalação']){
    await page.locator('nav').getByRole('button',{name:'Cadastros de apoio',exact:true}).press('Enter')
    await page.locator('.settings-link').filter({hasText:nome}).press('Enter')
    await page.locator('.lista-ficha').waitFor()
  }
  await page.locator('nav').getByRole('button',{name:'Catálogo',exact:true}).press('Enter')
  assert.equal(await page.locator('nav').getByRole('button',{name:'Produtos',exact:true}).isVisible(),false)
  await page.locator('nav').getByRole('button',{name:'Catálogo',exact:true}).press('Enter')
  await page.emulateMedia({colorScheme:'dark'})
  assert.equal(await page.locator('.app-sidebar').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)')
  await page.emulateMedia({colorScheme:'light'})
  // Busca global, navegação ao registro correto e recuperação de cadastro.
  await page.keyboard.press('Control+k')
  await page.getByRole('textbox', { name: 'Buscar cliente, produto ou proposta' }).fill('PORTA-DEMO')
  await page.getByRole('dialog', { name: 'Buscar no aplicativo' }).getByRole('button').filter({ hasText: 'Porta de correr' }).press('Enter')
  await page.getByRole('tab', { name: 'Dados gerais', exact: true }).press('Enter')
  await page.getByRole('textbox', { name: 'Descrição', exact: true }).fill('Rascunho de produto recuperável')
  await page.locator('nav').getByRole('button', { name: 'Clientes', exact: true }).press('Enter')
  await page.locator('nav').getByRole('button', { name: 'Produtos', exact: true }).press('Enter')
  await page.locator('.catalog-tile').filter({hasText:'PORTA-DEMO'}).press('Enter')
  await page.getByRole('combobox', { name: 'Recuperar rascunho de cadastro' }).selectOption('produto-demo')
  await page.getByRole('tab',{name:'Dados gerais',exact:true}).press('Enter')
  assert.equal(await page.getByRole('textbox', { name: 'Descrição', exact: true }).inputValue(), 'Rascunho de produto recuperável')
  // Cliente rápido, rascunho de orçamento e recuperação após reload/login.
  await page.locator('nav').getByRole('button', { name: 'Orçamentos', exact: true }).press('Enter')
  await page.getByRole('button', { name: '+ Novo orçamento', exact: true }).press('Enter')
  await page.getByRole('button', { name: '+ Cadastrar cliente', exact: true }).press('Enter')
  await page.getByRole('textbox', { name: 'Nome comercial *', exact: true }).fill('Cliente UX temporário')
  await page.getByRole('button', { name: 'Salvar e selecionar cliente', exact: true }).press('Enter')
  await page.getByRole('textbox', { name: 'Obra', exact: true }).fill('Obra UX recuperável')
  await screenshot('ux-orcamento.png')
  await page.reload()
  await page.locator('input[autocomplete=username]').fill('wilson')
  await page.locator('input[autocomplete=current-password]').fill('estrudena')
  await page.getByRole('button', { name: 'Entrar', exact: true }).press('Enter')
  await page.getByRole('combobox', { name: 'Retomar orçamento local' }).selectOption(await page.getByRole('combobox', { name: 'Retomar orçamento local' }).locator('option').filter({ hasText: 'Obra UX recuperável' }).getAttribute('value'))
  assert.equal(await page.getByRole('textbox', { name: 'Obra', exact: true }).inputValue(), 'Obra UX recuperável')
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).press('Enter')
  await page.waitForFunction(async () => (await window.estrudena.carregar()).dados.orcamentos.some(o => o.obra === 'Obra UX recuperável'))
  // Concorrência real: rejeita sobrescrever uma alteração feita em outra sessão e mantém o trabalho local.
  await page.evaluate(async () => {
    const db = (await window.estrudena.carregar()).dados
    const q = db.orcamentos.find(o => o.obra === 'Obra UX recuperável')
    const r = await window.estrudena.salvarOrcamento({ ...q, obra: 'Alterado em outra sessão' })
    if (!r.ok) throw Error(r.erro)
  })
  await page.getByRole('textbox', { name: 'Contato', exact: true }).fill('Contato preservado após falha')
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).press('Enter')
  await page.getByRole('alert').filter({ hasText: 'outra sessão' }).waitFor()
  assert.equal(await page.getByRole('textbox', { name: 'Contato', exact: true }).inputValue(), 'Contato preservado após falha')
  // Duas propostas novas não devem sobrescrever a mesma cópia local.
  for (const obra of ['Primeiro novo local', 'Segundo novo local']) {
    await page.locator('nav').getByRole('button', { name: 'Início', exact: true }).press('Enter')
    await page.getByRole('button', { name: '+ Novo orçamento', exact: true }).press('Enter')
    await page.getByRole('textbox', { name: 'Obra', exact: true }).fill(obra)
  }
  await page.locator('nav').getByRole('button', { name: 'Início', exact: true }).press('Enter')
  const locais = page.getByRole('combobox', { name: 'Retomar orçamento local' })
  assert.equal(await locais.locator('option').filter({ hasText: 'Primeiro novo local' }).count(), 1)
  assert.equal(await locais.locator('option').filter({ hasText: 'Segundo novo local' }).count(), 1)
  // Revisão e recálculo pela interface, incluindo prévia da proposta comercial.
  await page.locator('nav').getByRole('button', { name: 'Orçamentos', exact: true }).press('Enter')
  await page.getByRole('button',{name:'Abrir orçamento DEMO-COMPOSICAO',exact:true}).press('Enter')
  const proposta = page.getByRole('region', { name: 'Proposta DEMO-COMPOSICAO', exact: true })
  await proposta.getByRole('button', { name: 'Criar revisão', exact: true }).press('Enter')
  await page.locator('.budget-steps button').nth(2).press('Enter')
  await page.getByText('Atualizar os custos deste rascunho',{exact:true}).press('Enter')
  await page.getByRole('button', { name: 'Recalcular com preços atuais', exact: true }).press('Enter')
  await page.getByRole('dialog', { name: 'Comparar com os preços atuais', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Aplicar ao rascunho', exact: true }).press('Enter')
  await page.getByRole('button', { name: 'Gerar proposta', exact: true }).press('Enter')
  await page.getByRole('dialog', { name: 'Gerar documentos', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await page.locator('nav').getByRole('button', { name: 'Orçamentos', exact: true }).press('Enter')
  const abrirDemo=page.getByRole('button',{name:'Abrir orçamento DEMO-COMPOSICAO',exact:true})
  if(await abrirDemo.count())await abrirDemo.press('Enter')
  const grupo = page.getByRole('region', { name: 'Proposta DEMO-COMPOSICAO', exact: true })
  await grupo.getByRole('button', { name: 'Visualizar PDF', exact: true }).press('Enter')
  await screenshot('ux-proposta-comercial.png')
  await page.getByRole('button', { name: 'Fechar prévia', exact: true }).press('Enter')
  await grupo.getByRole('button', { name: /Ver .* revisões anteriores/ }).press('Enter')
  assert.equal(await grupo.getByText('Histórico', { exact: true }).count(), 1)
  // Teclado: Escape devolve foco ao acionador da busca.
  await page.getByRole('button', { name: /Buscar Ctrl K/ }).press('Enter')
  await page.getByRole('textbox', { name: 'Buscar cliente, produto ou proposta' }).fill('PORTA-DEMO')
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('dialog').count(), 0)
  // Perfil de produção: não renderiza valores, nem entradas de cadastros comerciais.
  await page.getByRole('button', { name: 'Sair', exact: true }).press('Enter')
  await page.locator('input[autocomplete=username]').fill('producao')
  await page.locator('input[autocomplete=current-password]').fill('estrudena')
  await page.getByRole('button', { name: 'Entrar', exact: true }).press('Enter')
  assert.equal(await page.locator('nav').getByRole('button', { name: 'Produtos', exact: true }).count(), 0)
  assert.ok(!(await page.locator('.appscroll').innerText()).includes('R$'))
  await page.locator('nav').getByRole('button', { name: 'Produção', exact: true }).press('Enter')
  assert.ok(!(await page.locator('.appscroll').innerText()).includes('R$'))
  const seguranca=await page.evaluate(async()=>{const api=window.estrudena;const db=(await api.carregar()).dados;return {bloqueado:!(await api.salvarConfig(db.config)).ok,precos:db.pedidos.every(p=>p.total===0&&p.proposta.markup===0),negociacao:db.orcamentos.some(o=>o.status==='Rascunho')}})
  assert.deepEqual(seguranca,{bloqueado:true,precos:true,negociacao:false})

  // Fluxo novo pelas telas: aceite, pedido, liberação, fabricação e entrega.
  await page.getByRole('button',{name:'Sair',exact:true}).press('Enter')
  await page.locator('input[autocomplete=username]').fill('wilson')
  await page.locator('input[autocomplete=current-password]').fill('estrudena')
  await page.getByRole('button',{name:'Entrar',exact:true}).press('Enter')
  await page.locator('nav').getByRole('button',{name:'Pedidos de venda',exact:true}).waitFor()
  await page.evaluate(async()=>{
    const api=window.estrudena,db=(await api.carregar()).dados,base=db.orcamentos.find(o=>o.numero==='DEMO-COMPOSICAO')
    const r=await api.salvarOrcamento({...base,id:'',numero:'UX-FLUXO',origemId:undefined,atualizadoEm:undefined,status:'Proposta',obra:'Obra do fluxo completo'})
    if(!r.ok)throw Error(r.erro)
  })
  await page.reload()
  await page.locator('input[autocomplete=username]').fill('wilson')
  await page.locator('input[autocomplete=current-password]').fill('estrudena')
  await page.getByRole('button',{name:'Entrar',exact:true}).press('Enter')
  await page.locator('nav').getByRole('button',{name:'Orçamentos',exact:true}).press('Enter')
  await page.getByRole('button',{name:'Abrir orçamento UX-FLUXO',exact:true}).press('Enter')
  await page.getByRole('button',{name:'Aprovar proposta',exact:true}).press('Enter')
  let dlg=page.getByRole('dialog')
  await dlg.getByRole('textbox',{name:'Quem aprovou pelo cliente *',exact:true}).fill('Cliente UI')
  await dlg.getByRole('textbox',{name:'Referência do aceite *',exact:true}).fill('Aceite arquivado de teste')
  await dlg.getByRole('button',{name:'Confirmar registro',exact:true}).press('Enter')
  await dlg.waitFor({state:'hidden'})
  await page.getByRole('button',{name:'Ver pedido de venda',exact:true}).press('Enter')
  await page.getByRole('button',{name:'Liberar para produção',exact:true}).press('Enter')
  dlg=page.getByRole('dialog')
  await dlg.locator('input[type=date]').fill('2026-12-10')
  await dlg.getByRole('checkbox',{name:'Medidas finais conferidas com a obra.',exact:true}).check()
  await dlg.getByRole('checkbox',{name:/Requisitos internos liberados/}).check()
  await dlg.getByRole('button',{name:'Confirmar registro',exact:true}).press('Enter')
  await dlg.waitFor({state:'hidden'})
  await screenshot('ux-pedido-venda.png')
  // Completa a conferência usando a mesma API autenticada da tela.
  await page.evaluate(async()=>{
    const api=window.estrudena,db=(await api.carregar()).dados,p=db.pedidos.find(p=>p.numero==='UX-FLUXO'),o=p.proposta,ref=o.referenciaPrecos
    const insumos={}
    for(const it of o.itens){const m=ref.materiais.find(m=>m.id===it.matId);for(const x of m.composicao){const base=x.base==='M2'?(it.larg??m.larg)*(it.alt??m.alt)/1e6:x.base==='ML'?(it.larg??m.larg)/1000:1;insumos['mp:'+x.materialId]=(insumos['mp:'+x.materialId]||0)+x.qtd*it.qtd*base}
      const kit=ref.kits.find(k=>k.id===m.kitId);for(const x of [...(m.aces||[]),...(kit?.itens||[])])insumos['ac:'+x.acesId]=(insumos['ac:'+x.acesId]||0)+x.qtd*it.qtd}
    let s={status:'Em separação',conf:Object.fromEntries(o.itens.map((it,i)=>[i,it.qtd])),insumos,responsavel:'Conferente UI',obs:'',iniciado:'',concluido:''}
    let r=await api.salvarSeparacao(o.id,s);if(!r.ok)throw Error(r.erro)
    s=(await api.carregar()).dados.separacoes[o.id];r=await api.salvarSeparacao(o.id,{...s,status:'Concluída'});if(!r.ok)throw Error(r.erro)
  })
  // Reload também verifica a recuperação do pedido persistido.
  await page.reload()
  await page.locator('input[autocomplete=username]').fill('wilson')
  await page.locator('input[autocomplete=current-password]').fill('estrudena')
  await page.getByRole('button',{name:'Entrar',exact:true}).press('Enter')
  await page.locator('nav').getByRole('button',{name:'Pedidos de venda',exact:true}).press('Enter')
  await page.locator('tbody tr').filter({hasText:'UX-FLUXO'}).getByRole('button',{name:'Acompanhar →',exact:true}).press('Enter')
  for(const label of ['Iniciar fabricação / recebimento','Finalizar fabricação','Aprovar conferência final']){
    await page.getByRole('button',{name:label,exact:true}).press('Enter')
    dlg=page.getByRole('dialog')
    if(label==='Aprovar conferência final')await dlg.getByRole('checkbox').check()
    await dlg.getByRole('button',{name:'Confirmar registro',exact:true}).press('Enter')
    await dlg.waitFor({state:'hidden'})
  }
  await page.getByRole('button',{name:'Programar entrega',exact:true}).press('Enter')
  dlg=page.getByRole('dialog')
  await screenshot('ux-programar-entrega.png')
  await dlg.getByRole('button',{name:'Confirmar registro',exact:true}).press('Enter')
  await dlg.waitFor({state:'hidden'})
  for(const status of ['Em transporte','Entregue']){
    await page.getByRole('button',{name:'Atualizar entrega',exact:true}).press('Enter')
    dlg=page.getByRole('dialog')
    await dlg.getByRole('combobox',{name:'Situação',exact:true}).selectOption(status)
    if(status==='Entregue')await dlg.getByRole('textbox',{name:'Comprovante de recebimento ou ocorrência',exact:true}).fill('Recibo UI')
    await dlg.getByRole('button',{name:'Confirmar registro',exact:true}).press('Enter')
    await dlg.waitFor({state:'hidden'})
  }
  await page.getByRole('button',{name:'Concluir pedido',exact:true}).press('Enter')
  await page.getByRole('dialog').getByRole('button',{name:'Confirmar registro',exact:true}).press('Enter')
  await page.getByRole('dialog').waitFor({state:'hidden'})
  assert.equal(await page.evaluate(async()=>(await window.estrudena.carregar()).dados.pedidos.find(p=>p.numero==='UX-FLUXO').status),'Concluído')
  console.log('OK: UI de aceite, pedido de venda, liberação, fabricação, qualidade, entrega e encerramento.')
  // Matriz real: concede acesso na tela e revoga durante uma sessão de produção.
  await page.locator('nav').getByRole('button',{name:'Pessoas e acessos',exact:true}).press('Enter')
  const materiaPerm=page.getByRole('checkbox',{name:'Matérias-primas — Produção',exact:true})
  await materiaPerm.check()
  assert.ok(await page.getByRole('checkbox',{name:'Valores, custos e margens — Produção',exact:true}).isChecked())
  assert.ok(await page.getByRole('checkbox',{name:'Usuários e matriz — Produção',exact:true}).isDisabled())
  assert.ok(await page.getByRole('checkbox',{name:'Valores, custos e margens — Administrador',exact:true}).isDisabled())
  await page.getByRole('button',{name:'Salvar permissões',exact:true}).press('Enter')
  await page.waitForFunction(()=>document.querySelector('.permission-save strong')?.textContent==='Matriz salva')
  await materiaPerm.scrollIntoViewIfNeeded()
  await screenshot('ux-matriz-permissoes.png')
  await page.getByRole('button',{name:'Sair',exact:true}).press('Enter')
  await page.locator('input[autocomplete=username]').fill('producao')
  await page.locator('input[autocomplete=current-password]').fill('estrudena')
  await page.getByRole('button',{name:'Entrar',exact:true}).press('Enter')
  await page.locator('nav').getByRole('button',{name:'Matérias-primas',exact:true}).press('Enter')
  const concessao=await page.evaluate(async()=>{
    const api=window.estrudena,db=(await api.carregar()).dados,m=db.materiais.find(m=>m.categoria==='materia_prima')
    return {editar:(await api.salvarMaterial(m)).ok,financeiro:db.materiais.some(m=>m.preco>0),matriz:(await api.salvarPermissoes(db.permissoes.matriz,db.permissoes.versao)).ok,excluir:(await api.excluir('materiais',m.id)).ok}
  })
  assert.deepEqual(concessao,{editar:true,financeiro:true,matriz:false,excluir:false})
  const revogacao=await page.evaluate(async()=>{
    const api=window.estrudena,db=(await api.carregar()).dados,m=db.materiais.find(m=>m.categoria==='materia_prima')
    await api.login('wilson','estrudena')
    const adm=(await api.carregar()).dados,matriz=adm.permissoes.matriz
    matriz.Produção.valores=false;matriz.Produção.materias_primas=false
    const salvo=await api.salvarPermissoes(matriz,adm.permissoes.versao);if(!salvo.ok)throw Error(salvo.erro)
    await api.login('producao','estrudena')
    const depois=(await api.carregar()).dados
    return {editar:(await api.salvarMaterial(m)).ok,financeiro:depois.materiais.some(m=>m.preco>0)}
  })
  assert.deepEqual(revogacao,{editar:false,financeiro:false})
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await page.waitForFunction(()=>![...document.querySelectorAll('nav button')].some(b=>b.textContent.trim()==='Matérias-primas'))
  assert.equal(await page.locator('.fichahead').count(),0)
  console.log('OK: matriz editável, concessão e revogação reais, dependências, bloqueio de API e atualização dos menus sem sair da conta.')
  assert.deepEqual(errors, [])
  console.log('OK: telas, composição, busca, recuperação após reload, múltiplos rascunhos, cliente rápido, concorrência, revisões, recálculo, teclado, produção sem preços e prévia/PDF.')
} catch(error) { console.error(error); throw error } finally {
  if (electronApp) { await electronApp.evaluate(({app})=>app.exit(0)).catch(()=>{}); await electronApp.close().catch(()=>{}) }
  await client.query(`DROP SCHEMA "${schema}" CASCADE`)
  await client.end()
}
