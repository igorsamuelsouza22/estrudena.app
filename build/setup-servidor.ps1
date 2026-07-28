<#
    Instala e configura o PostgreSQL do Sistema Estrudena no PC servidor.

    Chamado pelo instalador NSIS com privilégio de administrador. O usuário não
    digita nem executa nada: este roteiro faz tudo e se recupera sozinho dos
    tropeços mais prováveis (locale indisponível, conta de serviço recusada).

    É idempotente: rodar de novo sobre uma instalação existente preserva os
    dados e apenas reconfere cluster, serviço, rede e firewall.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string] $PgRoot,
  [string] $DataDir = 'C:\ProgramData\Estrudena\pgdata',
  [string] $Servico = 'EstrudenaDB',
  [int]    $Porta = 5432,
  [string] $AppUser = 'estrudena',
  [string] $AppPassword = 'Estrud3na!Db',
  [string] $AppDb = 'estrudena',
  # Configura só o cluster e o banco, sem serviço nem firewall.
  # Usado para diagnóstico e para reprocessar a parte de dados sem elevação.
  [switch] $SomenteBanco,
  [string] $Log = 'C:\ProgramData\Estrudena\instalacao.log'
)

$ErrorActionPreference = 'Stop'
$log = $Log
try {
  New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
} catch {
  Write-Host "AVISO: nao consegui preparar a pasta do log ($($_.Exception.Message))."
}

# Falha de escrita no log jamais pode derrubar a instalação — o console
# continua recebendo tudo, e o instalador registra a saída do processo.
function Escrever([string] $msg) {
  $linha = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
  Write-Host $linha
  try { Add-Content -Path $log -Value $linha -Encoding utf8 -ErrorAction Stop } catch { }
}

# Qualquer erro que aborte o roteiro precisa aparecer no log — sem isso o
# instalador só mostra "codigo 1" e o log termina no meio, sem dizer onde parou.
trap {
  Escrever "ERRO: $($_.Exception.Message)"
  Escrever "  onde: $($_.InvocationInfo.PositionMessage -replace "`r?`n", ' ')"
  Escrever "  tipo: $($_.Exception.GetType().FullName)"
  exit 1
}

# --------------------------------------------------------------------- 64 bits
# O instalador NSIS é 32-bit e o $SYSDIR dele cai em SysWOW64. Vários cmdlets de
# administração do Windows só existem na edição 64-bit do PowerShell, então se
# chegamos aqui em 32-bit reexecutamos com o interpretador nativo (SysNative é o
# atalho que apenas o processo 32-bit enxerga).
if (-not [Environment]::Is64BitProcess -and [Environment]::Is64BitOperatingSystem) {
  $nativo = Join-Path $env:WINDIR 'SysNative\WindowsPowerShell\v1.0\powershell.exe'
  if (Test-Path $nativo) {
    Escrever 'Reexecutando em PowerShell 64-bit.'
    $reArgs = @(
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', $PSCommandPath,
      '-PgRoot', $PgRoot, '-DataDir', $DataDir, '-Servico', $Servico,
      '-Porta', $Porta, '-AppUser', $AppUser, '-AppPassword', $AppPassword, '-AppDb', $AppDb,
      '-Log', $log
    )
    if ($SomenteBanco) { $reArgs += '-SomenteBanco' }
    & $nativo @reArgs
    exit $LASTEXITCODE
  }
  Escrever 'AVISO: processo 32-bit sem SysNative — seguindo assim mesmo.'
}

<#
    Executa um programa e trata a saída.

    O PowerShell 5.1 transforma cada linha de stderr de um executável em
    ErrorRecord; com $ErrorActionPreference = 'Stop' isso derruba o roteiro
    mesmo quando o comando terminou com sucesso. Por isso a preferência é
    relaxada só aqui dentro, e o veredito vem do código de saída.
#>
function Invocar([string] $exe, [string[]] $argumentos, [string] $etapa) {
  $antes = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $saida = (& $exe @argumentos 2>&1 | Out-String)
    $codigo = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $antes
  }
  if ($codigo -ne 0) {
    Escrever "FALHOU [$etapa] $exe $($argumentos -join ' ')"
    foreach ($l in ($saida -split "`r?`n")) { if ($l.Trim()) { Escrever "    $l" } }
    throw "$etapa falhou (codigo $codigo)."
  }
  return $saida
}

<#
    Grava um arquivo de configuração do PostgreSQL.

    Obrigatoriamente UTF-8 SEM BOM: o `Set-Content -Encoding utf8` do
    PowerShell 5.1 escreve BOM, e o parser do postgresql.conf trata esses bytes
    como lixo na linha 1 — o servidor nem sobe ("erro de sintaxe ... linha 1").
#>
function GravarConf([string] $caminho, [string] $texto) {
  [System.IO.File]::WriteAllText($caminho, $texto, (New-Object System.Text.UTF8Encoding($false)))
}

<#
    Lê um arquivo de configuração do PostgreSQL.

    Sempre UTF-8 explícito. O `Get-Content -Raw` do PowerShell 5.1, diante de um
    arquivo sem BOM, assume a codepage ANSI — e o initdb escreve comentários
    acentuados em português. Ler em ANSI e regravar em UTF-8 corrompe o arquivo
    um pouco mais a cada execução.
#>
function LerConf([string] $caminho) {
  return [System.IO.File]::ReadAllText($caminho, (New-Object System.Text.UTF8Encoding($false)))
}

# Tenta executar e devolve $true/$false, sem abortar. Para os caminhos que têm
# plano B.
function Tentar([string] $exe, [string[]] $argumentos, [string] $etapa) {
  try {
    Invocar $exe $argumentos $etapa | Out-Null
    return $true
  } catch {
    Escrever "  (tentativa falhou: $etapa)"
    return $false
  }
}

# Nome localizado de uma conta interna. Em Windows pt-BR "NETWORK SERVICE" se
# chama "SERVIÇO DE REDE", então o SID é o único identificador confiável.
function ContaDoSid([string] $sid) {
  try {
    return (New-Object System.Security.Principal.SecurityIdentifier($sid)
      ).Translate([System.Security.Principal.NTAccount]).Value
  } catch {
    return $null
  }
}

Escrever '=== Instalacao do banco Estrudena ==='
Escrever "PgRoot=$PgRoot  DataDir=$DataDir  Porta=$Porta  SomenteBanco=$SomenteBanco"
Escrever "PowerShell $($PSVersionTable.PSVersion) 64-bit=$([Environment]::Is64BitProcess)"

$bin = Join-Path $PgRoot 'bin'
foreach ($exe in @('initdb.exe', 'pg_ctl.exe', 'psql.exe', 'postgres.exe', 'pg_isready.exe')) {
  if (-not (Test-Path (Join-Path $bin $exe))) {
    throw "Binario ausente: $(Join-Path $bin $exe). O instalador foi gerado sem o PostgreSQL embutido?"
  }
}
$initdb = Join-Path $bin 'initdb.exe'
$pgctl = Join-Path $bin 'pg_ctl.exe'
$psql = Join-Path $bin 'psql.exe'
$isready = Join-Path $bin 'pg_isready.exe'

# --------------------------------------------------------------- porta em uso
<#
    Se outro PostgreSQL já ocupa a porta, tudo o que vier depois conversaria com
    o servidor errado — o nosso nem chega a subir, e o erro apareceria lá na
    frente, na criação da role, sem explicação. Melhor barrar aqui.
#>
$svcExistente = Get-Service -Name $Servico -ErrorAction SilentlyContinue
& (Join-Path $bin 'pg_isready.exe') -h 127.0.0.1 -p $Porta -q 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0 -and (-not $svcExistente -or $svcExistente.Status -ne 'Running')) {
  Escrever "ERRO: ja ha um PostgreSQL escutando na porta $Porta, e nao e o do Sistema Estrudena."
  throw ("A porta $Porta ja esta ocupada por outro PostgreSQL nesta maquina. " +
         'Pare ou desinstale esse servidor e rode a instalacao de novo, ' +
         'ou instale o Sistema Estrudena como Terminal e use outro PC como servidor.')
}

# ---------------------------------------------------------------------- cluster
$novoCluster = -not (Test-Path (Join-Path $DataDir 'PG_VERSION'))

if ($novoCluster) {
  # Sobra de uma tentativa anterior interrompida impediria o initdb.
  if (Test-Path $DataDir) {
    $conteudo = @(Get-ChildItem $DataDir -Force -ErrorAction SilentlyContinue)
    if ($conteudo.Count) {
      Escrever "Limpando resto de instalacao anterior em $DataDir."
      Remove-Item "$DataDir\*" -Recurse -Force
    }
  }
  New-Item -ItemType Directory -Force $DataDir | Out-Null

  Escrever 'Criando o cluster de dados...'
  # O initdb do Windows rebaixa o próprio token quando roda como administrador,
  # então não é preciso criar conta nenhuma para esta etapa.
  $baseInit = @('-D', $DataDir, '-U', 'postgres', '--encoding=UTF8',
                '--auth-local=trust', '--auth-host=scram-sha-256')

  $locales = @('Portuguese_Brazil.1252', 'pt-BR', '', 'C')
  $feito = $false
  foreach ($loc in $locales) {
    # Não usar $args aqui: é variável automática do PowerShell.
    $argsInit = if ($loc) { $baseInit + @("--locale=$loc") } else { $baseInit }
    $rotulo = if ($loc) { "initdb (locale $loc)" } else { 'initdb (locale do sistema)' }
    if (Tentar $initdb $argsInit $rotulo) {
      Escrever "Cluster criado com $rotulo."
      $feito = $true
      break
    }
    # initdb deixa o diretório sujo quando falha no meio.
    if (Test-Path "$DataDir\*") { Remove-Item "$DataDir\*" -Recurse -Force }
  }
  if (-not $feito) { throw 'Nao consegui criar o cluster com nenhum locale.' }
} else {
  Escrever 'Cluster ja existe — dados preservados.'
}

# ------------------------------------------------------------------------- ACL
# A conta do serviço precisa enxergar a pasta de dados. Identificação por SID
# para funcionar em qualquer idioma do Windows.
$contaRede = ContaDoSid 'S-1-5-20'   # NETWORK SERVICE
$contaSys = ContaDoSid 'S-1-5-18'    # SYSTEM
$contaAdm = ContaDoSid 'S-1-5-32-544' # Administradores

if (-not $SomenteBanco) {
  try {
    $acl = Get-Acl $DataDir
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($quem in @($contaRede, $contaSys, $contaAdm)) {
      if (-not $quem) { continue }
      $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
        $quem, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    }
    Set-Acl -Path $DataDir -AclObject $acl
    Escrever "Permissoes da pasta de dados ajustadas ($contaRede, $contaSys, $contaAdm)."
  } catch {
    Escrever "AVISO: nao consegui ajustar as permissoes ($($_.Exception.Message)). Seguindo."
  }
}

# ------------------------------------------------------------------------ rede
$confPath = Join-Path $DataDir 'postgresql.conf'
$conf = LerConf $confPath
$conf = $conf -replace "(?m)^\s*#?\s*listen_addresses\s*=.*$", "listen_addresses = '*'"
$conf = $conf -replace "(?m)^\s*#?\s*port\s*=.*$", "port = $Porta"
if ($conf -notmatch 'listen_addresses') { $conf += "`nlisten_addresses = '*'`nport = $Porta`n" }
GravarConf $confPath $conf
Escrever "postgresql.conf: escutando em todas as interfaces, porta $Porta."

<#
    Reescreve o pg_hba.conf.

    As regras entram NO TOPO do arquivo porque o PostgreSQL usa a primeira que
    casar — se ficassem no fim, a linha padrão do initdb para 127.0.0.1 venceria.

    Durante a instalação o loopback fica em `trust`, o que permite criar a role
    e o banco sem guardar a senha do superusuário em lugar nenhum. No fim o
    modo passa a `scram-sha-256`.
#>
function EscreverHba([string] $modoLocal) {
  $hbaPath = Join-Path $DataDir 'pg_hba.conf'
  # Marcadores só com ASCII: qualquer acento aqui vira alvo de problema de
  # codificação e o bloco antigo deixaria de ser reconhecido, acumulando copias.
  $marca = '# --- Sistema Estrudena (bloco gerado - nao editar) ---'
  $fim = '# --- fim Sistema Estrudena ---'

  $original = LerConf $hbaPath
  $original = [regex]::Replace($original,
    "(?s)$([regex]::Escape($marca)).*?$([regex]::Escape($fim))\r?\n?", '')

  # Só redes privadas. A internet nunca alcança este banco.
  $bloco = @"
$marca
host    all    all    127.0.0.1/32       $modoLocal
host    all    all    ::1/128            $modoLocal
host    all    all    10.0.0.0/8         scram-sha-256
host    all    all    172.16.0.0/12      scram-sha-256
host    all    all    192.168.0.0/16     scram-sha-256
$fim

"@
  GravarConf $hbaPath ($bloco + $original)
  Escrever "pg_hba.conf: loopback em '$modoLocal', redes privadas em scram-sha-256."
}

EscreverHba 'trust'

# --------------------------------------------------------------------- serviço
function EsperarBanco([int] $segundos = 45) {
  for ($i = 0; $i -lt $segundos; $i++) {
    & $isready -h 127.0.0.1 -p $Porta -q 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

if ($SomenteBanco) {
  # Sem serviço: sobe o postgres só para esta sessão.
  #
  # Nem `Invocar` nem `Start-Process -Wait` servem aqui. O primeiro captura a
  # saída num pipe que o postgres herda e nunca fecha; o segundo espera a
  # árvore inteira de processos, e o servidor justamente fica rodando. Então
  # dispara e confere pela prontidão, que é o que de fato interessa.
  Escrever 'Modo SomenteBanco — iniciando o servidor temporariamente.'
  $logTemp = Join-Path (Split-Path $log) 'pg-temp.log'
  Start-Process -FilePath $pgctl -WindowStyle Hidden -ArgumentList @(
    '-D', "`"$DataDir`"", '-o', "`"-p $Porta`"", '-l', "`"$logTemp`"", 'start') | Out-Null

  if (-not (EsperarBanco)) {
    if (Test-Path $logTemp) { Get-Content $logTemp -Tail 20 | ForEach-Object { Escrever "    $_" } }
    throw 'O servidor temporario nao respondeu.'
  }
} else {
  $svc = Get-Service -Name $Servico -ErrorAction SilentlyContinue

  if (-not $svc) {
    # NETWORK SERVICE já tem o direito "Efetuar logon como serviço" e não exige
    # senha — evita criar conta local e conceder direitos à mão. Se o registro
    # ou a partida falharem, o plano B é LocalSystem (padrão do pg_ctl).
    $registrou = $false
    if ($contaRede) {
      Escrever "Registrando o servico $Servico como $contaRede..."
      $registrou = Tentar $pgctl @('register', '-N', $Servico, '-D', $DataDir, '-S', 'auto',
                                   '-U', $contaRede, '-o', "-p $Porta") 'registro do servico'
    }
    if (-not $registrou) {
      Escrever "Registrando o servico $Servico com a conta padrao do sistema..."
      Invocar $pgctl @('register', '-N', $Servico, '-D', $DataDir, '-S', 'auto',
                       '-o', "-p $Porta") 'registro do servico (padrao)' | Out-Null
    }
    Escrever 'Servico registrado.'
  } else {
    Escrever "Servico $Servico ja registrado."
  }

  Set-Service -Name $Servico -StartupType Automatic

  Escrever 'Iniciando o servico...'
  $subiu = $false
  try {
    Restart-Service -Name $Servico -Force
    $subiu = EsperarBanco
  } catch {
    Escrever "  partida falhou: $($_.Exception.Message)"
  }

  if (-not $subiu) {
    # Falha típica quando a conta de serviço não pode fazer logon: refaz o
    # registro com a conta padrão do sistema e tenta de novo.
    Escrever 'Servico nao respondeu — refazendo o registro com a conta padrao do sistema.'
    Tentar $pgctl @('unregister', '-N', $Servico) 'remocao do servico' | Out-Null
    Start-Sleep -Seconds 2
    Invocar $pgctl @('register', '-N', $Servico, '-D', $DataDir, '-S', 'auto',
                     '-o', "-p $Porta") 'registro do servico (plano B)' | Out-Null
    Set-Service -Name $Servico -StartupType Automatic
    Start-Service -Name $Servico
    $subiu = EsperarBanco
  }

  if (-not $subiu) {
    $ultimas = Get-ChildItem (Join-Path $DataDir 'log') -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime | Select-Object -Last 1
    if ($ultimas) {
      Escrever 'Ultimas linhas do log do PostgreSQL:'
      Get-Content $ultimas.FullName -Tail 20 | ForEach-Object { Escrever "    $_" }
    }
    throw "O servico $Servico nao respondeu na porta $Porta."
  }
}

Escrever 'Banco no ar.'

# --------------------------------------------------------------- role e banco
$comuns = @('-h', '127.0.0.1', '-p', "$Porta", '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1')

$temRole = (Invocar $psql ($comuns + @('-tAc', "SELECT 1 FROM pg_roles WHERE rolname = '$AppUser'")) 'consulta da role')
if ($temRole -match '\b1\b') {
  Invocar $psql ($comuns + @('-c', "ALTER ROLE $AppUser WITH LOGIN PASSWORD '$AppPassword'")) 'atualizacao da role' | Out-Null
  Escrever "Role $AppUser atualizada."
} else {
  Invocar $psql ($comuns + @('-c', "CREATE ROLE $AppUser LOGIN PASSWORD '$AppPassword'")) 'criacao da role' | Out-Null
  Escrever "Role $AppUser criada."
}

$temDb = (Invocar $psql ($comuns + @('-tAc', "SELECT 1 FROM pg_database WHERE datname = '$AppDb'")) 'consulta do banco')
if ($temDb -match '\b1\b') {
  Escrever "Banco $AppDb ja existe."
} else {
  Invocar $psql ($comuns + @('-c', "CREATE DATABASE $AppDb OWNER $AppUser ENCODING 'UTF8'")) 'criacao do banco' | Out-Null
  Escrever "Banco $AppDb criado."
}

# O schema e os dados iniciais são criados pelo próprio aplicativo na primeira
# conexão (migrations), então nada mais precisa ser feito aqui.

# --------------------------------------------------- fecha o loopback e recarrega
EscreverHba 'scram-sha-256'
Invocar $pgctl @('-D', $DataDir, 'reload') 'recarga da configuracao' | Out-Null

# -------------------------------------------------------------------- firewall
if (-not $SomenteBanco) {
  try {
    $regra = 'Sistema Estrudena - PostgreSQL'
    Get-NetFirewallRule -DisplayName $regra -ErrorAction SilentlyContinue |
      Remove-NetFirewallRule -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName $regra -Direction Inbound -Action Allow `
      -Protocol TCP -LocalPort $Porta -Profile Domain,Private `
      -Description 'Permite que as outras maquinas da rede acessem o banco do Sistema Estrudena.' | Out-Null
    Escrever "Firewall liberado na porta $Porta (redes domestica e corporativa)."
  } catch {
    # netsh como plano B: existe em qualquer Windows, inclusive edições sem o
    # módulo NetSecurity.
    Escrever "Cmdlet de firewall indisponivel ($($_.Exception.Message)); usando netsh."
    Tentar 'netsh' @('advfirewall', 'firewall', 'add', 'rule',
                     'name=Sistema Estrudena - PostgreSQL', 'dir=in', 'action=allow',
                     'protocol=TCP', "localport=$Porta", 'profile=domain,private') 'firewall via netsh' | Out-Null
  }
}

# -------------------------------------------------------------------- conferência
# Conecta exatamente como o aplicativo vai conectar. Se isto passa, o terminal
# na rede também vai conseguir.
$env:PGPASSWORD = $AppPassword
try {
  $prova = Invocar $psql @('-h', '127.0.0.1', '-p', "$Porta", '-U', $AppUser, '-d', $AppDb,
                           '-tAc', 'SELECT 1') 'conferencia de acesso do aplicativo'
  if ($prova -notmatch '\b1\b') { throw 'A conferencia de acesso nao retornou o esperado.' }
  Escrever 'Conferencia OK: o aplicativo consegue entrar no banco.'
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

if ($SomenteBanco) {
  Escrever 'Modo SomenteBanco — parando o servidor temporario.'
  Tentar $pgctl @('-D', $DataDir, '-m', 'fast', 'stop') 'parada temporaria' | Out-Null
}

$ips = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -ExpandProperty IPAddress) -join ', '
Escrever "=== Concluido. Este servidor responde em: $ips (porta $Porta) ==="
exit 0
