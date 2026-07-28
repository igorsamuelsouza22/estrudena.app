import type { PoolClient } from 'pg'
import bcrypt from 'bcryptjs'
import { comCliente } from './pool'
import { carregarExemplo } from './migrate'
import type {
  Acessorio, Cliente, Config, Cor, DB, Instalador, Kit, KitVenda,
  LoginResult, Material, Orcamento, Separacao, Usuario
} from '../../src/shared/types'

const num = (v: unknown, padrao = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : padrao
}

// ------------------------------------------------------------------- leitura

export async function carregarDB(): Promise<DB> {
  return comCliente(async c => {
    const [
      cfgQ, listasQ, coresQ, acesQ, kitsQ, kitItensQ, matsQ, matAcesQ,
      kvQ, kvItensQ, instQ, cliQ, usrQ, orcQ, orcItensQ, sepQ, sepConfQ
    ] = await Promise.all([
      c.query('SELECT * FROM config WHERE id'),
      c.query('SELECT categoria, valor FROM listas ORDER BY categoria, ordem, valor'),
      c.query('SELECT * FROM cores ORDER BY cod'),
      c.query('SELECT * FROM acessorios ORDER BY cod'),
      c.query('SELECT * FROM kits ORDER BY cod'),
      c.query('SELECT * FROM kit_itens ORDER BY kit_id, ordem'),
      c.query('SELECT * FROM materiais ORDER BY cod'),
      c.query('SELECT * FROM material_acessorios ORDER BY material_id, ordem'),
      c.query('SELECT * FROM kits_venda ORDER BY cod'),
      c.query('SELECT * FROM kit_venda_itens ORDER BY kit_id, ordem'),
      c.query('SELECT * FROM instaladores ORDER BY cod'),
      c.query('SELECT * FROM clientes ORDER BY nome'),
      c.query('SELECT id, nome, usuario, perfil, ativo, criado_em FROM usuarios ORDER BY nome'),
      c.query('SELECT * FROM orcamentos ORDER BY atualizado_em DESC'),
      c.query('SELECT * FROM orcamento_itens ORDER BY orcamento_id, ordem'),
      c.query('SELECT * FROM separacoes'),
      c.query('SELECT * FROM separacao_conf ORDER BY orcamento_id, ordem')
    ])

    const cfgRow = cfgQ.rows[0] ?? {}
    const config: Config = {
      precoKg: num(cfgRow.preco_kg, 35.25), perda: num(cfgRow.perda),
      moKg: num(cfgRow.mo_kg, 4.73), moM2: num(cfgRow.mo_m2, 170.24),
      moHora: num(cfgRow.mo_hora, 780), moKm: num(cfgRow.mo_km, 4.2),
      markup: num(cfgRow.markup, 52), imposto: num(cfgRow.imposto, 7),
      com1: num(cfgRow.com1, 5), com2: num(cfgRow.com2),
      impMaterial: num(cfgRow.imp_material, 50), impIndust: num(cfgRow.imp_indust, 40),
      impMo: num(cfgRow.imp_mo, 10), validade: num(cfgRow.validade, 15),
      condPag: cfgRow.cond_pag ?? 'A COMBINAR', prazo: cfgRow.prazo ?? 'A COMBINAR',
      empresa: cfgRow.empresa ?? 'ESTRUDENA', endereco: cfgRow.endereco ?? '',
      endereco2: cfgRow.endereco2 ?? '', fone: cfgRow.fone ?? '',
      email: cfgRow.email ?? '', site: cfgRow.site ?? '',
      observacoes: cfgRow.observacoes ?? []
    }

    const listas: Record<string, string[]> = {}
    for (const r of listasQ.rows) (listas[r.categoria] ??= []).push(r.valor)

    const kitItens = new Map<string, { acesId: string; qtd: number }[]>()
    for (const r of kitItensQ.rows) {
      ;(kitItens.get(r.kit_id) ?? kitItens.set(r.kit_id, []).get(r.kit_id)!)
        .push({ acesId: r.aces_id, qtd: num(r.qtd) })
    }

    const matAces = new Map<string, { acesId: string; qtd: number }[]>()
    for (const r of matAcesQ.rows) {
      ;(matAces.get(r.material_id) ?? matAces.set(r.material_id, []).get(r.material_id)!)
        .push({ acesId: r.aces_id, qtd: num(r.qtd) })
    }

    const kvItens = new Map<string, { matId: string; qtd: number }[]>()
    for (const r of kvItensQ.rows) {
      ;(kvItens.get(r.kit_id) ?? kvItens.set(r.kit_id, []).get(r.kit_id)!)
        .push({ matId: r.material_id, qtd: num(r.qtd) })
    }

    const orcItens = new Map<string, Orcamento['itens']>()
    for (const r of orcItensQ.rows) {
      ;(orcItens.get(r.orcamento_id) ?? orcItens.set(r.orcamento_id, []).get(r.orcamento_id)!)
        .push({
          matId: r.material_id, qtd: num(r.qtd),
          larg: r.larg == null ? null : num(r.larg), alt: r.alt == null ? null : num(r.alt),
          local: r.local ?? '', desc: r.descricao, serie: r.serie,
          perfil: r.perfil ?? '', vidro: r.vidro ?? '—', detalhe: r.detalhe,
          markup: r.markup == null ? null : num(r.markup), fc: num(r.fc, 1)
        })
    }

    const sepConf = new Map<string, Record<string, number>>()
    for (const r of sepConfQ.rows) {
      const m = sepConf.get(r.orcamento_id) ?? sepConf.set(r.orcamento_id, {}).get(r.orcamento_id)!
      m[String(r.ordem)] = num(r.separado)
    }

    const separacoes: Record<string, Separacao> = {}
    for (const r of sepQ.rows) {
      separacoes[r.orcamento_id] = {
        status: r.status, conf: sepConf.get(r.orcamento_id) ?? {},
        responsavel: r.responsavel ?? '', obs: r.obs ?? '',
        iniciado: r.iniciado ?? '', concluido: r.concluido ?? ''
      }
    }

    return {
      config,
      materiais: matsQ.rows.map((r): Material => ({
        id: r.id, cod: r.cod, desc: r.descricao, serie: r.serie, tipo: r.tipo,
        unidade: r.unidade, pesoUnit: num(r.peso_unit),
        larg: r.larg == null ? null : num(r.larg), alt: r.alt == null ? null : num(r.alt),
        preco: num(r.preco), fc: num(r.fc, 1),
        corId: r.cor_id ?? '', kitId: r.kit_id ?? '',
        aces: matAces.get(r.id) ?? [],
        img: r.img ?? '', imgData: r.img_data,
        markup: num(r.markup, 52), imposto: num(r.imposto, 7),
        comissao: num(r.comissao, 5), moM2: num(r.mo_m2)
      })),
      cores: coresQ.rows.map((r): Cor => ({
        id: r.id, cod: r.cod, nome: r.nome, acabamento: r.acabamento, fornecedor: r.fornecedor,
        precoKg: num(r.preco_kg), precoM2: num(r.preco_m2), ativo: r.ativo
      })),
      acessorios: acesQ.rows.map((r): Acessorio => ({
        id: r.id, cod: r.cod, nome: r.nome, grupo: r.grupo, fornecedor: r.fornecedor,
        unidade: r.unidade, preco: num(r.preco), ativo: r.ativo
      })),
      kits: kitsQ.rows.map((r): Kit => ({
        id: r.id, cod: r.cod, nome: r.nome, aplicacao: r.aplicacao, itens: kitItens.get(r.id) ?? []
      })),
      kitsVenda: kvQ.rows.map((r): KitVenda => ({
        id: r.id, cod: r.cod, nome: r.nome, descricao: r.descricao, itens: kvItens.get(r.id) ?? []
      })),
      instaladores: instQ.rows.map((r): Instalador => ({
        id: r.id, cod: r.cod, nome: r.nome, tipo: r.tipo, doc: r.doc,
        responsavel: r.responsavel, fone: r.fone, regiao: r.regiao,
        precoM2: num(r.preco_m2), diaria: num(r.diaria), equipe: num(r.equipe, 1),
        ativo: r.ativo, obs: r.obs
      })),
      clientes: cliQ.rows.map((r): Cliente => ({
        id: r.id, nome: r.nome, razao: r.razao, cnpj: r.cnpj, endereco: r.endereco,
        cidade: r.cidade, contato: r.contato, fone: r.fone, email: r.email
      })),
      usuarios: usrQ.rows.map((r): Usuario => ({
        id: r.id, nome: r.nome, usuario: r.usuario, perfil: r.perfil, ativo: r.ativo,
        criadoEm: r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? '')
      })),
      orcamentos: orcQ.rows.map((r): Orcamento => ({
        id: r.id, numero: r.numero, rev: r.rev, status: r.status, data: r.data,
        vendedor: r.vendedor, enviadaEm: r.enviada_em,
        clienteId: r.cliente_id ?? '', obra: r.obra, cidade: r.cidade, contato: r.contato,
        prazo: r.prazo, condPag: r.cond_pag, instaladorId: r.instalador_id ?? '',
        itens: orcItens.get(r.id) ?? [],
        moM2: num(r.mo_m2), moHoras: num(r.mo_horas), moHora: num(r.mo_hora),
        moPct: num(r.mo_pct), moFixo: num(r.mo_fixo), km: num(r.km), moKm: num(r.mo_km),
        frete: num(r.frete), terceiros: num(r.terceiros), outros: num(r.outros),
        markup: num(r.markup), imposto: num(r.imposto), com1: num(r.com1),
        com2: num(r.com2), perda: num(r.perda), desconto: num(r.desconto)
      })),
      separacoes,
      series: listas.series ?? [],
      tipos: listas.tipos ?? [],
      acesGrupos: listas.acesGrupos ?? [],
      acabamentos: listas.acabamentos ?? [],
      condicoesPag: listas.condicoesPag ?? [],
      prazosEntrega: listas.prazosEntrega ?? [],
      fornecedores: listas.fornecedores ?? [],
      tiposEquipe: listas.tiposEquipe ?? [],
      seq: num(cfgRow.seq)
    }
  })
}

// --------------------------------------------------------------------- login

export async function autenticar(usuario: string, senha: string): Promise<LoginResult> {
  return comCliente(async c => {
    const { rows } = await c.query(
      'SELECT id, nome, usuario, senha_hash, perfil, ativo FROM usuarios WHERE lower(usuario) = lower($1)',
      [usuario.trim()]
    )
    const u = rows[0]
    if (!u || !bcrypt.compareSync(senha, u.senha_hash)) {
      return { ok: false, erro: 'Usuário ou senha inválidos.' }
    }
    if (!u.ativo) return { ok: false, erro: 'Usuário desativado. Fale com o administrador.' }
    return {
      ok: true,
      usuario: { id: u.id, nome: u.nome, usuario: u.usuario, perfil: u.perfil, ativo: u.ativo }
    }
  })
}

// ------------------------------------------------------------------ gravação

export async function salvarConfig(cfg: Config): Promise<void> {
  await comCliente(c => c.query(
    `UPDATE config SET
       preco_kg=$1, perda=$2, mo_kg=$3, mo_m2=$4, mo_hora=$5, mo_km=$6,
       markup=$7, imposto=$8, com1=$9, com2=$10,
       imp_material=$11, imp_indust=$12, imp_mo=$13,
       validade=$14, cond_pag=$15, prazo=$16,
       empresa=$17, endereco=$18, endereco2=$19, fone=$20, email=$21, site=$22,
       observacoes=$23
     WHERE id`,
    [cfg.precoKg, cfg.perda, cfg.moKg, cfg.moM2, cfg.moHora, cfg.moKm,
      cfg.markup, cfg.imposto, cfg.com1, cfg.com2,
      cfg.impMaterial, cfg.impIndust, cfg.impMo,
      cfg.validade, cfg.condPag, cfg.prazo,
      cfg.empresa, cfg.endereco, cfg.endereco2, cfg.fone, cfg.email, cfg.site,
      cfg.observacoes]
  ))
}

export async function salvarMaterial(m: Material): Promise<void> {
  await comCliente(async c => {
    await c.query('BEGIN')
    try {
      await c.query(
        `INSERT INTO materiais (
           id, cod, descricao, serie, tipo, unidade, peso_unit, larg, alt, preco, fc,
           cor_id, kit_id, img, img_data, markup, imposto, comissao, mo_m2
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (id) DO UPDATE SET
           cod=EXCLUDED.cod, descricao=EXCLUDED.descricao, serie=EXCLUDED.serie,
           tipo=EXCLUDED.tipo, unidade=EXCLUDED.unidade, peso_unit=EXCLUDED.peso_unit,
           larg=EXCLUDED.larg, alt=EXCLUDED.alt, preco=EXCLUDED.preco, fc=EXCLUDED.fc,
           cor_id=EXCLUDED.cor_id, kit_id=EXCLUDED.kit_id, img=EXCLUDED.img,
           img_data=EXCLUDED.img_data, markup=EXCLUDED.markup, imposto=EXCLUDED.imposto,
           comissao=EXCLUDED.comissao, mo_m2=EXCLUDED.mo_m2`,
        [m.id, m.cod, m.desc, m.serie, m.tipo, m.unidade, m.pesoUnit, m.larg, m.alt,
          m.preco, m.fc, m.corId || null, m.kitId || null, m.img, m.imgData,
          m.markup, m.imposto, m.comissao, m.moM2]
      )
      await c.query('DELETE FROM material_acessorios WHERE material_id = $1', [m.id])
      for (let i = 0; i < m.aces.length; i++) {
        await c.query(
          'INSERT INTO material_acessorios (material_id, aces_id, qtd, ordem) VALUES ($1,$2,$3,$4)',
          [m.id, m.aces[i].acesId, m.aces[i].qtd, i]
        )
      }
      await c.query('COMMIT')
    } catch (e) { await c.query('ROLLBACK'); throw e }
  })
}

export async function salvarCor(x: Cor): Promise<void> {
  await comCliente(c => c.query(
    `INSERT INTO cores (id, cod, nome, acabamento, fornecedor, preco_kg, preco_m2, ativo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET cod=EXCLUDED.cod, nome=EXCLUDED.nome,
       acabamento=EXCLUDED.acabamento, fornecedor=EXCLUDED.fornecedor,
       preco_kg=EXCLUDED.preco_kg, preco_m2=EXCLUDED.preco_m2, ativo=EXCLUDED.ativo`,
    [x.id, x.cod, x.nome, x.acabamento, x.fornecedor, x.precoKg, x.precoM2, x.ativo]
  ))
}

export async function salvarAcessorio(x: Acessorio): Promise<void> {
  await comCliente(c => c.query(
    `INSERT INTO acessorios (id, cod, nome, grupo, fornecedor, unidade, preco, ativo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET cod=EXCLUDED.cod, nome=EXCLUDED.nome,
       grupo=EXCLUDED.grupo, fornecedor=EXCLUDED.fornecedor, unidade=EXCLUDED.unidade,
       preco=EXCLUDED.preco, ativo=EXCLUDED.ativo`,
    [x.id, x.cod, x.nome, x.grupo, x.fornecedor, x.unidade, x.preco, x.ativo]
  ))
}

export async function salvarKit(k: Kit): Promise<void> {
  await comCliente(async c => {
    await c.query('BEGIN')
    try {
      await c.query(
        `INSERT INTO kits (id, cod, nome, aplicacao) VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET cod=EXCLUDED.cod, nome=EXCLUDED.nome,
           aplicacao=EXCLUDED.aplicacao`,
        [k.id, k.cod, k.nome, k.aplicacao]
      )
      await c.query('DELETE FROM kit_itens WHERE kit_id = $1', [k.id])
      for (let i = 0; i < k.itens.length; i++) {
        await c.query(
          'INSERT INTO kit_itens (kit_id, aces_id, qtd, ordem) VALUES ($1,$2,$3,$4)',
          [k.id, k.itens[i].acesId, k.itens[i].qtd, i]
        )
      }
      await c.query('COMMIT')
    } catch (e) { await c.query('ROLLBACK'); throw e }
  })
}

export async function salvarKitVenda(k: KitVenda): Promise<void> {
  await comCliente(async c => {
    await c.query('BEGIN')
    try {
      await c.query(
        `INSERT INTO kits_venda (id, cod, nome, descricao) VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET cod=EXCLUDED.cod, nome=EXCLUDED.nome,
           descricao=EXCLUDED.descricao`,
        [k.id, k.cod, k.nome, k.descricao]
      )
      await c.query('DELETE FROM kit_venda_itens WHERE kit_id = $1', [k.id])
      for (let i = 0; i < k.itens.length; i++) {
        await c.query(
          'INSERT INTO kit_venda_itens (kit_id, material_id, qtd, ordem) VALUES ($1,$2,$3,$4)',
          [k.id, k.itens[i].matId, k.itens[i].qtd, i]
        )
      }
      await c.query('COMMIT')
    } catch (e) { await c.query('ROLLBACK'); throw e }
  })
}

export async function salvarInstalador(x: Instalador): Promise<void> {
  await comCliente(c => c.query(
    `INSERT INTO instaladores (id, cod, nome, tipo, doc, responsavel, fone, regiao,
       preco_m2, diaria, equipe, ativo, obs)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO UPDATE SET cod=EXCLUDED.cod, nome=EXCLUDED.nome, tipo=EXCLUDED.tipo,
       doc=EXCLUDED.doc, responsavel=EXCLUDED.responsavel, fone=EXCLUDED.fone,
       regiao=EXCLUDED.regiao, preco_m2=EXCLUDED.preco_m2, diaria=EXCLUDED.diaria,
       equipe=EXCLUDED.equipe, ativo=EXCLUDED.ativo, obs=EXCLUDED.obs`,
    [x.id, x.cod, x.nome, x.tipo, x.doc, x.responsavel, x.fone, x.regiao,
      x.precoM2, x.diaria, x.equipe, x.ativo, x.obs]
  ))
}

export async function salvarCliente(x: Cliente): Promise<void> {
  await comCliente(c => c.query(
    `INSERT INTO clientes (id, nome, razao, cnpj, endereco, cidade, contato, fone, email)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, razao=EXCLUDED.razao,
       cnpj=EXCLUDED.cnpj, endereco=EXCLUDED.endereco, cidade=EXCLUDED.cidade,
       contato=EXCLUDED.contato, fone=EXCLUDED.fone, email=EXCLUDED.email`,
    [x.id, x.nome, x.razao, x.cnpj, x.endereco, x.cidade, x.contato, x.fone, x.email]
  ))
}

export async function salvarUsuario(u: Usuario & { senha?: string }): Promise<void> {
  await comCliente(async c => {
    if (u.senha) {
      const hash = bcrypt.hashSync(u.senha, 10)
      await c.query(
        `INSERT INTO usuarios (id, nome, usuario, senha_hash, perfil, ativo)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, usuario=EXCLUDED.usuario,
           senha_hash=EXCLUDED.senha_hash, perfil=EXCLUDED.perfil, ativo=EXCLUDED.ativo`,
        [u.id, u.nome, u.usuario, hash, u.perfil, u.ativo]
      )
    } else {
      await c.query(
        `UPDATE usuarios SET nome=$2, usuario=$3, perfil=$4, ativo=$5 WHERE id=$1`,
        [u.id, u.nome, u.usuario, u.perfil, u.ativo]
      )
    }
  })
}

async function proximoNumero(c: PoolClient): Promise<string> {
  const { rows } = await c.query('UPDATE config SET seq = seq + 1 WHERE id RETURNING seq')
  const seq = num(rows[0]?.seq, 1)
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return '80' + String(seq).padStart(2, '0') + '-' + mm + '-' + yy
}

/** Grava o orçamento inteiro (cabeçalho + itens). Gera número na primeira gravação. */
export async function salvarOrcamento(o: Orcamento): Promise<Orcamento> {
  return comCliente(async c => {
    await c.query('BEGIN')
    try {
      let id = o.id
      let numero = o.numero
      if (!id) {
        id = 'orc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
        // Uma revisão nova chega sem id mas com o número do pedido original —
        // nesse caso o número é preservado e o sequencial não avança.
        if (!numero.trim() || numero === '(automático)') numero = await proximoNumero(c)
      }
      await c.query(
        `INSERT INTO orcamentos (
           id, numero, rev, status, data, vendedor, enviada_em, cliente_id, obra, cidade,
           contato, prazo, cond_pag, instalador_id, mo_m2, mo_horas, mo_hora, mo_pct, mo_fixo,
           km, mo_km, frete, terceiros, outros, markup, imposto, com1, com2, perda, desconto,
           atualizado_em
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                   $21,$22,$23,$24,$25,$26,$27,$28,$29,$30, now())
         ON CONFLICT (id) DO UPDATE SET
           numero=EXCLUDED.numero, rev=EXCLUDED.rev, status=EXCLUDED.status, data=EXCLUDED.data,
           vendedor=EXCLUDED.vendedor, enviada_em=EXCLUDED.enviada_em,
           cliente_id=EXCLUDED.cliente_id, obra=EXCLUDED.obra, cidade=EXCLUDED.cidade,
           contato=EXCLUDED.contato, prazo=EXCLUDED.prazo, cond_pag=EXCLUDED.cond_pag,
           instalador_id=EXCLUDED.instalador_id, mo_m2=EXCLUDED.mo_m2,
           mo_horas=EXCLUDED.mo_horas, mo_hora=EXCLUDED.mo_hora, mo_pct=EXCLUDED.mo_pct,
           mo_fixo=EXCLUDED.mo_fixo, km=EXCLUDED.km, mo_km=EXCLUDED.mo_km,
           frete=EXCLUDED.frete, terceiros=EXCLUDED.terceiros, outros=EXCLUDED.outros,
           markup=EXCLUDED.markup, imposto=EXCLUDED.imposto, com1=EXCLUDED.com1,
           com2=EXCLUDED.com2, perda=EXCLUDED.perda, desconto=EXCLUDED.desconto,
           atualizado_em=now()`,
        [id, numero, o.rev, o.status, o.data, o.vendedor, o.enviadaEm, o.clienteId || null,
          o.obra, o.cidade, o.contato, o.prazo, o.condPag, o.instaladorId || null,
          o.moM2, o.moHoras, o.moHora, o.moPct, o.moFixo, o.km, o.moKm,
          o.frete, o.terceiros, o.outros, o.markup, o.imposto, o.com1, o.com2,
          o.perda, o.desconto]
      )
      await c.query('DELETE FROM orcamento_itens WHERE orcamento_id = $1', [id])
      for (let i = 0; i < o.itens.length; i++) {
        const it = o.itens[i]
        await c.query(
          `INSERT INTO orcamento_itens (orcamento_id, ordem, material_id, qtd, larg, alt,
             local, descricao, serie, perfil, vidro, detalhe, markup, fc)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [id, i, it.matId, it.qtd, it.larg, it.alt, it.local, it.desc, it.serie,
            it.perfil, it.vidro, it.detalhe, it.markup, it.fc]
        )
      }
      await c.query('COMMIT')
      return { ...o, id, numero }
    } catch (e) { await c.query('ROLLBACK'); throw e }
  })
}

export async function salvarSeparacao(orcId: string, s: Separacao): Promise<void> {
  await comCliente(async c => {
    await c.query('BEGIN')
    try {
      await c.query(
        `INSERT INTO separacoes (orcamento_id, status, responsavel, obs, iniciado, concluido)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (orcamento_id) DO UPDATE SET status=EXCLUDED.status,
           responsavel=EXCLUDED.responsavel, obs=EXCLUDED.obs,
           iniciado=EXCLUDED.iniciado, concluido=EXCLUDED.concluido`,
        [orcId, s.status, s.responsavel, s.obs, s.iniciado, s.concluido]
      )
      await c.query('DELETE FROM separacao_conf WHERE orcamento_id = $1', [orcId])
      for (const [ordem, qtd] of Object.entries(s.conf)) {
        if (!qtd) continue
        await c.query(
          'INSERT INTO separacao_conf (orcamento_id, ordem, separado) VALUES ($1,$2,$3)',
          [orcId, parseInt(ordem, 10), qtd]
        )
      }
      await c.query('COMMIT')
    } catch (e) { await c.query('ROLLBACK'); throw e }
  })
}

export async function excluir(tabela: string, id: string): Promise<void> {
  const permitidas: Record<string, string> = {
    materiais: 'materiais', cores: 'cores', acessorios: 'acessorios', kits: 'kits',
    kitsVenda: 'kits_venda', instaladores: 'instaladores', clientes: 'clientes',
    orcamentos: 'orcamentos', usuarios: 'usuarios'
  }
  const t = permitidas[tabela]
  if (!t) throw new Error(`Tabela desconhecida: ${tabela}`)
  await comCliente(c => c.query(`DELETE FROM ${t} WHERE id = $1`, [id]))
}

export async function adicionarLista(categoria: string, valor: string): Promise<void> {
  await comCliente(c => c.query(
    `INSERT INTO listas (categoria, valor, ordem)
     VALUES ($1,$2,(SELECT COALESCE(MAX(ordem),0)+1 FROM listas WHERE categoria=$1))
     ON CONFLICT DO NOTHING`,
    [categoria, valor]
  ))
}

export async function removerLista(categoria: string, valor: string): Promise<void> {
  await comCliente(c => c.query(
    'DELETE FROM listas WHERE categoria = $1 AND valor = $2', [categoria, valor]
  ))
}

export async function restaurarExemplo(): Promise<void> {
  await comCliente(c => carregarExemplo(c))
}
