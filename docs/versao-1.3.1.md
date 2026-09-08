Sistema Estrudena 1.3.1: atualização com o botão Atualizar e reiniciar.

### Atualização simplificada

- As próximas versões serão baixadas em segundo plano. Quando estiverem prontas, clique em **Atualizar e reiniciar**.
- O aplicativo verifica edições e gravações em andamento antes de fechar. Salve ou descarte as alterações indicadas e tente novamente.
- O instalador é aplicado em modo silencioso e solicita a reabertura do aplicativo. O Windows ainda pode pedir autorização de administrador.
- **Mais tarde** permite continuar trabalhando. Fechar o aplicativo não inicia uma instalação. O download fica em cache e é validado novamente na próxima consulta.
- Os canais GitHub e servidor continuam disponíveis. Os arquivos são conferidos antes da instalação.
- Nas próximas atualizações, o instalador preserva o runtime PostgreSQL existente e não refaz a configuração do banco, serviço ou firewall. O pacote completo continua atendendo novas instalações de servidor e terminal.

### Instalação desta versão de transição

A 1.3.1 ainda chega às instalações antigas pelo processo anterior: baixe e execute `Sistema-Estrudena-Setup-1.3.1.exe`, ou use a atualização do aplicativo. Depois dela, as próximas versões usarão **Atualizar e reiniciar**.

Faça backup e salve os trabalhos antes de atualizar. Atualize o servidor e todos os terminais. Os dados e configurações existentes são preservados; esta versão mantém o schema v7.

No servidor, o desinstalador de uma versão antiga pode perguntar se deseja apagar o banco durante essa transição. **Escolha Não.** O novo desinstalador deixa de apresentar essa pergunta durante atualizações.

### Verificação

Compilação e executável empacotado conferidos. Testes com banco isolado cobrem download pelo electron-updater, integridade, retomada após reabrir, bloqueio de alterações pendentes e chamada de instalação silenciosa com reinício. A chamada de instalação foi interceptada nos testes. A preservação dos arquivos PostgreSQL foi exercitada com NSIS em uma pasta temporária, sem modificar serviços ou registro do Windows.
