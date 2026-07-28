/**
 * Dados de catálogo da Estrudena, extraídos da planilha original
 * (`referencia/planilha-original.xlsm`, abas DADOS ALUMÍNIO e ALUMÍNIO).
 * Vão para o banco na primeira instalação.
 */

export interface SeedMaterial {
  id: string; cod: string; desc: string; serie: string; tipo: string
  unidade: 'KG' | 'M2' | 'UN' | 'ML'
  pesoUnit: number; larg: number | null; alt: number | null; preco: number; fc: number
  corId: string; kitId: string; img: string
  markup: number; imposto: number; comissao: number; moM2: number
  aces: { acesId: string; qtd: number }[]
}

const AL = (
  cod: string, desc: string, peso: number, larg: number, alt: number,
  serie: string, kitId: string, img: string
): SeedMaterial => ({
  id: cod, cod, desc, serie, tipo: 'ALUMÍNIO', unidade: 'KG',
  pesoUnit: peso, larg, alt, preco: 0, fc: 1,
  corId: 'RAL9005', kitId, img,
  markup: 52, imposto: 7, comissao: 5, moM2: 170.24, aces: []
})

const SUP = (
  cod: string, desc: string, tipo: string, preco: number,
  larg: number, alt: number, markup = 45, moM2 = 95
): SeedMaterial => ({
  id: cod, cod, desc, serie: '—', tipo, unidade: 'M2',
  pesoUnit: 0, larg, alt, preco, fc: 1,
  corId: '', kitId: '', img: '',
  markup, imposto: 7, comissao: 5, moM2, aces: []
})

export const MATERIAIS: SeedMaterial[] = [
  AL('PA150', 'PORTA DE CORRER 03 FOLHAS SENDO 01 P/ RECEBER VIDRO', 34.90, 1500, 2100, 'SUPREMA', 'KIT-PC3', 'tip-PA150'),
  AL('PA290', 'PORTA DE CORRER 03 FOLHAS', 27.70, 2900, 2100, 'SUPREMA', 'KIT-PC3', 'tip-PA300'),
  AL('PA300', 'PORTA DE CORRER 03 FOLHAS', 28.10, 3000, 2100, 'SUPREMA', 'KIT-PC3', 'tip-PA300'),
  AL('PA240', 'PORTA DE CORRER 03 FOLHAS', 41.50, 2400, 2100, 'SUPREMA', 'KIT-PC3', 'tip-PA240'),
  AL('PA100', 'PORTA DE GIRO 01 FOLHA COM FECHAMENTO', 18.30, 1000, 2150, 'SUPREMA (P60)', 'KIT-PG1', 'tip-PA70'),
  AL('PA70', 'PORTA DE GIRO 01 FOLHA EM VENEZIANA VENTILADA (US285)', 14.10, 700, 2150, 'SUPREMA (P60)', 'KIT-VZ', 'tip-PA70'),
  AL('PA60', 'PORTINHOLA DE GIRO 01 FOLHA COM FECHAMENTO', 8.10, 600, 1200, 'SUPREMA (P60)', 'KIT-PG1', 'tip-PA60'),
  AL('JA60', 'JANELA MAXIM-AR 01 MÓDULO', 2.70, 600, 600, 'SUPREMA', 'KIT-MX1', 'tip-JA60'),
  AL('JA120', 'JANELA DE CORRER 02 FOLHAS', 4.80, 1200, 400, 'SUPREMA', 'KIT-JC2', 'tip-JA120'),
  AL('JA140', 'JANELA DE CORRER 02 FOLHAS', 6.40, 1400, 1000, 'SUPREMA', 'KIT-JC2', 'tip-JA140'),
  AL('JA150', 'JANELA DE CORRER 02 FOLHAS', 8.30, 1500, 1000, 'SUPREMA', 'KIT-JC2', 'tip-JA150'),
  AL('VA100', 'PAINEL FIXO 01 MÓDULO C/ VENEZIANA VZ060', 4.30, 1000, 500, 'VENEZIANAS', 'KIT-VZ', 'tip-VA100'),
  AL('VA80', 'PAINEL FIXO 01 MÓDULO C/ VENEZIANA VZ060', 5.20, 800, 1000, 'VENEZIANAS', 'KIT-VZ', 'tip-VA80'),
  AL('AL01', 'PORTA PIVOTANTE 01 FOLHA C/ FIXOS LATERAIS', 25.90, 7010, 2380, 'TEMPERADOS', 'KIT-PIV', 'tip-AL01'),
  {
    ...AL('CM150', 'FORNECIMENTO DE CONTRAMARCO', 22.65, 1500, 2100, 'CONTRAMARCO', '', ''),
    tipo: 'CONTRAMARCO', markup: 38, moM2: 7.19, corId: 'NAT'
  },
  SUP('VD06L', 'LAMINADO INCOLOR 06MM', 'LAMINADO', 148, 1500, 2100),
  SUP('VD34P', 'PONTILHADO 03/04MM', 'VIDRO COMUM', 74, 600, 600),
  {
    ...SUP('TP08', 'TEMPERADO INCOLOR 08MM', 'TEMPERADO', 205, 1280, 2380, 48),
    serie: 'GMS',
    aces: [{ acesId: 'PX800', qtd: 1 }, { acesId: 'SL01', qtd: 1 }]
  },
  {
    ...SUP('ACM4', 'ACM ALUCOMAXX 4MM', 'ACM', 189, 3210, 2400, 50),
    corId: 'RAL9005',
    aces: [{ acesId: 'SL01', qtd: 2 }]
  }
]

export const CORES = [
  { id: 'NAT', cod: 'NAT', nome: 'NATURAL (SEM PINTURA)', acabamento: 'Natural', fornecedor: 'Extrusora', precoKg: 0, precoM2: 0, ativo: true },
  { id: 'PST', cod: 'PST', nome: 'PRETO STILL COLOR', acabamento: 'Pintura', fornecedor: 'Still Color', precoKg: 5.00, precoM2: 0, ativo: true },
  { id: 'RAL9005', cod: 'RAL9005', nome: 'PRETO FOSCO RAL 9005', acabamento: 'Pintura', fornecedor: 'Extrusora + Still', precoKg: 31.90, precoM2: 22.00, ativo: true },
  { id: 'HERA', cod: 'HERA', nome: 'PRETO HERA', acabamento: 'Pintura', fornecedor: 'Hera', precoKg: 26.90, precoM2: 0, ativo: true },
  { id: 'ALN', cod: 'ALN', nome: 'PRETO ALUMINORTE', acabamento: 'Pintura', fornecedor: 'Aluminorte', precoKg: 36.50, precoM2: 0, ativo: true },
  { id: 'DEC', cod: 'DEC', nome: 'PRETO DECAMP', acabamento: 'Pintura', fornecedor: 'Decamp', precoKg: 38.40, precoM2: 0, ativo: true },
  { id: 'BRZ', cod: 'BRZ', nome: 'BRONZE ANODIZADO', acabamento: 'Anodizado', fornecedor: 'Extrusora', precoKg: 14.80, precoM2: 0, ativo: true },
  { id: 'BRC', cod: 'BRC', nome: 'BRANCO RAL 9010', acabamento: 'Pintura', fornecedor: 'Still Color', precoKg: 28.40, precoM2: 20.00, ativo: true }
]

export const ACESSORIOS = [
  { id: 'RD01', cod: 'RD01', nome: 'ROLDANA DUPLA ZAMAC', grupo: 'Ferragem', fornecedor: 'Roto Fermax', unidade: 'UN', preco: 18.50, ativo: true },
  { id: 'FC01', cod: 'FC01', nome: 'FECHO CONCHA', grupo: 'Ferragem', fornecedor: 'Udinese', unidade: 'UN', preco: 12.90, ativo: true },
  { id: 'TQ01', cod: 'TQ01', nome: 'TRANQUETA PARA VENEZIANA', grupo: 'Ferragem', fornecedor: 'M Rodrigues', unidade: 'UN', preco: 9.40, ativo: true },
  { id: 'BC01', cod: 'BC01', nome: 'BRAÇO MAXIM-AR', grupo: 'Ferragem', fornecedor: 'Roto Fermax', unidade: 'UN', preco: 26.00, ativo: true },
  { id: 'PV01', cod: 'PV01', nome: 'PIVÔ PARA PORTA PIVOTANTE', grupo: 'Ferragem', fornecedor: 'Alumiconte', unidade: 'UN', preco: 168.00, ativo: true },
  { id: 'FE50', cod: 'FE50', nome: 'FECHADURA STAM', grupo: 'Fechadura', fornecedor: 'Stam', unidade: 'UN', preco: 50.00, ativo: true },
  { id: 'PX800', cod: 'PX800', nome: 'PUXADOR INOX 800MM', grupo: 'Puxador', fornecedor: 'Alumiconte', unidade: 'UN', preco: 210.00, ativo: true },
  { id: 'ES01', cod: 'ES01', nome: 'ESCOVA DE VEDAÇÃO', grupo: 'Vedação', fornecedor: 'Udinese', unidade: 'ML', preco: 4.20, ativo: true },
  { id: 'BR01', cod: 'BR01', nome: 'BORRACHA EPDM', grupo: 'Vedação', fornecedor: 'Udinese', unidade: 'ML', preco: 3.10, ativo: true },
  { id: 'SL01', cod: 'SL01', nome: 'SILICONE ESTRUTURAL 300ML', grupo: 'Vedação', fornecedor: 'Dow', unidade: 'UN', preco: 34.00, ativo: true },
  { id: 'PF01', cod: 'PF01', nome: 'PARAFUSO INOX AUTOBROCANTE (CENTO)', grupo: 'Outros', fornecedor: 'Ciser', unidade: 'UN', preco: 42.00, ativo: true },
  { id: 'CL01', cod: 'CL01', nome: 'CALÇO / CONTRAPESO', grupo: 'Outros', fornecedor: 'Diversos', unidade: 'UN', preco: 3.80, ativo: true }
]

export const KITS = [
  { id: 'KIT-PC3', cod: 'KIT-PC3', nome: 'FERRAGEM PORTA DE CORRER 03 FOLHAS', aplicacao: 'Linha Suprema — PA150 / PA290 / PA300 / PA240', itens: [{ acesId: 'RD01', qtd: 6 }, { acesId: 'FC01', qtd: 1 }, { acesId: 'ES01', qtd: 8 }, { acesId: 'BR01', qtd: 12 }, { acesId: 'PF01', qtd: 0.4 }] },
  { id: 'KIT-JC2', cod: 'KIT-JC2', nome: 'FERRAGEM JANELA DE CORRER 02 FOLHAS', aplicacao: 'JA120 / JA140 / JA150', itens: [{ acesId: 'RD01', qtd: 4 }, { acesId: 'FC01', qtd: 1 }, { acesId: 'ES01', qtd: 6 }, { acesId: 'BR01', qtd: 8 }, { acesId: 'PF01', qtd: 0.3 }] },
  { id: 'KIT-MX1', cod: 'KIT-MX1', nome: 'FERRAGEM MAXIM-AR 01 MÓDULO', aplicacao: 'JA60 e similares', itens: [{ acesId: 'BC01', qtd: 2 }, { acesId: 'BR01', qtd: 3 }, { acesId: 'PF01', qtd: 0.2 }] },
  { id: 'KIT-PG1', cod: 'KIT-PG1', nome: 'FERRAGEM PORTA DE GIRO 01 FOLHA', aplicacao: 'PA100 / PA60', itens: [{ acesId: 'FE50', qtd: 1 }, { acesId: 'BR01', qtd: 6 }, { acesId: 'PF01', qtd: 0.3 }] },
  { id: 'KIT-VZ', cod: 'KIT-VZ', nome: 'FERRAGEM VENEZIANA VENTILADA', aplicacao: 'PA70 / VA100 / VA80', itens: [{ acesId: 'TQ01', qtd: 1 }, { acesId: 'BR01', qtd: 4 }, { acesId: 'PF01', qtd: 0.3 }] },
  { id: 'KIT-PIV', cod: 'KIT-PIV', nome: 'FERRAGEM PORTA PIVOTANTE', aplicacao: 'AL01 — Linha 42', itens: [{ acesId: 'PV01', qtd: 1 }, { acesId: 'PX800', qtd: 1 }, { acesId: 'FE50', qtd: 1 }, { acesId: 'BR01', qtd: 10 }, { acesId: 'SL01', qtd: 2 }] }
]

export const KITS_VENDA = [
  { id: 'KV-APTO2D', cod: 'KV-APTO2D', nome: 'APARTAMENTO TIPO — 02 DORMITÓRIOS', descricao: 'Conjunto padrão por unidade: sacada, banhos, hall e cozinha', itens: [{ matId: 'PA150', qtd: 1 }, { matId: 'JA60', qtd: 2 }, { matId: 'PA70', qtd: 1 }, { matId: 'JA140', qtd: 1 }] },
  { id: 'KV-APTO3D', cod: 'KV-APTO3D', nome: 'APARTAMENTO TIPO — 03 DORMITÓRIOS', descricao: 'Conjunto padrão por unidade de 3 dormitórios', itens: [{ matId: 'PA300', qtd: 1 }, { matId: 'JA60', qtd: 3 }, { matId: 'PA70', qtd: 1 }, { matId: 'JA140', qtd: 2 }] },
  { id: 'KV-VARANDA', cod: 'KV-VARANDA', nome: 'VARANDA GOURMET PADRÃO', descricao: 'Porta de correr 3 folhas + painéis de ventilação', itens: [{ matId: 'PA290', qtd: 1 }, { matId: 'VA100', qtd: 2 }] },
  { id: 'KV-AREACOM', cod: 'KV-AREACOM', nome: 'ÁREA COMUM — GUARITA E LIXEIRAS', descricao: 'Pacote de térreo e subsolo', itens: [{ matId: 'PA100', qtd: 1 }, { matId: 'JA150', qtd: 1 }, { matId: 'VA80', qtd: 2 }] },
  { id: 'KV-COBERT', cod: 'KV-COBERT', nome: 'COBERTURA — HALL PISCINA', descricao: 'Acesso pivotante em temperado + porta de correr ampla', itens: [{ matId: 'PA240', qtd: 1 }, { matId: 'AL01', qtd: 1 }, { matId: 'TP08', qtd: 2 }] }
]

export const INSTALADORES = [
  { id: 'EQ01', cod: 'EQ01', nome: 'EQUIPE PRÓPRIA A', tipo: 'Própria', doc: '', responsavel: 'Valdir Souza', fone: '(19) 99114-2088', regiao: 'Americana e região', precoM2: 170.24, diaria: 780, equipe: 4, ativo: true, obs: 'Equipe base de fábrica — esquadrias e contramarco.' },
  { id: 'EQ02', cod: 'EQ02', nome: 'EQUIPE PRÓPRIA B', tipo: 'Própria', doc: '', responsavel: 'Nelson Ribeiro', fone: '(19) 99730-5514', regiao: 'Campinas e RMC', precoM2: 165.00, diaria: 740, equipe: 3, ativo: true, obs: '' },
  { id: 'TC01', cod: 'TC01', nome: 'MONTAL ESQUADRIAS', tipo: 'Terceirizada', doc: '21.554.870/0001-33', responsavel: 'Sérgio Mattos', fone: '(12) 99845-1170', regiao: 'Litoral Norte — Ubatuba e Caraguatatuba', precoM2: 198.00, diaria: 920, equipe: 5, ativo: true, obs: 'Cobra deslocamento à parte acima de 120 km.' },
  { id: 'TC02', cod: 'TC02', nome: 'VIDRAÇARIA SANTA RITA', tipo: 'Terceirizada', doc: '33.902.144/0001-08', responsavel: 'Rita Camargo', fone: '(19) 3452 7790', regiao: 'Limeira e região', precoM2: 182.00, diaria: 860, equipe: 3, ativo: false, obs: 'Inativa desde nov/25 — pendente de renovação de ART.' }
]

export const LISTAS: Record<string, string[]> = {
  series: ['SUPREMA', 'SUPREMA (P60)', 'LINHA 42 (P70)', 'CONTRAMARCO', 'VENEZIANAS', 'TEMPERADOS', 'GMS', 'FPPRO', 'OTIMIZAÇÃO', '—'],
  tipos: ['ALUMÍNIO', 'CONTRAMARCO', 'VIDRO COMUM', 'LAMINADO', 'TEMPERADO', 'ACM', 'DIVERSOS'],
  acesGrupos: ['Ferragem', 'Fechadura', 'Puxador', 'Vedação', 'Outros'],
  acabamentos: ['Pintura', 'Anodizado', 'Natural', 'Especial'],
  fornecedores: ['Extrusora', 'Extrusora + Still', 'Still Color', 'Hera', 'Aluminorte', 'Decamp', 'Roto Fermax', 'Udinese', 'M Rodrigues', 'Alumiconte', 'Stam', 'Dow', 'Ciser', 'GMS', 'Diversos'],
  condicoesPag: ['A COMBINAR', 'À VISTA', '30 DIAS', '30/60 DIAS', '30/60/90 DIAS', 'ENTRADA + 2X', '50% ENTRADA / 50% NA ENTREGA', '10% ENTRADA / SALDO EM 6X'],
  prazosEntrega: ['A COMBINAR', '25 DIAS APÓS APROVAÇÃO', '30 DIAS APÓS APROVAÇÃO DO PROJETO', '45 DIAS APÓS APROVAÇÃO DO PROJETO', '60 DIAS APÓS APROVAÇÃO DO PROJETO', '90 DIAS APÓS APROVAÇÃO DO PROJETO', 'ENTREGA PARCELADA CONFORME CRONOGRAMA'],
  tiposEquipe: ['Própria', 'Terceirizada', 'Autônomo']
}

export const CONFIG = {
  precoKg: 35.25, perda: 0, moKg: 4.73, moM2: 170.24, moHora: 780, moKm: 4.20,
  markup: 52, imposto: 7, com1: 5, com2: 0,
  impMaterial: 50, impIndust: 40, impMo: 10,
  validade: 15, condPag: 'A COMBINAR', prazo: '45 DIAS APÓS APROVAÇÃO DO PROJETO',
  empresa: 'ESTRUDENA', endereco: 'RUA QUINTINO BOCAIÚVA, 1591',
  endereco2: 'NOVA AMERICANA - CEP 13466-300 - AMERICANA/SP',
  fone: 'FONE/FAX: 19 3406 5236', email: 'aluminio@estrudena.com.br', site: 'www.estrudena.com.br',
  observacoes: [
    '1- FRETE E INSTALAÇÃO INCLUSOS',
    '2- MATERIA-PRIMA FATURADA PARA O CLIENTE',
    '3- INCLUSO SOMENTE NF DE SERVIÇO',
    '4- VIDROS INCLUSOS',
    '5- BALANCIM, ANDAIMES E PLATAFORMAS NÃO INCLUSOS',
    '6- LIMPEZA PÓS OBRA DOS CAIXILHOS NÃO INCLUSO'
  ],
  seq: 0
}

/** Usuários criados na instalação. Senha inicial igual para os três. */
export const USUARIOS = [
  { id: 'u-wilson', nome: 'Wilson', usuario: 'wilson', perfil: 'Administrador', senha: 'estrudena' },
  { id: 'u-ana', nome: 'Ana', usuario: 'ana', perfil: 'Administrador', senha: 'estrudena' },
  { id: 'u-producao', nome: 'Produção', usuario: 'producao', perfil: 'Produção', senha: 'estrudena' }
]

// ------------------------------------------------------------------ exemplo
// Carregado só sob demanda, pelo botão "restaurar dados de exemplo" em Configurações.

export const CLIENTES_EXEMPLO = [
  { id: 'c1', nome: 'PORTO BAY CONSTRUTORA', razao: 'PORTO BAY TENÓRIO I SPE LTDA', cnpj: '53.243.709/0001-84', endereco: 'Av. Carlos Drummond de Andrade, 216 — Barra da Lagoa', cidade: 'UBATUBA — SP', contato: 'Eng. Angélica Rocha', fone: '(12) 99708-9710', email: '' },
  { id: 'c2', nome: 'CONSTRUTORA ARAUCÁRIA', razao: 'ARAUCÁRIA ENGENHARIA LTDA', cnpj: '12.884.501/0001-09', endereco: 'Rua Ipiranga, 740 — Centro', cidade: 'AMERICANA — SP', contato: 'Eng. Paulo Ferraz', fone: '(19) 3406 8812', email: 'compras@araucariaeng.com.br' },
  { id: 'c3', nome: 'RESIDENCIAL MIRANTE SPE', razao: 'MIRANTE INCORPORAÇÕES SPE LTDA', cnpj: '44.109.772/0001-51', endereco: 'Av. Andrade Neves, 2210 — Cambuí', cidade: 'CAMPINAS — SP', contato: 'Sra. Helena Dias', fone: '(19) 99812-4470', email: 'helena@mirantespe.com.br' },
  { id: 'c4', nome: 'GRUPO NOVA ERA', razao: 'NOVA ERA EMPREENDIMENTOS LTDA', cnpj: '09.551.330/0001-72', endereco: 'Rod. Limeira—Piracicaba, km 8', cidade: 'LIMEIRA — SP', contato: 'Sr. Jonas Prado', fone: '(19) 3452 1180', email: 'jonas@gruponovaera.com.br' }
]

const it = (matId: string, qtd: number, local: string, vidro: string, larg?: number, alt?: number) => ({
  matId, qtd, local, desc: null, serie: null,
  perfil: 'PRETO FOSCO RAL 9005', vidro,
  larg: larg ?? null, alt: alt ?? null, detalhe: null, markup: null, fc: 1
})

const base = {
  moM2: 170.24, moHoras: 0, moHora: 780, moPct: 0, moFixo: 0, km: 0, moKm: 4.20,
  frete: 20000, terceiros: 0, outros: 15227.35, condPag: 'A COMBINAR',
  instaladorId: 'TC01', enviadaEm: '',
  markup: 52, imposto: 7, com1: 5, com2: 0, perda: 0, desconto: 0
}

export const ORCAMENTOS_EXEMPLO = [
  {
    ...base,
    id: 'o1', numero: '8026-01-26', rev: 'Rev. 05', clienteId: 'c1',
    obra: 'CONDOMÍNIO RESIDENCIAL PORTOBAY TENÓRIO', cidade: 'UBATUBA — SP',
    contato: 'Eng. Angélica Rocha', prazo: '45 DIAS APÓS APROVAÇÃO DO PROJETO',
    data: '07/05/2026', vendedor: 'Wilson', status: 'Aprovado', enviadaEm: '10/05/2026',
    itens: [
      it('PA150', 10, 'TIPO — APTO 1 E 2 — DORMITÓRIO', 'LAMINADO INCOLOR 06MM'),
      it('PA290', 5, 'TIPO — APTO 3 — VARANDA', 'LAMINADO INCOLOR 06MM'),
      it('PA300', 39, 'TIPO — APTOS 1,2,4 A 10 — VARANDA', 'LAMINADO INCOLOR 06MM'),
      it('JA60', 51, 'TIPO — APTOS 1 A 10 — BANHO', 'PONTILHADO 03/04MM'),
      it('PA70', 47, '1º A 4º PAV. TIPO — HALL SOCIAL', 'VENEZIANA'),
      it('JA120', 1, 'TÉRREO — BANHEIRO', 'PONTILHADO 03/04MM'),
      it('PA100', 3, 'TÉRREO — GUARITA', 'LAMINADO INCOLOR 06MM'),
      it('VA100', 2, 'SUBSOLO — GÁS E RESERVATÓRIOS', 'VENEZIANA'),
      it('PA240', 1, 'COBERTURA — HALL PISCINA', 'LAMINADO INCOLOR 06MM'),
      it('JA140', 4, 'TÉRREO — HOBBY BOX', 'PONTILHADO 03/04MM'),
      it('PA60', 1, 'PAVTO RESERV. — ACESSO CAIXA D’ÁGUA', '—'),
      it('AL01', 1, 'TÉRREO — HALL SOCIAL', 'TEMPERADO INCOLOR 08MM'),
      it('JA150', 1, 'SUBSOLO — LIXEIRAS E HOBBY', 'PONTILHADO 03/04MM')
    ]
  },
  {
    ...base,
    id: 'o2', numero: '8031-02-26', rev: 'Rev. 01', clienteId: 'c2',
    obra: 'EDIFÍCIO VISTA VERDE — TORRE B', cidade: 'AMERICANA — SP',
    contato: 'Eng. Paulo Ferraz', prazo: '30 DIAS APÓS APROVAÇÃO DO PROJETO',
    data: '19/06/2026', vendedor: 'Ana', status: 'Em análise',
    frete: 6800, outros: 0, enviadaEm: '20/06/2026',
    itens: [
      it('PA300', 18, 'TIPO — APTOS 1 A 6 — SACADA', 'LAMINADO INCOLOR 06MM'),
      it('JA140', 24, 'TIPO — APTOS 1 A 6 — COZINHA', 'PONTILHADO 03/04MM'),
      it('JA60', 12, 'TIPO — BANHOS', 'PONTILHADO 03/04MM'),
      it('CM150', 30, 'CONTRAMARCOS GERAIS', '—')
    ]
  },
  {
    ...base,
    id: 'o3', numero: '8034-03-26', rev: 'Rev. 00', clienteId: 'c3',
    obra: 'RESIDENCIAL MIRANTE — FACHADA COMERCIAL', cidade: 'CAMPINAS — SP',
    contato: 'Sra. Helena Dias', prazo: 'A COMBINAR',
    data: '02/07/2026', vendedor: 'Ana', status: 'Rascunho',
    frete: 3200, outros: 0, markup: 46,
    itens: [
      it('ACM4', 1, 'FACHADA FRONTAL', '—', 12000, 3400),
      it('TP08', 4, 'ACESSO PRINCIPAL', '—')
    ]
  },
  {
    ...base,
    id: 'o4', numero: '8029-02-26', rev: 'Rev. 02', clienteId: 'c1',
    obra: 'PORTOBAY TENÓRIO — GUARITA E LIXEIRAS', cidade: 'UBATUBA — SP',
    contato: 'Eng. Angélica Rocha', prazo: '25 DIAS APÓS APROVAÇÃO',
    data: '11/06/2026', vendedor: 'Wilson', status: 'Aprovado',
    frete: 1800, outros: 0,
    itens: [
      it('PA100', 2, 'TÉRREO — GUARITA', 'LAMINADO INCOLOR 06MM'),
      it('JA150', 3, 'SUBSOLO — LIXEIRAS', 'PONTILHADO 03/04MM'),
      it('VA80', 2, 'SUBSOLO — VENTILAÇÃO', 'VENEZIANA')
    ]
  },
  {
    ...base,
    id: 'o5', numero: '8018-11-25', rev: 'Rev. 03', clienteId: 'c4',
    obra: 'CENTRO LOGÍSTICO NOVA ERA — GALPÃO 2', cidade: 'LIMEIRA — SP',
    contato: 'Sr. Jonas Prado', prazo: '60 DIAS',
    data: '28/11/2025', vendedor: 'Ana', status: 'Perdido',
    frete: 9400, outros: 0, desconto: 6,
    itens: [
      it('JA140', 40, 'GALPÃO — VENTILAÇÃO ALTA', 'PONTILHADO 03/04MM'),
      it('PA240', 6, 'DOCAS', 'LAMINADO INCOLOR 06MM')
    ]
  }
]
