Sistema Estrudena 1.4.2: "comprado pronto" no cadastro do produto.

### O que mudou

- A ficha do produto (**Dados gerais**) ganhou a opção **Comprado pronto (revenda, sem fabricação)**. No catálogo, esses produtos aparecem com o selo "Comprado pronto".
- Na **liberação do pedido**, os produtos marcados no cadastro já vêm selecionados, com a indicação "pelo cadastro". A lista só abre sozinha quando algum produto está sem composição e sem marcação. Em um pedido específico, a marcação ainda pode ser ajustada.
- A regra continua a mesma: cada produto precisa de composição ou estar marcado como comprado pronto para liberar o pedido. Produtos comprados prontos não passam pela separação de matérias-primas.

### Depois de atualizar

Os produtos existentes começam desmarcados. Um administrador deve marcar uma vez, em **Catálogo → Produtos**, os produtos que a empresa compra prontos para revender.

### Como atualizar

Atualize o servidor e todos os terminais pelo **Atualizar e reiniciar** ou com `Sistema-Estrudena-Setup-1.4.2.exe`. O banco continua no schema v8: a nova informação do produto é criada automaticamente na primeira conexão, sem migração. Um terminal ainda na 1.4.1 não mostra a opção, mas também não apaga a marcação ao salvar um produto.

### Verificação

Compilação, typecheck e executável empacotado conferidos. Testes com banco isolado cobrem a gravação da marcação no produto e o fato de ela não se aplicar a matérias-primas (`teste:catalogo`). O teste de interface marca o produto na ficha, confere que a liberação já o traz marcado e ajusta a marcação no pedido (`teste:ux`), além de `teste:negocio`, `teste:permissoes` e `teste`.
