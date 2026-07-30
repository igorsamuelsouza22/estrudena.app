<#
    Confere — e corrige — o PC servidor do Sistema Estrudena.

    Roteiro de suporte para quando um terminal não acha o banco. Diz em
    português o que está certo e o que está errado, e conserta sozinho o que dá
    para consertar (regra de firewall, serviço parado).

    Não toca em dados: só lê configuração, sobe o serviço se estiver parado e
    reescreve a regra de firewall.

    Precisa de PowerShell como administrador.
#>
[CmdletBinding()]
param(
  [int]    $Porta = 5432,
  [string] $Servico = 'EstrudenaDB',
  [string] $Regra = 'Sistema Estrudena - PostgreSQL',
  # Só diagnostica, não corrige nada.
  [switch] $SomenteConferir
)

$ErrorActionPreference = 'Continue'
$problemas = @()
$consertos = @()

function Titulo([string] $t) { Write-Host ''; Write-Host "== $t" -ForegroundColor Cyan }
function Bom([string] $t)    { Write-Host "   OK    $t" -ForegroundColor Green }
function Ruim([string] $t)   { Write-Host "   FALHA $t" -ForegroundColor Red; $script:problemas += $t }
function Nota([string] $t)   { Write-Host "         $t" -ForegroundColor DarkGray }

$admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

Write-Host ''
Write-Host "Sistema Estrudena - conferencia do servidor" -ForegroundColor White
Write-Host "Maquina: $env:COMPUTERNAME"
if (-not $admin) {
  Write-Host 'ATENCAO: sem privilegio de administrador. Da para diagnosticar,' -ForegroundColor Yellow
  Write-Host 'mas nao para corrigir o firewall nem mexer no servico.' -ForegroundColor Yellow
}

# --------------------------------------------------------------------- serviço
Titulo 'Servico do banco'
$svc = Get-Service -Name $Servico -ErrorAction SilentlyContinue
if (-not $svc) {
  Ruim "O servico '$Servico' nao existe nesta maquina."
  Nota 'Este PC provavelmente foi instalado como Terminal, e nao como Servidor.'
  Nota 'Reinstale aqui escolhendo Servidor na tela do instalador.'
} elseif ($svc.Status -ne 'Running') {
  Ruim "O servico '$Servico' existe, mas esta $($svc.Status)."
  if ($admin -and -not $SomenteConferir) {
    Start-Service $Servico -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    $svc.Refresh()
    if ($svc.Status -eq 'Running') { $consertos += 'servico iniciado'; Bom 'Iniciei o servico agora.' }
    else { Nota 'Nao consegui iniciar. Veja C:\ProgramData\Estrudena\instalacao.log.' }
  }
} else {
  Bom "Servico '$Servico' em execucao (inicializacao: $($svc.StartType))."
}

# ------------------------------------------------------------------- escutando
Titulo 'Endereco de escuta'
$escutas = @(netstat -ano | Select-String 'LISTENING' | Select-String ":$Porta\b")
if ($escutas.Count -eq 0) {
  Ruim "Ninguem esta escutando na porta $Porta."
} else {
  $externo = $false
  # O mesmo programa aparece uma vez por endereço (IPv4 e IPv6); avisar de cada
  # linha repetiria a mesma pendência duas ou três vezes no resumo.
  $intrusos = @()
  foreach ($l in $escutas) {
    $campos = ($l.ToString().Trim() -split '\s+')
    $end = $campos[1]; $pid_ = $campos[-1]
    $nome = (Get-Process -Id $pid_ -ErrorAction SilentlyContinue).ProcessName
    Nota "$end  PID $pid_  $nome"
    if ($end -like '0.0.0.0:*' -or $end -like '[[]::]:*') { $externo = $true }
    if ($nome -and $nome -notmatch 'postgres' -and $intrusos -notcontains $nome) { $intrusos += $nome }
  }
  foreach ($nome in $intrusos) {
    Ruim "Outro programa ($nome) tambem esta na porta $Porta."
    Nota 'Dois programas na mesma porta: nao da para garantir qual atende a rede.'
  }
  if ($externo) { Bom "O banco aceita conexao de qualquer endereco (0.0.0.0:$Porta)." }
  else { Ruim "O banco so escuta no proprio PC (loopback), nao na rede." }
}

# ------------------------------------------------------------- perfil das redes
Titulo 'Perfil das redes'
$perfis = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue)
$temPublica = $false
foreach ($p in $perfis) {
  Nota "$($p.InterfaceAlias): $($p.NetworkCategory)"
  if ($p.NetworkCategory -eq 'Public') { $temPublica = $true }
}
if ($temPublica) {
  Nota 'Ha rede classificada como Publica. Ate a versao 1.2.2 a regra de'
  Nota 'firewall nao valia para esse perfil, e era esse o motivo de terminal'
  Nota 'nenhum achar o banco. A correcao abaixo resolve sem mexer no perfil.'
}

# -------------------------------------------------------------------- firewall
Titulo 'Firewall'
$fw = Get-NetFirewallRule -DisplayName $Regra -ErrorAction SilentlyContinue
if ($fw) { Nota "Regra atual: habilitada=$($fw.Enabled) perfis=$($fw.Profile)" }
else { Nota 'Regra ainda nao existe.' }

$precisaCorrigir = (-not $fw) -or ($fw.Enabled -ne 'True') -or ("$($fw.Profile)" -notmatch 'Any')
if (-not $precisaCorrigir) {
  Bom 'Regra ja vale para todos os perfis de rede.'
} elseif ($SomenteConferir) {
  Ruim 'A regra nao cobre todos os perfis de rede.'
} elseif (-not $admin) {
  Ruim 'A regra precisa ser refeita, mas isso exige administrador.'
} else {
  try {
    if ($fw) { Remove-NetFirewallRule -DisplayName $Regra -ErrorAction SilentlyContinue }
    # Todos os perfis, mas so para quem esta na mesma rede fisica: o que
    # mantem a porta fechada para a internet e o escopo, nao o perfil. O
    # pg_hba.conf tambem so atende faixas privadas e exige senha.
    New-NetFirewallRule -DisplayName $Regra -Direction Inbound -Action Allow `
      -Protocol TCP -LocalPort $Porta -Profile Any -RemoteAddress LocalSubnet `
      -Description 'Permite que as outras maquinas da mesma rede acessem o banco do Sistema Estrudena.' | Out-Null
    $consertos += 'regra de firewall refeita'
    Bom "Regra refeita: porta $Porta liberada para a rede local, em todos os perfis."
  } catch {
    Ruim "Nao consegui refazer a regra: $($_.Exception.Message)"
  }
}

# ------------------------------------------------------------------- endereços
Titulo 'Enderecos deste servidor'
$ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' })
foreach ($ip in $ips) { Nota "$($ip.IPAddress)  ($($ip.InterfaceAlias))" }
Nota 'Nos terminais, o IP tem que comecar com os mesmos tres numeros de um destes.'

# --------------------------------------------------------------------- resumo
Write-Host ''
if ($consertos.Count) {
  Write-Host ("Corrigido: " + ($consertos -join ', ') + '.') -ForegroundColor Green
}
if ($problemas.Count -eq 0) {
  Write-Host 'Servidor conferido: esta tudo certo para os terminais entrarem.' -ForegroundColor Green
  Write-Host 'Se ainda assim um terminal nao achar, confira o IP dele: precisa'
  Write-Host 'estar na mesma faixa que os enderecos listados acima.'
  exit 0
}
Write-Host 'Pendencias:' -ForegroundColor Yellow
foreach ($p in $problemas) { Write-Host "  - $p" -ForegroundColor Yellow }
exit 1
