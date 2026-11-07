; LEBR — Laboratório de Estruturas Brasil
; Copyright (C) 2026 Daniel Michelon De Carli
; SPDX-License-Identifier: GPL-3.0-only
;
; Instalador do Windows (Inno Setup 6.5 ou mais novo). Não traz o programa: na hora da instalação ele roda o
; instalar-lebr.ps1, que baixa o código-fonte da última release do GitHub, confere os arquivos, roda os testes e
; monta o LEBR neste computador. Os arquivos montados são então instalados como num instalador comum.
;
; Gerar:  iscc instalador\lebr.iss    (cria instalador\LEBR-Instalador.exe)
; Assinar (recomendado): defina um SignTool com o seu certificado de assinatura de código e descomente SignTool=.

#define Nome "LEBR"
#define NomeLongo "LEBR — Laboratório de Estruturas Brasil"
#define Repositorio "danielcarli/lebr"
#define VersaoInstalador "1.0.0"

[Setup]
AppId={{E3A3337D-22FB-4322-8B98-148D363E6F6A}
AppName={#NomeLongo}
AppVersion={code:VersaoInstalada}
AppVerName={#NomeLongo}
AppPublisher=Daniel Michelon De Carli
AppPublisherURL=https://github.com/{#Repositorio}
AppSupportURL=https://github.com/{#Repositorio}/issues
AppUpdatesURL=https://github.com/{#Repositorio}/releases
AppCopyright=Copyright (C) 2026 Daniel Michelon De Carli — GPL-3.0
VersionInfoVersion={#VersaoInstalador}
VersionInfoDescription=Instalador do LEBR (monta a última versão do GitHub)
VersionInfoProductName={#Nome}
; instalação só para o usuário, sem administrador, numa pasta própria
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\{#Nome}
DisableDirPage=yes
DisableProgramGroupPage=yes
UsePreviousAppDir=no
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
LicenseFile=..\LICENSE
InfoBeforeFile=antes-de-instalar.txt
SetupIconFile=..\build\icon.ico
UninstallDisplayIcon={app}\LEBR.exe
UninstallDisplayName={#NomeLongo}
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
CloseApplications=force
RestartApplications=no
SetupLogging=yes
OutputDir=.
OutputBaseFilename=LEBR-Instalador
; SignTool=assinatura

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "instalar-lebr.ps1"; Flags: dontcopy
; o programa montado pelo instalar-lebr.ps1 (pasta temporária)
Source: "{code:PastaMontada}\*"; DestDir: "{app}"; Flags: external recursesubdirs createallsubdirs ignoreversion
; cópia do próprio instalador, usada para atualizar (atalho "Atualizar o LEBR" e Ajuda > Verificar atualizações)
Source: "{srcexe}"; DestDir: "{localappdata}\LEBR-Instalador"; DestName: "LEBR-Instalador.exe"; Flags: external ignoreversion; Check: NaoEstaRodandoDaCopia

[InstallDelete]
; arquivos da versão anterior (só os do Electron/LEBR, nunca a pasta inteira nem o desinstalador unins*)
Type: filesandordirs; Name: "{app}\resources"
Type: filesandordirs; Name: "{app}\locales"
Type: files; Name: "{app}\*.dll"
Type: files; Name: "{app}\*.pak"
Type: files; Name: "{app}\*.bin"
Type: files; Name: "{app}\icudtl.dat"
Type: files; Name: "{app}\vk_swiftshader_icd.json"
Type: files; Name: "{app}\LEBR.exe"

[Icons]
Name: "{autoprograms}\{#Nome}"; Filename: "{app}\LEBR.exe"; Comment: "{#NomeLongo}"
Name: "{autoprograms}\Atualizar o {#Nome}"; Filename: "{localappdata}\LEBR-Instalador\LEBR-Instalador.exe"; Parameters: "/ATUALIZAR"; Comment: "Baixa e monta a última versão do LEBR publicada no GitHub"
Name: "{autodesktop}\{#Nome}"; Filename: "{app}\LEBR.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\LEBR.exe"; Description: "{cm:LaunchProgram,{#Nome}}"; Flags: nowait postinstall skipifsilent
; atualização (/ATUALIZAR, pelo atalho ou de dentro do programa): reabre o LEBR no fim
Filename: "{app}\LEBR.exe"; Flags: nowait; Check: ModoAtualizacao

[UninstallDelete]
; ferramentas, caches e registros do instalador (os projetos e preferências do usuário ficam)
Type: filesandordirs; Name: "{localappdata}\LEBR-Instalador"

[Code]
const
  TOTAL_ETAPAS = 6;

var
  Pagina: TOutputProgressWizardPage;
  Pasta, Versao, Erro: String;
  Etapa: Integer;

function PastaMontada(Param: String): String;
begin
  Result := Pasta;
end;

function VersaoInstalada(Param: String): String;
begin
  if Versao <> '' then Result := Versao else Result := 'última versão do GitHub';
end;

{ /ATUALIZAR: atualização pelo atalho "Atualizar o LEBR" ou pelo programa — pula as telas iniciais e a final }
function ModoAtualizacao: Boolean;
var
  I: Integer;
begin
  Result := False;
  for I := 1 to ParamCount do
    if CompareText(ParamStr(I), '/ATUALIZAR') = 0 then Result := True;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := ModoAtualizacao and ((PageID = wpWelcome) or (PageID = wpLicense) or (PageID = wpInfoBefore) or
    (PageID = wpSelectTasks) or (PageID = wpReady) or (PageID = wpFinished));
end;

function NaoEstaRodandoDaCopia: Boolean;
begin
  Result := CompareText(ExpandConstant('{srcexe}'), ExpandConstant('{localappdata}\LEBR-Instalador\LEBR-Instalador.exe')) <> 0;
end;

function TextoDaEtapa(N: Integer): String;
begin
  case N of
    1: Result := 'Consultando a última versão publicada no GitHub…';
    2: Result := 'Baixando o código-fonte e conferindo o SHA-256…';
    3: Result := 'Preparando o Node.js (LTS) oficial…';
    4: Result := 'Instalando as dependências (npm ci)…';
    5: Result := 'Rodando os testes automáticos do LEBR…';
    6: Result := 'Montando o programa…';
  else
    Result := 'Trabalhando…';
  end;
  if Versao <> '' then Result := Result + '   (versão ' + Versao + ')';
end;

{ recebe, linha a linha, a saída do instalar-lebr.ps1 }
procedure AoReceberLinha(const S: String; const ErroDeLeitura, PrimeiraLinha: Boolean);
var
  Resto: String;
  P: Integer;
begin
  if ErroDeLeitura then
  begin
    Log('Erro ao ler a saída: ' + S);
    Exit;
  end;
  Log(S);
  if Copy(S, 1, 8) = '@@ETAPA|' then
  begin
    Resto := Copy(S, 9, Length(S));
    P := Pos('|', Resto);
    if P > 0 then Etapa := StrToIntDef(Copy(Resto, 1, P - 1), Etapa);
    Pagina.SetText(TextoDaEtapa(Etapa), '');
    Pagina.SetProgress(Etapa - 1, TOTAL_ETAPAS);
  end
  else if Copy(S, 1, 9) = '@@VERSAO|' then
    Versao := Trim(Copy(S, 10, Length(S)))
  else if Copy(S, 1, 8) = '@@SAIDA|' then
    Pasta := Trim(Copy(S, 9, Length(S)))
  else if Copy(S, 1, 7) = '@@ERRO|' then
    Erro := Trim(Copy(S, 8, Length(S)))
  else if Trim(S) <> '' then
    Pagina.SetText(TextoDaEtapa(Etapa), Copy(Trim(S), 1, 120));
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Codigo: Integer;
  Ok: Boolean;
  PowerShell, Parametros: String;
begin
  Result := '';
  Pasta := '';
  Erro := '';
  Etapa := 0;
  ExtractTemporaryFile('instalar-lebr.ps1');
  Pagina := CreateOutputProgressPage('Montando o LEBR neste computador',
    'O instalador baixa o código-fonte da última versão publicada no GitHub, confere os arquivos, roda os testes ' +
    'e monta o programa. Isso leva alguns minutos; não feche esta janela.');
  Pagina.SetText('Iniciando…', '');
  Pagina.SetProgress(0, TOTAL_ETAPAS);
  Pagina.Show;
  try
    PowerShell := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
    Parametros := '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
      ExpandConstant('{tmp}\instalar-lebr.ps1') + '"';
    try
      Ok := ExecAndLogOutput(PowerShell, Parametros, ExpandConstant('{tmp}'), SW_SHOWNORMAL,
        ewWaitUntilTerminated, Codigo, @AoReceberLinha);
    except
      Ok := False;
      Erro := GetExceptionMessage;
    end;
    if Ok and (Codigo = 0) and (Pasta <> '') and FileExists(AddBackslash(Pasta) + 'LEBR.exe') then
      Pagina.SetProgress(TOTAL_ETAPAS, TOTAL_ETAPAS)
    else
    begin
      if Erro = '' then Erro := 'O PowerShell terminou com o código ' + IntToStr(Codigo) + '.';
      Result := 'Não foi possível montar o LEBR. Nada foi alterado na instalação existente.' + #13#10#13#10 +
        Erro + #13#10#13#10 + 'O registro completo está em ' +
        ExpandConstant('{localappdata}\LEBR-Instalador\instalacao.log') + '.';
    end;
  finally
    Pagina.Hide;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  { a pasta de montagem (código, node_modules, dist) ocupa centenas de MB: apaga depois de instalar }
  if CurStep = ssPostInstall then
    DelTree(ExpandConstant('{localappdata}\LEBR-Instalador\compilacao'), True, True, True);
end;
