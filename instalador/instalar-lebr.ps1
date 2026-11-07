# LEBR — Laboratório de Estruturas Brasil
# Copyright (C) 2026 Daniel Michelon De Carli
# SPDX-License-Identifier: GPL-3.0-only
#
# Compila o LEBR neste computador a partir do código-fonte da última release do GitHub.
#
# É chamado pelo instalador (LEBR-Instalador.exe, Inno Setup) e também pode ser rodado à mão:
#   powershell -NoProfile -ExecutionPolicy Bypass -File instalar-lebr.ps1
#
# Etapas (cada uma escreve "@@ETAPA|n|total|texto" para o instalador mostrar o progresso):
#   1. consulta a última release em api.github.com/repos/danielcarli/lebr (só releases publicadas, sem rascunhos
#      nem pré-lançamentos);
#   2. baixa o código-fonte (o anexo lebr-fonte.zip, conferido pelo SHA-256 que o GitHub calcula para cada anexo;
#      sem o anexo, o arquivo .zip da tag);
#   3. baixa o Node.js 22 (LTS) oficial de nodejs.org, conferido pelo SHASUMS256.txt publicado junto;
#   4. instala as dependências com "npm ci" — versões travadas no package-lock.json, cada pacote conferido pelo
#      hash de integridade do lockfile;
#   5. roda os testes automáticos (se algum falhar, nada é instalado);
#   6. monta o programa (electron-builder, pasta win-unpacked com LEBR.exe).
# Só HTTPS (TLS 1.2 ou superior). Nada é instalado se uma etapa falhar; a instalação anterior fica como estava.
# Ao terminar, escreve "@@SAIDA|<pasta com LEBR.exe>" e "@@VERSAO|x.y.z". Em erro, "@@ERRO|mensagem" e código 1.

[CmdletBinding()]
param(
  [string]$Repositorio = 'danielcarli/lebr',
  [string]$NodeMajor = '22',
  [switch]$SemTestes
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # a barra de progresso do PowerShell 5 deixa os downloads muito lentos
try { [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false) } catch { }
# só TLS 1.2 ou 1.3 (o .NET Framework antigo usa TLS 1.0 por padrão)
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13 }
catch { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 }

$Base = Join-Path $env:LOCALAPPDATA 'LEBR-Instalador'
$Trabalho = Join-Path $Base 'compilacao'
$Ferramentas = Join-Path $Base 'ferramentas'
$Cache = Join-Path $Base 'cache'
$Registro = Join-Path $Base 'instalacao.log'
$Total = 6
$Cabecalho = @{ 'User-Agent' = 'LEBR-Instalador'; 'Accept' = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28' }

New-Item -ItemType Directory -Force -Path $Base, $Ferramentas, $Cache | Out-Null
Set-Content -Path $Registro -Value "LEBR — instalação iniciada em $(Get-Date -Format s)" -Encoding UTF8

function Escrever([string]$Texto) {
  Write-Output $Texto
  Add-Content -Path $Registro -Value $Texto -Encoding UTF8
}
function Etapa([int]$N, [string]$Texto) { Escrever "@@ETAPA|$N|$Total|$Texto" }
function Falhar([string]$Texto) { throw $Texto }

function Baixar([string]$Url, [string]$Destino) {
  if (-not $Url.StartsWith('https://')) { Falhar "Endereço sem HTTPS recusado: $Url" }
  Escrever "Baixando $Url"
  $tentativas = 0
  while ($true) {
    try {
      Invoke-WebRequest -Uri $Url -OutFile $Destino -UseBasicParsing -Headers @{ 'User-Agent' = 'LEBR-Instalador' } -MaximumRedirection 10
      return
    } catch {
      $tentativas++
      if ($tentativas -ge 3) { Falhar "Não foi possível baixar $Url ($($_.Exception.Message))" }
      Escrever "Falha no download, tentando de novo ($tentativas/3)…"
      Start-Sleep -Seconds (3 * $tentativas)
    }
  }
}

# GET na API do GitHub; devolve $null quando o recurso não existe (404)
function ConsultarGitHub([string]$Caminho) {
  try {
    return Invoke-RestMethod -Uri "https://api.github.com/$Caminho" -Headers $Cabecalho -UseBasicParsing
  } catch {
    $resp = $_.Exception.Response
    if ($resp -and [int]$resp.StatusCode -eq 404) { return $null }
    if ($resp -and [int]$resp.StatusCode -eq 403) { Falhar 'O GitHub recusou a consulta (limite de 60 consultas por hora sem login). Tente de novo em alguns minutos.' }
    Falhar "Não foi possível consultar o GitHub ($($_.Exception.Message)). Verifique a conexão com a internet."
  }
}

function ConferirSha256([string]$Arquivo, [string]$Esperado, [string]$Nome) {
  $obtido = (Get-FileHash -Path $Arquivo -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($obtido -ne $Esperado.ToLowerInvariant()) {
    Remove-Item -Force $Arquivo -ErrorAction SilentlyContinue
    Falhar "O arquivo $Nome não confere com o SHA-256 publicado (esperado $Esperado, obtido $obtido). O download foi descartado."
  }
  Escrever "SHA-256 conferido: $Nome"
}

function Extrair([string]$Zip, [string]$Destino) {
  New-Item -ItemType Directory -Force -Path $Destino | Out-Null
  $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
  if (Test-Path $tar) {
    & $tar -xf $Zip -C $Destino
    if ($LASTEXITCODE -ne 0) { Falhar "Não foi possível extrair $Zip" }
  } else {
    Expand-Archive -Path $Zip -DestinationPath $Destino -Force
  }
}

# roda um comando (cmd /c, para juntar a saída de erro sem virar exceção do PowerShell) e repassa a saída
function Rodar([string]$Comando, [string]$Pasta, [string]$Descricao) {
  Escrever "> $Comando"
  Push-Location $Pasta
  try {
    $ErrorActionPreference = 'Continue'
    & cmd.exe /d /c "$Comando 2>&1" | ForEach-Object { Escrever ([string]$_) }
    $codigo = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = 'Stop'
    Pop-Location
  }
  if ($codigo -ne 0) { Falhar "$Descricao falhou (código $codigo). Detalhes em $Registro" }
}

try {
  if (-not [Environment]::Is64BitOperatingSystem) { Falhar 'O LEBR precisa do Windows de 64 bits.' }

  # 1 — última release ------------------------------------------------------------------------------------------
  Etapa 1 'Consultando a última versão no GitHub…'
  if (-not (ConsultarGitHub "repos/$Repositorio")) {
    Falhar "O repositório github.com/$Repositorio não foi encontrado. Ele precisa ser público para o instalador baixar o código."
  }
  $release = ConsultarGitHub "repos/$Repositorio/releases/latest"
  if ($release) {
    $tag = [string]$release.tag_name
    Escrever "Última release: $tag (publicada em $($release.published_at))"
  } else {
    # sem release publicada (só rascunhos ou nenhuma): usa a tag de versão mais alta, se houver
    Escrever "O repositório ainda não tem release publicada; procurando a tag de versão mais recente…"
    $tags = @(@(ConsultarGitHub "repos/$Repositorio/tags?per_page=100") | ForEach-Object { $_ } | Where-Object { $_ -and ([string]$_.name -match '^v?\d+\.\d+\.\d+$') })
    if ($tags.Count -eq 0) {
      Falhar "Ainda não há nenhuma versão publicada em github.com/$Repositorio (nem release nem tag vX.Y.Z). Publique uma release (veja docs/INSTALACAO.md) e rode o instalador de novo."
    }
    $tag = ($tags | Sort-Object { [version]($_.name -replace '^v', '') } -Descending | Select-Object -First 1).name
    $release = [pscustomobject]@{ tag_name = $tag; assets = @() }
    Escrever "Usando a tag $tag."
  }
  if ($tag -notmatch '^v?(\d+\.\d+\.\d+)$') { Falhar "A última release tem uma tag inesperada: '$tag'." }
  $versao = $Matches[1]
  Escrever "Versão: $versao"
  Escrever "@@VERSAO|$versao"

  # 2 — código-fonte --------------------------------------------------------------------------------------------
  Etapa 2 "Baixando o código-fonte da versão $versao…"
  if (Test-Path $Trabalho) { Remove-Item -Recurse -Force $Trabalho }
  New-Item -ItemType Directory -Force -Path $Trabalho | Out-Null
  $zipFonte = Join-Path $Trabalho 'fonte.zip'
  $anexo = $release.assets | Where-Object { $_.name -match '^lebr-fonte.*\.zip$' } | Select-Object -First 1
  if ($anexo) {
    Baixar $anexo.browser_download_url $zipFonte
    $digest = [string]$anexo.digest
    if ($digest -match '^sha256:([0-9a-fA-F]{64})$') { ConferirSha256 $zipFonte $Matches[1] $anexo.name }
    else { Escrever 'Aviso: o GitHub não informou o SHA-256 deste anexo; seguindo só com a conexão HTTPS.' }
  } else {
    Escrever 'A release não tem o anexo lebr-fonte.zip; usando o arquivo .zip gerado pelo GitHub para a tag.'
    Baixar "https://github.com/$Repositorio/archive/refs/tags/$tag.zip" $zipFonte
  }
  $pastaFonte = Join-Path $Trabalho 'fonte'
  Extrair $zipFonte $pastaFonte
  $pacote = Get-ChildItem -Path $pastaFonte -Filter package.json -Recurse -Depth 2 | Where-Object { $_.Directory.FullName -notmatch 'node_modules' } | Sort-Object { $_.FullName.Length } | Select-Object -First 1
  if (-not $pacote) { Falhar 'O código-fonte baixado não tem package.json.' }
  $raiz = $pacote.Directory.FullName
  $manifesto = Get-Content -Raw -Encoding UTF8 $pacote.FullName | ConvertFrom-Json
  if ($manifesto.name -ne 'lebr') { Falhar "O pacote baixado não é o LEBR (name = '$($manifesto.name)')." }
  if ($manifesto.version -ne $versao) { Falhar "A versão do package.json ($($manifesto.version)) não corresponde à tag $tag." }
  if (-not (Test-Path (Join-Path $raiz 'package-lock.json'))) { Falhar 'O código-fonte não tem package-lock.json; as dependências não podem ser conferidas.' }

  # 3 — Node.js -------------------------------------------------------------------------------------------------
  Etapa 3 "Preparando o Node.js $NodeMajor (LTS)…"
  $indice = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing
  $node = $indice | Where-Object { $_.version -like "v$NodeMajor.*" -and $_.files -contains 'win-x64-zip' } | Select-Object -First 1
  if (-not $node) { Falhar "Não encontrei o Node.js $NodeMajor para Windows x64 em nodejs.org." }
  $nomeNode = "node-$($node.version)-win-x64"
  $pastaNode = Join-Path $Ferramentas $nomeNode
  if (-not (Test-Path (Join-Path $pastaNode 'node.exe'))) {
    $zipNode = Join-Path $Ferramentas "$nomeNode.zip"
    Baixar "https://nodejs.org/dist/$($node.version)/$nomeNode.zip" $zipNode
    $somas = (Invoke-WebRequest -Uri "https://nodejs.org/dist/$($node.version)/SHASUMS256.txt" -UseBasicParsing).Content
    $linha = ($somas -split "`n") | Where-Object { $_ -match "\s$([regex]::Escape("$nomeNode.zip"))\s*$" } | Select-Object -First 1
    if ($linha -notmatch '^([0-9a-f]{64})\s') { Falhar "O SHASUMS256.txt do Node.js não traz $nomeNode.zip." }
    ConferirSha256 $zipNode $Matches[1] "$nomeNode.zip"
    Extrair $zipNode $Ferramentas
    Remove-Item -Force $zipNode
    # versões antigas do Node baixadas por instalações anteriores
    Get-ChildItem -Path $Ferramentas -Directory -Filter 'node-v*' | Where-Object { $_.Name -ne $nomeNode } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  } else {
    Escrever "Node.js $($node.version) já está nas ferramentas do instalador."
  }
  $env:PATH = "$pastaNode;$env:SystemRoot\System32;$env:SystemRoot"
  $env:npm_config_cache = Join-Path $Cache 'npm'
  $env:npm_config_update_notifier = 'false'
  $env:npm_config_fund = 'false'
  $env:npm_config_audit = 'false'
  $env:ELECTRON_CACHE = Join-Path $Cache 'electron'
  $env:ELECTRON_BUILDER_CACHE = Join-Path $Cache 'electron-builder'
  $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'

  # 4 — dependências --------------------------------------------------------------------------------------------
  Etapa 4 'Instalando as dependências (npm ci)…'
  Rodar 'npm ci --no-audit --no-fund --loglevel=error' $raiz 'A instalação das dependências'

  # 5 — testes --------------------------------------------------------------------------------------------------
  if ($SemTestes) { Escrever 'Testes pulados (-SemTestes).' }
  else {
    Etapa 5 'Rodando os testes automáticos…'
    Rodar 'npm test --silent' $raiz 'Os testes automáticos'
  }

  # 6 — montagem do programa ------------------------------------------------------------------------------------
  Etapa 6 'Montando o programa (electron-builder)…'
  Rodar 'npx --no-install electron-builder --win dir --x64 --publish never' $raiz 'A montagem do programa'
  $saida = Join-Path $raiz 'dist\win-unpacked'
  if (-not (Test-Path (Join-Path $saida 'LEBR.exe'))) { Falhar 'A montagem terminou sem gerar o LEBR.exe.' }
  Set-Content -Path (Join-Path $saida 'versao-lebr.txt') -Value $versao -Encoding ASCII

  Escrever "@@SAIDA|$saida"
  Escrever "Pronto: LEBR $versao montado em $saida"
  exit 0
} catch {
  $msg = $_.Exception.Message -replace '[\r\n]+', ' '
  Escrever "@@ERRO|$msg"
  exit 1
}
