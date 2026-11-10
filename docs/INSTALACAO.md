# Instalação e atualização

O LEBR roda no **Windows**, no **Linux** e no **macOS**. Os arquivos de instalação ficam na
[página de releases](https://github.com/danielcarli/lebr/releases/latest):

| Sistema | Arquivo | Atualização |
| --- | --- | --- |
| Windows 10/11 (64 bits) | [`LEBR-Instalador.exe`](https://github.com/danielcarli/lebr/releases/latest/download/LEBR-Instalador.exe) (≈ 2 MB, monta o programa) | pelo programa (barra inferior) |
| Linux x64 — qualquer distribuição | [`LEBR-linux-x86_64.AppImage`](https://github.com/danielcarli/lebr/releases/latest/download/LEBR-linux-x86_64.AppImage) (≈ 100 MB) | pelo programa, sozinho |
| Linux x64 — Debian, Ubuntu, Mint | [`LEBR-linux-amd64.deb`](https://github.com/danielcarli/lebr/releases/latest/download/LEBR-linux-amd64.deb) (≈ 100 MB) | pelo programa (pede a senha) |
| macOS — Apple Silicon (M1 a M4) | [`LEBR-mac-arm64.dmg`](https://github.com/danielcarli/lebr/releases/latest/download/LEBR-mac-arm64.dmg) | o programa avisa; baixe o novo .dmg |
| macOS — Intel | [`LEBR-mac-x64.dmg`](https://github.com/danielcarli/lebr/releases/latest/download/LEBR-mac-x64.dmg) | o programa avisa; baixe o novo .dmg |

Os projetos (`.lebr.json`) são os mesmos nos três sistemas.

# Windows

## Instalar

1. Baixe o **`LEBR-Instalador.exe`** (cerca de 2 MB) — na página de releases
   (<https://github.com/danielcarli/lebr/releases/latest/download/LEBR-Instalador.exe>) ou na pasta `instalador/` do
   repositório. O mesmo instalador serve para todas as versões.
2. Execute. Como ainda não tem assinatura digital, o Windows SmartScreen pode avisar "O Windows protegeu o
   computador": clique em **Mais informações → Executar assim mesmo**.
3. O instalador não traz o programa pronto: ele **monta o LEBR no seu computador** a partir do código-fonte da
   versão mais recente publicada no GitHub (veja abaixo). Leva de 5 a 15 minutos.

Requisitos: Windows 10 (versão 1809 ou mais nova) ou 11, de 64 bits; internet durante a instalação (cerca de
300 MB de downloads); cerca de 1,5 GB livres durante a montagem (a pasta temporária é apagada no fim). Não são
necessários direitos de administrador: o LEBR é instalado em `%LOCALAPPDATA%\Programs\LEBR`.

Desinstale por **Configurações → Aplicativos**. Os projetos salvos e as preferências não são apagados.

## O que o instalador faz

O `LEBR-Instalador.exe` é feito com o **Inno Setup** (o mesmo usado pelo Visual Studio Code) e roda o script
[`instalador/instalar-lebr.ps1`](../instalador/instalar-lebr.ps1), que pode ser lido antes:

1. consulta a última release publicada em `api.github.com/repos/danielcarli/lebr` (rascunhos e pré-lançamentos
   não contam);
2. baixa o código-fonte (`lebr-fonte.zip`) e confere o **SHA-256** que o próprio GitHub calcula para cada anexo da
   release; confere também se o `package.json` é do LEBR e se a versão corresponde à tag;
3. baixa o **Node.js 22 (LTS)** oficial de `nodejs.org` e confere o SHA-256 publicado no `SHASUMS256.txt`;
4. instala as dependências com **`npm ci`**: versões travadas no `package-lock.json`, cada pacote conferido pelo
   hash de integridade do lockfile;
5. roda os **testes automáticos** do LEBR — se algum falhar, nada é instalado;
6. monta o programa (`electron-builder --win dir`) e o instala.

Se a API do GitHub estiver instável (erro 5xx, tempo esgotado) ou no limite de consultas, o instalador tenta de novo
algumas vezes e, se continuar, descobre a última versão pela página de releases do github.com. Nesse caminho o SHA-256
do anexo não está disponível: valem a conexão HTTPS e a conferência do `package.json`. O aviso aparece no registro.

Segurança: só HTTPS (TLS 1.2 ou 1.3); endereços fixos (o repositório oficial e `nodejs.org`); todo download
conferido por SHA-256; nada roda como administrador; se qualquer etapa falhar, a instalação existente fica como
estava. O registro completo fica em `%LOCALAPPDATA%\LEBR-Instalador\instalacao.log`. O Node.js e os caches de
download ficam em `%LOCALAPPDATA%\LEBR-Instalador` para as atualizações seguintes serem mais rápidas, e são
apagados na desinstalação.

## Atualizar

- **Pelo programa:** ao abrir (e a cada 6 horas), o LEBR consulta a última release. A versão aparece no canto direito
  da **barra inferior**: um clique verifica na hora; havendo versão nova, o item fica destacado (**Nova versão x.y.z**)
  e, ao clicar e confirmar — com a opção de salvar o projeto antes —, o LEBR fecha, o instalador monta a versão nova e
  reabre o programa (também em **Ajuda → Verificar atualizações**). No executável portátil e pelo código-fonte, o
  aviso aparece igual, mas o clique abre a página de download.
- **Pelo menu Iniciar:** atalho **Atualizar o LEBR**.
- Rodar o `LEBR-Instalador.exe` de novo tem o mesmo efeito.

# Linux

## AppImage (qualquer distribuição)

1. Baixe o **`LEBR-linux-x86_64.AppImage`**.
2. Dê permissão de execução e abra:

   ```bash
   chmod +x LEBR-linux-x86_64.AppImage
   ./LEBR-linux-x86_64.AppImage
   ```

   (ou, no gerenciador de arquivos: **Propriedades → Permitir executar como programa** e um duplo clique).
3. Se aparecer um erro sobre **FUSE** (Ubuntu 22.04 ou mais novo sem a biblioteca), instale-a com
   `sudo apt install libfuse2` (no Ubuntu 24.04: `sudo apt install libfuse2t64`) — ou rode sem ela, com
   `./LEBR-linux-x86_64.AppImage --appimage-extract-and-run`.

O AppImage se atualiza sozinho: com versão nova, a barra inferior mostra **Nova versão x.y.z**; depois de confirmar,
ele baixa a versão nova, troca o arquivo e reabre. Para ter o LEBR no menu de aplicativos, use um integrador como o
*Gear Lever* ou o *AppImageLauncher*, ou instale o pacote .deb.

## Pacote .deb (Debian, Ubuntu, Linux Mint, Pop!_OS)

```bash
sudo apt install ./LEBR-linux-amd64.deb
```

O LEBR aparece no menu de aplicativos (categoria Ciência) e é instalado em `/opt/LEBR`. Para atualizar, o programa
baixa o pacote novo e o sistema pede a senha de administrador; ou instale o .deb novo do mesmo jeito. Para remover:
`sudo apt remove lebr` (os projetos salvos e as preferências, em `~/.config/LEBR`, ficam).

Requisitos: Linux de 64 bits (x86_64) com interface gráfica; cerca de 300 MB livres.

# macOS

1. Baixe o **`.dmg`** do seu Mac: **`LEBR-mac-arm64.dmg`** para os Macs com chip Apple (M1, M2, M3, M4) ou
   **`LEBR-mac-x64.dmg`** para os Macs com processador Intel (menu  → **Sobre este Mac** mostra qual é).
2. Abra o .dmg e arraste o **LEBR** para a pasta **Aplicativos**.
3. Na primeira vez, o macOS bloqueia, porque o LEBR ainda não tem a assinatura nem a autenticação (*notarização*) da
   Apple — é um projeto aberto, sem conta paga de desenvolvedor. Para liberar:
   - abra o LEBR uma vez (aparece o aviso), vá em **Ajustes do Sistema → Privacidade e Segurança** e, no fim da
     página, clique em **Abrir Mesmo Assim** ao lado do aviso do LEBR; confirme com a senha; **ou**
   - no Terminal: `xattr -dr com.apple.quarantine /Applications/LEBR.app`

   Se o macOS disser que o app "está danificado", é o mesmo bloqueio: use o comando do Terminal acima.

Requisitos: macOS 12 (Monterey) ou mais novo. A atualização automática do macOS exige app assinado pela Apple; por
isso o LEBR **avisa** da versão nova na barra inferior e, ao clicar e confirmar, abre a página de download — basta
arrastar o novo LEBR para Aplicativos, substituindo o antigo.

# Publicar uma versão (mantenedores)

Cada release tem os anexos **`lebr-fonte.zip`** (o código-fonte) e **`LEBR-Instalador.exe`** (Windows),
**`LEBR-linux-x86_64.AppImage`**, **`LEBR-linux-amd64.deb`** e **`latest-linux.yml`** (Linux) e
**`LEBR-mac-arm64.dmg`** e **`LEBR-mac-x64.dmg`** (macOS).

**Pelo GitHub Actions (recomendado):** atualize `version` no `package.json`, faça o commit e envie a tag
correspondente:

```bash
git tag v0.69.0
git push origin v0.69.0
```

O fluxo [`.github/workflows/release.yml`](../.github/workflows/release.yml) roda três jobs em paralelo — Windows,
Linux e macOS —, cada um conferindo a versão e rodando os testes antes de gerar os seus anexos; o primeiro a terminar
cria a release e os outros anexam a ela (`tools/anexar-release.sh`). O job do Windows **testa a instalação de ponta
a ponta** num Windows limpo, rodando o `instalar-lebr.ps1` contra a release recém-publicada; o do Linux abre o
AppImage sem tela e confere a janela; o do macOS confere as imagens .dmg.

**À mão:** gere o código-fonte com `npm run fonte` (cria `lebr-fonte.zip` a partir do último commit) e o instalador
com o Inno Setup 6.5 ou mais novo (`npm run instalador`, ou abra `instalador/lebr.iss` no Inno Setup e compile).
Crie a release com a tag `vX.Y.Z` (igual à versão do `package.json`), anexe os dois arquivos, publique e deixe
marcado **Set as the latest release**.

**Assinatura digital (recomendado):** com um certificado de assinatura de código, defina um `SignTool` no Inno
Setup e descomente a linha `SignTool=` em `instalador/lebr.iss`; o aviso do SmartScreen deixa de aparecer depois
que o certificado ganha reputação.

# Outras formas

- **Código-fonte:** `npm install` e `npm start` (Node.js 22), em qualquer um dos três sistemas.
- **Linux e macOS à mão:** `npm run dist:linux` (AppImage e .deb, num Linux) e `npm run dist:mac` (.dmg Intel e
  Apple Silicon, num Mac); os arquivos ficam em `dist/`.
- **Instalador com o programa pronto** (electron-builder): `npm run dist:win:completo` (cerca de 115 MB) ou
  `npm run dist:win` (instalador web). Esses instaladores usam a atualização do electron-updater, que lê o
  `latest.yml` da release.
