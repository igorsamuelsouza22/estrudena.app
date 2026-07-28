import type { PoolClient } from 'pg'
import bcrypt from 'bcryptjs'
import schemaSql from './schema.sql'
import {
  ACESSORIOS, CLIENTES_EXEMPLO, CONFIG, CORES, INSTALADORES, KITS, KITS_VENDA,
  LISTAS, MATERIAIS, ORCAMENTOS_EXEMPLO, USUARIOS
} from './seed-data'

export const VERSAO_ATUAL = 3

/** Repositório padrão de onde as atualizações chegam. */
export const REPO_PADRAO = 'igorsamuelsouza22/estrudena.app'

/** Cria o schema (idempotente) e popula o catálogo na primeira vez. */
export async function migrar(c: PoolClient): Promise<void> {
  await c.query(schemaSql)

  const { rows } = await c.query<{ versao: number }>(
    'SELECT versao FROM schema_versao ORDER BY versao DESC LIMIT 1'
  )
  const atual = rows[0]?.versao ?? 0
  if (atual >= VERSAO_ATUAL) return

  await c.query('BEGIN')
  try {
    if (atual < 1) await seedCatalogo(c)
    // v2: a Ana passou a ser administradora. Vale também para quem já instalou,
    // e só mexe na conta original criada pelo instalador.
    if (atual >= 1 && atual < 2) {
      await c.query(
        "UPDATE usuarios SET perfil = 'Administrador' WHERE id = 'u-ana' AND perfil = 'Vendedor'"
      )
    }
    // v3: aponta as atualizações para o repositório oficial em quem já instalou,
    // sem sobrescrever um repositório escolhido à mão.
    if (atual >= 1 && atual < 3) {
      await c.query('UPDATE config SET github_repo = $1 WHERE id AND github_repo = $2',
        [REPO_PADRAO, ''])
    }
    await c.query('INSERT INTO schema_versao (versao) VALUES ($1)', [VERSAO_ATUAL])
    await c.query('COMMIT')
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  }
}

async function seedCatalogo(c: PoolClient): Promise<void> {
  await c.query(
    `INSERT INTO config (
       id, preco_kg, perda, mo_kg, mo_m2, mo_hora, mo_km,
       markup, imposto, com1, com2, imp_material, imp_indust, imp_mo,
       validade, cond_pag, prazo, empresa, endereco, endereco2, fone, email, site,
       observacoes, seq
     ) VALUES (true,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     ON CONFLICT (id) DO NOTHING`,
    [
      CONFIG.precoKg, CONFIG.perda, CONFIG.moKg, CONFIG.moM2, CONFIG.moHora, CONFIG.moKm,
      CONFIG.markup, CONFIG.imposto, CONFIG.com1, CONFIG.com2,
      CONFIG.impMaterial, CONFIG.impIndust, CONFIG.impMo,
      CONFIG.validade, CONFIG.condPag, CONFIG.prazo,
      CONFIG.empresa, CONFIG.endereco, CONFIG.endereco2, CONFIG.fone, CONFIG.email, CONFIG.site,
      CONFIG.observacoes, CONFIG.seq
    ]
  )

  for (const [categoria, valores] of Object.entries(LISTAS)) {
    for (let i = 0; i < valores.length; i++) {
      await c.query(
        'INSERT INTO listas (categoria, valor, ordem) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [categoria, valores[i], i]
      )
    }
  }

  for (const x of CORES) {
    await c.query(
      `INSERT INTO cores (id, cod, nome, acabamento, fornecedor, preco_kg, preco_m2, ativo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [x.id, x.cod, x.nome, x.acabamento, x.fornecedor, x.precoKg, x.precoM2, x.ativo]
    )
  }

  for (const x of ACESSORIOS) {
    await c.query(
      `INSERT INTO acessorios (id, cod, nome, grupo, fornecedor, unidade, preco, ativo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [x.id, x.cod, x.nome, x.grupo, x.fornecedor, x.unidade, x.preco, x.ativo]
    )
  }

  for (const k of KITS) {
    await c.query(
      'INSERT INTO kits (id, cod, nome, aplicacao) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',
      [k.id, k.cod, k.nome, k.aplicacao]
    )
    for (let i = 0; i < k.itens.length; i++) {
      const it = k.itens[i]
      await c.query(
        'INSERT INTO kit_itens (kit_id, aces_id, qtd, ordem) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [k.id, it.acesId, it.qtd, i]
      )
    }
  }

  for (const m of MATERIAIS) {
    await c.query(
      `INSERT INTO materiais (
         id, cod, descricao, serie, tipo, unidade, peso_unit, larg, alt, preco, fc,
         cor_id, kit_id, img, img_data, markup, imposto, comissao, mo_m2
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NULL,$15,$16,$17,$18)
       ON CONFLICT (id) DO NOTHING`,
      [
        m.id, m.cod, m.desc, m.serie, m.tipo, m.unidade, m.pesoUnit, m.larg, m.alt, m.preco, m.fc,
        m.corId || null, m.kitId || null, m.img, m.markup, m.imposto, m.comissao, m.moM2
      ]
    )
    for (let i = 0; i < m.aces.length; i++) {
      const a = m.aces[i]
      await c.query(
        'INSERT INTO material_acessorios (material_id, aces_id, qtd, ordem) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [m.id, a.acesId, a.qtd, i]
      )
    }
  }

  for (const k of KITS_VENDA) {
    await c.query(
      'INSERT INTO kits_venda (id, cod, nome, descricao) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',
      [k.id, k.cod, k.nome, k.descricao]
    )
    for (let i = 0; i < k.itens.length; i++) {
      const it = k.itens[i]
      await c.query(
        'INSERT INTO kit_venda_itens (kit_id, material_id, qtd, ordem) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [k.id, it.matId, it.qtd, i]
      )
    }
  }

  for (const x of INSTALADORES) {
    await c.query(
      `INSERT INTO instaladores (
         id, cod, nome, tipo, doc, responsavel, fone, regiao, preco_m2, diaria, equipe, ativo, obs
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
      [x.id, x.cod, x.nome, x.tipo, x.doc, x.responsavel, x.fone, x.regiao,
        x.precoM2, x.diaria, x.equipe, x.ativo, x.obs]
    )
  }

  for (const u of USUARIOS) {
    const hash = bcrypt.hashSync(u.senha, 10)
    await c.query(
      `INSERT INTO usuarios (id, nome, usuario, senha_hash, perfil, ativo)
       VALUES ($1,$2,$3,$4,$5,true) ON CONFLICT (usuario) DO NOTHING`,
      [u.id, u.nome, u.usuario, hash, u.perfil]
    )
  }
}

/** Insere clientes e propostas de demonstração. Acionado em Configurações. */
export async function carregarExemplo(c: PoolClient): Promise<void> {
  await c.query('BEGIN')
  try {
    for (const x of CLIENTES_EXEMPLO) {
      await c.query(
        `INSERT INTO clientes (id, nome, razao, cnpj, endereco, cidade, contato, fone, email)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [x.id, x.nome, x.razao, x.cnpj, x.endereco, x.cidade, x.contato, x.fone, x.email]
      )
    }
    for (const o of ORCAMENTOS_EXEMPLO) {
      await c.query(
        `INSERT INTO orcamentos (
           id, numero, rev, status, data, vendedor, enviada_em, cliente_id, obra, cidade,
           contato, prazo, cond_pag, instalador_id, mo_m2, mo_horas, mo_hora, mo_pct, mo_fixo,
           km, mo_km, frete, terceiros, outros, markup, imposto, com1, com2, perda, desconto
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                   $21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
         ON CONFLICT (id) DO NOTHING`,
        [
          o.id, o.numero, o.rev, o.status, o.data, o.vendedor, o.enviadaEm, o.clienteId,
          o.obra, o.cidade, o.contato, o.prazo, o.condPag, o.instaladorId,
          o.moM2, o.moHoras, o.moHora, o.moPct, o.moFixo, o.km, o.moKm,
          o.frete, o.terceiros, o.outros, o.markup, o.imposto, o.com1, o.com2, o.perda, o.desconto
        ]
      )
      for (let i = 0; i < o.itens.length; i++) {
        const it = o.itens[i]
        await c.query(
          `INSERT INTO orcamento_itens (
             orcamento_id, ordem, material_id, qtd, larg, alt, local, descricao, serie,
             perfil, vidro, detalhe, markup, fc
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT DO NOTHING`,
          [o.id, i, it.matId, it.qtd, it.larg, it.alt, it.local, it.desc, it.serie,
            it.perfil, it.vidro, it.detalhe, it.markup, it.fc]
        )
      }
    }
    await c.query('UPDATE config SET seq = GREATEST(seq, 35) WHERE id')
    await c.query('COMMIT')
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  }
}
