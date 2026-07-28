# Gera build/icon.ico a partir do logotipo oficial.
# O ICO carrega um PNG 256x256 embutido — formato aceito desde o Windows Vista
# e o que o electron-builder espera.
[CmdletBinding()]
param(
  [string] $Origem = '..\assets\logo-estrudena.png',
  [string] $Destino = 'build\icon.ico'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$origemAbs = Resolve-Path $Origem
$original = [System.Drawing.Image]::FromFile($origemAbs)

# Quadrado de 256, com o logo centralizado e fundo transparente.
$lado = 256
$bmp = New-Object System.Drawing.Bitmap($lado, $lado, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Transparent)

$escala = [Math]::Min($lado / $original.Width, $lado / $original.Height)
$larg = [int]($original.Width * $escala)
$alt = [int]($original.Height * $escala)
$g.DrawImage($original, [int](($lado - $larg) / 2), [int](($lado - $alt) / 2), $larg, $alt)
$g.Dispose()

$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $ms.ToArray()
$ms.Dispose(); $bmp.Dispose(); $original.Dispose()

New-Item -ItemType Directory -Force (Split-Path $Destino) | Out-Null
$fs = [System.IO.File]::Create($Destino)
$bw = New-Object System.IO.BinaryWriter($fs)

$bw.Write([uint16]0)      # reservado
$bw.Write([uint16]1)      # tipo: ícone
$bw.Write([uint16]1)      # quantidade de imagens
$bw.Write([byte]0)        # largura 0 = 256
$bw.Write([byte]0)        # altura  0 = 256
$bw.Write([byte]0)        # paleta
$bw.Write([byte]0)        # reservado
$bw.Write([uint16]1)      # planos
$bw.Write([uint16]32)     # bits por pixel
$bw.Write([uint32]$png.Length)
$bw.Write([uint32]22)     # offset dos dados
$bw.Write($png)

$bw.Flush(); $bw.Dispose(); $fs.Dispose()
Write-Host "Ícone gravado em $Destino ($($png.Length) bytes de PNG)"
