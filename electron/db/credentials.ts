/**
 * Credenciais da aplicação no PostgreSQL.
 *
 * São as mesmas em todas as máquinas — é isso que permite o cliente achar o
 * servidor e conectar sem nenhuma configuração manual. O instalador cria essa
 * role no PC servidor com exatamente estes valores.
 *
 * Para trocar a senha depois da implantação: altere aqui, rode
 *   ALTER ROLE estrudena WITH PASSWORD '<nova>';
 * no servidor e reinstale os clientes.
 */
export const DB_NAME = 'estrudena'
export const DB_USER = 'estrudena'
export const DB_PASSWORD = 'Estrud3na!Db'
export const DB_PORT = 5432

/** Porta usada só na varredura de rede. */
export const SCAN_PORT = DB_PORT
