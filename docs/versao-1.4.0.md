Sistema Estrudena 1.4.0: telas mais simples e menos situações para acompanhar.

### O que mudou nas telas

- **Uma ação principal por vez.** Proposta e pedido mostram a próxima ação esperada em destaque; as demais ficam em **Mais ações**.
- **Orçamentos** em 4 abas: Em aberto, Aprovados, Perdidos e Todos. **Abrir** leva direto ao orçamento.
- **Gerar proposta** grava a revisão e abre a prévia do PDF. O envio é registrado no cabeçalho, escolhendo o canal (WhatsApp, E-mail, Em mãos ou Outro).
- **Pedido** com uma situação só, etapas Liberação · Separação · Fabricação · Entrega (· Instalação, quando contratada) e histórico recolhido.
- **Separação dentro do pedido**, como lista de marcação: marque cada produto, matéria-prima e ferragem, ou digite a quantidade parcial. A primeira gravação já inicia a separação.
- **Início** sem repetições: rascunhos em "Continuar…" e pedidos em andamento com a situação real.
- Conexão e espaçamento foram para o botão ao lado do nome do usuário. A conexão só aparece no menu quando o servidor não responde. Subtítulos e avisos fixos saíram das páginas.

### O que mudou no fluxo

- **Proposta:** Rascunho → Emitida → Enviada → Aprovada ou Perdida. "Em negociação" foi unificada com "Enviada". Proposta vencida aparece como **Expirada** sozinha.
- **Concluir a separação** já leva o pedido à fabricação. Uma separação concluída não pode ser reaberta pela tela.
- **Fabricação concluída e conferida** é uma ação só, com a conferência final de qualidade.
- **Entrega:** Agendada → Entregue (ou Ocorrência). Pode ser registrada direto como entregue.
- **Instalação:** A agendar → Agendada → Concluída. Pendências ficam como observação no histórico.
- **O pedido se conclui sozinho** com a última entrega e a instalação contratada concluída.

As garantias continuam no servidor: aceite sem pedido duplicado, revisão emitida e entrega confirmada sem alteração, Produção sem valores comerciais e histórico completo.

### Como atualizar

1. Faça um backup do banco no servidor e salve os trabalhos abertos.
2. Atualize **o servidor e todos os terminais** para a 1.4.0, pelo **Atualizar e reiniciar** ou com `Sistema-Estrudena-Setup-1.4.0.exe`.
3. Abra o servidor primeiro para aplicar a migração automática.

Esta versão atualiza o banco para o **schema v8**. As regras rodam em cada computador, então um terminal ainda na 1.3.1 gravaria as situações antigas: não deixe terminais desatualizados em uso. A migração converte os registros existentes ("Em análise" → "Enviada", "Em conferência" e separação já concluída → "Em fabricação", "Em transporte" → "Agendada", instalação "Em execução"/"Pendência" → "Agendada") e preserva o histórico de eventos.

### Verificação

Compilação e typecheck conferidos. Testes com banco isolado cobrem as novas transições, a conclusão automática, a expiração calculada e a migração v8 (`teste:negocio`), além de catálogo e permissões. O teste de interface percorre orçamento, emissão, envio, aceite, liberação, separação, fabricação, entrega e conclusão pelas telas, inclusive o perfil Produção sem valores.
