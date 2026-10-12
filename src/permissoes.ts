import type { ComandoNegocio, Perfil } from './shared/types'
export const PERFIS: Perfil[] = ['Administrador','Vendedor','Produção']
export const RECURSOS = [
 ['valores','Valores, custos e margens','Dados financeiros','Exibe valores comerciais nos dados e documentos permitidos.'],
 ['orcamentos','Orçamentos e propostas','Comercial','Criar, revisar, emitir e enviar propostas.'],
 ['clientes','Clientes','Comercial','Consultar, cadastrar e editar clientes.'],
 ['aprovar','Aprovar propostas','Comercial','Registrar aceite inicial e gerar o pedido de venda.'],
 ['aditivos','Aprovar aditivos','Comercial','Substituir a revisão aceita, respeitando as regras do pedido.'],
 ['pedidos','Consultar pedidos','Operação','Consultar pedidos de venda, documentos e andamento.'],
 ['planejamento','Planejar pedidos','Operação','Alterar prazo e prioridade.'],
 ['producao','Produção, entrega e instalação','Operação','Liberar produção, conferir separação e registrar a execução.'],
 ['cancelar','Cancelar pedidos','Operação','Cancelar um pedido com motivo e histórico.'],
 ['produtos','Produtos','Catálogo','Consultar, cadastrar e editar produtos e composições.'],
 ['materias_primas','Matérias-primas','Catálogo','Consultar, cadastrar e editar insumos e seus custos.'],
 ['apoio','Cadastros de apoio','Catálogo','Gerenciar cores, ferragens, kits e equipes.'],
 ['excluir','Excluir cadastros','Catálogo','Excluir registros das áreas liberadas, respeitando vínculos e histórico.'],
 ['relatorios','Resultados e relatórios','Gestão','Acessar os resultados comerciais.'],
 ['config','Configurações da empresa','Gestão','Alterar padrões e listas da empresa.'],
 ['sistema','Manutenção e exportação','Gestão','Exportar dados, gerenciar atualizações e adicionar exemplos.'],
 ['usuarios','Usuários e matriz','Gestão','Exclusivo de administradores.']
] as const
export type Permissao = typeof RECURSOS[number][0]
export type MatrizPermissoes = Record<Perfil,Record<Permissao,boolean>>
export interface PoliticaPermissoes { matriz:MatrizPermissoes; versao:number; atualizadoPor:string; atualizadoEm:string }
export const DEPENDENCIAS: Partial<Record<Permissao,Permissao[]>> = {
 orcamentos:['valores'], aprovar:['orcamentos','pedidos'],aditivos:['aprovar'],planejamento:['pedidos'],producao:['pedidos'],cancelar:['pedidos'],
 produtos:['valores'],materias_primas:['valores'],apoio:['valores'],relatorios:['valores'],config:['valores'],sistema:['config']
}
export function matrizPadrao():MatrizPermissoes {
 const vendedor:Permissao[]=['valores','orcamentos','clientes','aprovar','pedidos','planejamento']
 const producao:Permissao[]=['pedidos','planejamento','producao']
 return Object.fromEntries(PERFIS.map(p=>[p,Object.fromEntries(RECURSOS.map(([k])=>[k,p==='Administrador'||(p==='Vendedor'?vendedor:producao).includes(k)]))])) as MatrizPermissoes
}
export function pode(matriz:MatrizPermissoes|undefined,perfil:Perfil,p:Permissao):boolean {
 if(perfil==='Administrador')return true
 if(p==='usuarios')return false
 const m=matriz||matrizPadrao()
 return m[perfil]?.[p]===true&&(DEPENDENCIAS[p]||[]).every(dep=>pode(m,perfil,dep))
}
export function alterarPermissao(m:MatrizPermissoes,perfil:Perfil,p:Permissao,valor:boolean):MatrizPermissoes {
 const nova=structuredClone(m)
 if(perfil==='Administrador'||p==='usuarios')return nova
 const ativar=(id:Permissao)=>{nova[perfil][id]=true;for(const dep of DEPENDENCIAS[id]||[])ativar(dep)}
 if(valor)ativar(p)
 else {nova[perfil][p]=false;for(let n=0;n<RECURSOS.length;n++)for(const [id]of RECURSOS)if(!pode(nova,perfil,id))nova[perfil][id]=false}
 return nova
}
export const PERMISSAO_TELA:Record<string,Permissao|undefined>={dashboard:undefined,novo:'orcamentos',lista:'orcamentos',clientes:'clientes',pedidos:'pedidos',separacao:'producao',itens:'produtos',materiasprimas:'materias_primas',apoio:'apoio',cores:'apoio',acessorios:'apoio',kits:'apoio',kitsvenda:'apoio',instaladores:'apoio',relatorios:'relatorios',config:'config',usuarios:'usuarios'}
export function permissaoComando(acao:ComandoNegocio['acao']):Permissao {
 if(['enviar','negociar','recusar','expirar'].includes(acao))return 'orcamentos'
 if(acao==='aprovar')return 'aprovar'
 if(acao==='planejar')return 'planejamento'
 if(acao==='cancelar')return 'cancelar'
 if(acao==='regularizar')return 'aprovar'
 return 'producao'
}
