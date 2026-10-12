Sistema Estrudena 1.4.1: revisão nova só depois de emitir.

### O que mudou

- **Salvar rascunho** grava na mesma revisão. Antes, cada gravação com alteração criava uma revisão nova, e um orçamento podia chegar à rev5 antes de ir ao cliente.
- **Gerar proposta** emite essa mesma revisão: a primeira proposta enviada é sempre a rev1.
- Uma revisão nova (rev2, rev3…) só nasce em **Criar revisão**, a partir de uma proposta já emitida. A anterior continua no histórico.
- Cada gravação continua registrada no histórico de eventos, com autor e data. A proteção contra duas pessoas gravando o mesmo rascunho e o bloqueio de editar revisão emitida não mudaram.

As revisões intermediárias criadas nas versões anteriores continuam no histórico dos orçamentos antigos.

### Como atualizar

Atualize o servidor e todos os terminais pelo **Atualizar e reiniciar** ou com `Sistema-Estrudena-Setup-1.4.1.exe`. O banco continua no schema v8 e não há migração. Um terminal que ficar na 1.4.0 continua criando uma revisão a cada gravação.

### Verificação

Compilação, typecheck e executável empacotado conferidos. Testes com banco isolado cobrem a gravação na mesma revisão, a emissão sem revisão nova, a revisão a partir de uma emitida e a gravação concorrente (`teste:negocio`, `teste`), além de catálogo, permissões e o fluxo pelas telas (`teste:ux`).
