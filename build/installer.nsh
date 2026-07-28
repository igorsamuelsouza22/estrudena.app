; Instalador do Sistema Estrudena.
;
; Uma página a mais pergunta se esta máquina é o servidor (a que guarda o banco)
; ou um terminal. No servidor, o PostgreSQL embutido é instalado e configurado
; sozinho; nos terminais nada precisa ser informado — o app acha o servidor.
;
; O electron-builder compila este arquivo duas vezes: uma para o instalador e
; outra para o desinstalador (com BUILD_UNINSTALLER definido). O que é só do
; instalador precisa ficar dentro do !ifndef, senão o NSIS acusa função não
; referenciada e aborta.

!include nsDialogs.nsh
!include LogicLib.nsh
!include WinMessages.nsh
!include x64.nsh

!macro preInit
  SetRegView 64
!macroend

!ifndef BUILD_UNINSTALLER

  Var Dialogo
  Var RadioServidor
  Var RadioCliente
  Var EhServidor

  !macro customPageAfterChangeDir
    Page custom EstrudenaPapelPagina EstrudenaPapelSai
  !macroend

  Function EstrudenaPapelPagina
    ; Atualização não pergunta nada: o papel da máquina já está definido desde a
    ; primeira instalação. A presença do cluster de dados é o que diz se este PC
    ; é o servidor — não é preciso guardar a escolha em lugar nenhum.
    IfFileExists "$INSTDIR\${APP_FILENAME}.exe" 0 estrudenaPerguntar
      IfFileExists "C:\ProgramData\Estrudena\pgdata\PG_VERSION" 0 +3
        StrCpy $EhServidor "1"
        Goto +2
      StrCpy $EhServidor "0"
      Abort  ; pula a página e segue a instalação

    estrudenaPerguntar:
    ; O cabeçalho é desenhado aqui mesmo: no ponto em que o electron-builder
    ; inclui este arquivo, as macros do MUI2 ainda não foram definidas.
    nsDialogs::Create 1018
    Pop $Dialogo
    ${If} $Dialogo == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 12u "Função desta máquina"
    Pop $0
    CreateFont $1 "$(^Font)" "$(^FontSize)" 700
    SendMessage $0 ${WM_SETFONT} $1 0

    ${NSD_CreateLabel} 0 14u 100% 26u \
      "O Sistema Estrudena guarda tudo em um único computador da rede. Instale como \
Servidor nessa máquina e como Terminal em todas as outras."
    Pop $0

    ${NSD_CreateRadioButton} 0 46u 100% 12u "Servidor — este PC guarda o banco de dados"
    Pop $RadioServidor
    ${NSD_CreateLabel} 14u 59u 100% 20u \
      "Instala e configura o PostgreSQL, cria o banco, os usuários iniciais e libera \
o acesso pela rede. Use em apenas um computador."
    Pop $0

    ${NSD_CreateRadioButton} 0 84u 100% 12u "Terminal — este PC usa o sistema pela rede"
    Pop $RadioCliente
    ${NSD_CreateLabel} 14u 97u 100% 20u \
      "Instala apenas o programa. Ao abrir, ele encontra o servidor sozinho na rede \
local — não há nada para configurar."
    Pop $0

    ; Terminal é o caso comum: só um PC da empresa é servidor.
    ${If} $EhServidor == "1"
      ${NSD_SetState} $RadioServidor ${BST_CHECKED}
    ${Else}
      ${NSD_SetState} $RadioCliente ${BST_CHECKED}
    ${EndIf}

    nsDialogs::Show
  FunctionEnd

  Function EstrudenaPapelSai
    ${NSD_GetState} $RadioServidor $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $EhServidor "1"
    ${Else}
      StrCpy $EhServidor "0"
    ${EndIf}
  FunctionEnd

  !macro customInstall
    ${If} $EhServidor == "1"
      SetDetailsPrint both
      DetailPrint "Instalando o banco de dados PostgreSQL — isso leva cerca de um minuto…"

      ; O instalador é 32-bit: sem desligar o redirecionamento, $SYSDIR aponta
      ; para SysWOW64 e chamaríamos o PowerShell 32-bit, onde Get-LocalUser,
      ; New-LocalUser e New-NetFirewallRule não existem.
      ${If} ${RunningX64}
        ${DisableX64FSRedirection}
      ${EndIf}

      nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\setup-servidor.ps1" -PgRoot "$INSTDIR\resources\pgsql"'
      Pop $0

      ${If} ${RunningX64}
        ${EnableX64FSRedirection}
      ${EndIf}

      ${If} $0 != 0
        MessageBox MB_ICONEXCLAMATION|MB_OK \
          "O programa foi instalado, mas a configuração do banco de dados falhou (código $0).$\r$\n$\r$\nO relatório está em C:\ProgramData\Estrudena\instalacao.log.$\r$\n\
Envie esse arquivo ao suporte, ou instale este computador como Terminal e aponte outro PC como servidor."
      ${Else}
        DetailPrint "Banco de dados instalado e no ar."
      ${EndIf}
    ${Else}
      DetailPrint "Instalação de terminal — o servidor será localizado na rede ao abrir o sistema."
    ${EndIf}
  !macroend

!else

  !macro customUnInstall
    ; Só mexe no banco se este PC for o servidor.
    IfFileExists "C:\ProgramData\Estrudena\pgdata\PG_VERSION" 0 estrudenaSemBanco

      MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 \
        "Este computador é o servidor do Sistema Estrudena.$\r$\n$\r$\nDeseja APAGAR TAMBÉM o banco de dados, com todas as propostas e cadastros?$\r$\n$\r$\n\
Escolha Não para manter os dados — assim é possível reinstalar depois sem perder nada." \
        IDYES estrudenaApagarTudo IDNO estrudenaManterDados

      estrudenaApagarTudo:
        DetailPrint "Removendo o serviço e o banco de dados…"
        nsExec::ExecToLog 'net stop EstrudenaDB'
        nsExec::ExecToLog '"$INSTDIR\resources\pgsql\bin\pg_ctl.exe" unregister -N EstrudenaDB'
        RMDir /r "C:\ProgramData\Estrudena\pgdata"
        ; Precisa do PowerShell 64-bit — os cmdlets de firewall e de conta local
        ; não existem na versão 32-bit que o $SYSDIR redirecionado entregaria.
        ${If} ${RunningX64}
          ${DisableX64FSRedirection}
        ${EndIf}
        nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "Remove-NetFirewallRule -DisplayName \"Sistema Estrudena - PostgreSQL\" -ErrorAction SilentlyContinue; Remove-LocalUser -Name estrudena_pg -ErrorAction SilentlyContinue"'
        ${If} ${RunningX64}
          ${EnableX64FSRedirection}
        ${EndIf}
        Goto estrudenaSemBanco

      estrudenaManterDados:
        DetailPrint "Banco de dados preservado em C:\ProgramData\Estrudena\pgdata."
        nsExec::ExecToLog 'net stop EstrudenaDB'
        nsExec::ExecToLog '"$INSTDIR\resources\pgsql\bin\pg_ctl.exe" unregister -N EstrudenaDB'

    estrudenaSemBanco:
  !macroend

!endif
