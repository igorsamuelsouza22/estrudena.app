Sistema Estrudena 1.3.0: novo visual, produtos com composição, fluxo de pedidos e permissões por perfil.

### O que mudou

- Interface clara com as cores da Estrudena, submenus de Catálogo e Gestão, busca global e proteção de rascunhos.
- Produtos prontos separados das matérias-primas, com composição e cálculo de custos por produto.
- Propostas com revisões `numero.rev1`, `numero.rev2` e histórico preservado. O aceite gera um pedido de venda vinculado à revisão aprovada.
- Acompanhamento de liberação, separação, fabricação, conferência, entregas parciais e instalação.
- Configurações organizadas por assunto, com prévias, validação, revisão das alterações e proteção contra gravações concorrentes.
- Matriz de permissões editável em Gestão → Pessoas e acessos. Os acessos são salvos no banco e validados nos menus e nas ações do sistema.

### Como atualizar

1. Faça um backup do banco no servidor e salve os trabalhos abertos.
2. Feche os aplicativos da equipe e atualize primeiro o servidor, depois todos os terminais, usando `Sistema-Estrudena-Setup-1.3.0.exe`.
3. Abra o servidor para concluir a migração automática do banco. Depois, abra os terminais.
4. Um administrador pode revisar os acessos em Gestão → Pessoas e acessos.

O instalador preserva o banco existente. Esta versão atualiza o schema para v7; mantenha servidor e terminais na mesma versão para que todos apliquem as regras de revisões, pedidos e permissões. Pedidos importados de propostas antigas aprovadas pedem conferência antes da liberação.

Quem usa o canal de atualização do GitHub receberá o aviso no aplicativo após a próxima consulta. O instalador também pode ser baixado diretamente nesta release. Windows 10/11, 64 bits.
