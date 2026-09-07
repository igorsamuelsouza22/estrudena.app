import type { Config } from './shared/types'
export type SecaoConfig = 'empresa' | 'propostas' | 'custos' | 'precos' | 'listas' | 'sistema'
export const SECOES_CONFIG: {id:SecaoConfig;titulo:string;descricao:string;numero:string}[] = [
 {id:'empresa',titulo:'Empresa',descricao:'Identidade e contatos nos documentos',numero:'01'},
 {id:'propostas',titulo:'Propostas',descricao:'Validade, condições e observações',numero:'02'},
 {id:'custos',titulo:'Custos e serviços',descricao:'Fabricação, instalação e deslocamento',numero:'03'},
 {id:'precos',titulo:'Preços e impostos',descricao:'Markup, comissões e rateio',numero:'04'},
 {id:'listas',titulo:'Listas de cadastro',descricao:'Opções usadas nos formulários',numero:'05'},
 {id:'sistema',titulo:'Sistema e dados',descricao:'Conexão, exportação e atualizações',numero:'06'}
]
export interface CampoConfig {id:keyof Config;titulo:string;secao:SecaoConfig;nota:string;unidade?:string;max?:number;inteiro?:boolean}
export const CAMPOS_CONFIG: CampoConfig[] = [
 {id:'empresa',titulo:'Nome da empresa',secao:'empresa',nota:'Identificação da empresa nos documentos.'},
 {id:'endereco',titulo:'Endereço',secao:'empresa',nota:'Rua, número e bairro.'},
 {id:'endereco2',titulo:'Complemento do endereço',secao:'empresa',nota:'Cidade, estado, CEP ou complemento.'},
 {id:'fone',titulo:'Telefone',secao:'empresa',nota:'Inclua o DDD para facilitar o contato.'},
 {id:'email',titulo:'E-mail',secao:'empresa',nota:'Contato apresentado ao cliente.'},
 {id:'site',titulo:'Site',secao:'empresa',nota:'Endereço do site da empresa.'},
 {id:'validade',titulo:'Validade da proposta',secao:'propostas',nota:'Dias contados a partir da emissão.',unidade:'dias',inteiro:true},
 {id:'condPag',titulo:'Condição de pagamento padrão',secao:'propostas',nota:'Vem preenchida em novos orçamentos e pode ser alterada em cada negociação.'},
 {id:'prazo',titulo:'Prazo de entrega padrão',secao:'propostas',nota:'Texto comercial da proposta. A data da produção é planejada no pedido.'},
 {id:'observacoes',titulo:'Observações da proposta',secao:'propostas',nota:'Uma observação por linha. Aparecem no documento do cliente.'},
 {id:'precoKg',titulo:'Alumínio de referência',secao:'custos',nota:'Usado nos produtos calculados por peso sem composição própria. Insumos da composição usam seus custos cadastrados.',unidade:'R$ / kg'},
 {id:'perda',titulo:'Perda prevista',secao:'custos',nota:'Percentual considerado no custo estimado da matéria-prima. Não representa baixa de estoque.',unidade:'%',max:100},
 {id:'moKg',titulo:'Mão de obra de fabricação',secao:'custos',nota:'Custo interno de produção por kg, usado na estimativa de margem.',unidade:'R$ / kg'},
 {id:'moM2',titulo:'Instalação por área',secao:'custos',nota:'Valor inicial da instalação por m² nos novos orçamentos.',unidade:'R$ / m²'},
 {id:'moHora',titulo:'Valor da diária de equipe',secao:'custos',nota:'Valor inicial usado com a quantidade de diárias informada no orçamento.',unidade:'R$ / diária'},
 {id:'moKm',titulo:'Deslocamento da equipe',secao:'custos',nota:'Valor por km para calcular o deslocamento no orçamento.',unidade:'R$ / km'},
 {id:'markup',titulo:'Markup padrão',secao:'precos',nota:'Neste sistema: preço de venda = custo ÷ (1 − percentual). Não é a margem líquida.',unidade:'%',max:97.99},
 {id:'imposto',titulo:'Imposto sobre a venda',secao:'precos',nota:'Percentual estimado sobre o valor da proposta.',unidade:'%',max:100},
 {id:'com1',titulo:'Comissão 1',secao:'precos',nota:'Percentual estimado sobre a venda. Não registra pagamento.',unidade:'%',max:100},
 {id:'com2',titulo:'Comissão 2',secao:'precos',nota:'Comissão adicional. Use zero quando não se aplicar.',unidade:'%',max:100},
 {id:'impMaterial',titulo:'Material',secao:'precos',nota:'Participação no rateio do faturamento.',unidade:'%',max:100},
 {id:'impIndust',titulo:'Industrialização',secao:'precos',nota:'Participação no rateio do faturamento.',unidade:'%',max:100},
 {id:'impMo',titulo:'Mão de obra de instalação',secao:'precos',nota:'Participação no rateio do faturamento.',unidade:'%',max:100}
]
export type ValoresConfig = Record<keyof Config,string>
export const valoresConfig = (c:Config):ValoresConfig => Object.fromEntries(CAMPOS_CONFIG.map(f=>[f.id,f.id==='observacoes'?c.observacoes.join('\n'):String(c[f.id])])) as ValoresConfig
export function montarConfig(valores:ValoresConfig):Config {
 return Object.fromEntries(CAMPOS_CONFIG.map(f=>[f.id,f.unidade?Number(valores[f.id].trim().replace(',','.')):f.id==='observacoes'?valores[f.id].replace(/\s+$/,'').split('\n').filter((x,i,a)=>x||i<a.length-1):valores[f.id].trim()])) as unknown as Config
}
export function errosConfig(c:Config, valores?:ValoresConfig):Partial<Record<keyof Config,string>> {
 const erros:Partial<Record<keyof Config,string>>={}
 for(const f of CAMPOS_CONFIG){
  if(f.unidade){const n=c[f.id] as number
   if(valores && !valores[f.id].trim() || typeof n!=='number'||!Number.isFinite(n)||n<0)erros[f.id]='Informe um número maior ou igual a zero.'
   else if(f.max!==undefined&&n>f.max)erros[f.id]=`Use no máximo ${f.max.toLocaleString('pt-BR')}%.`
   else if(f.inteiro&&(!Number.isInteger(n)||n<1))erros[f.id]='Informe pelo menos 1 dia, sem casas decimais.'
  }else if(f.id==='observacoes'){if(!Array.isArray(c.observacoes)||c.observacoes.some(x=>typeof x!=='string'))erros.observacoes='Informe uma observação por linha.'}
  else if(typeof c[f.id]!=='string')erros[f.id]='Informe um texto válido.'
 }
 for(const k of ['empresa','condPag','prazo'] as const)if(!c[k]?.trim())erros[k]='Preencha este campo.'
 if(c.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))erros.email='Confira o endereço de e-mail.'
 if(Math.abs(c.impMaterial+c.impIndust+c.impMo-100)>.00001)erros.impMaterial='O rateio precisa somar 100%.'
 return erros
}
