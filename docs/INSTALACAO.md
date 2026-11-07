# Instalação e atualização no Windows

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

Segurança: só HTTPS (TLS 1.2 ou 1.3); endereços fixos (o repositório oficial e `nodejs.org`); todo download
conferido por SHA-256; nada roda como administrador; se qualquer etapa falhar, a instalação existente fica como
estava. O registro completo fica em `%LOCALAPPDATA%\LEBR-Instalador\instalacao.log`. O Node.js e os caches de
download ficam em `%LOCALAPPDATA%\LEBR-Instalador` para as atualizações seguintes serem mais rápidas, e são
apagados na desinstalação.

## Atualizar

- **Pelo programa:** ao abrir, o LEBR consulta a última release; havendo versão nova, aparece **Atualizar agora**
  (também em **Ajuda → Verificar atualizações**). O LEBR fecha, o instalador monta a versão nova e reabre o
  programa.
- **Pelo menu Iniciar:** atalho **Atualizar o LEBR**.
- Rodar o `LEBR-Instalador.exe` de novo tem o mesmo efeito.

## Publicar uma versão (mantenedores)

Cada release precisa de dois anexos: **`lebr-fonte.zip`** (o código-fonte) e **`LEBR-Instalador.exe`**.

**Pelo GitHub Actions (recomendado):** atualize `version` no `package.json`, faça o commit e envie a tag
correspondente:

```bash
git tag v0.34.3
git push origin v0.34.3
```

O fluxo [`.github/workflows/release.yml`](../.github/workflows/release.yml) confere a versão, roda os testes, gera
os dois anexos, cria a release e, no fim, **testa a instalação de ponta a ponta** num Windows limpo, rodando o
`instalar-lebr.ps1` contra a release recém-publicada.

**À mão:** gere o código-fonte com `npm run fonte` (cria `lebr-fonte.zip` a partir do último commit) e o instalador
com o Inno Setup 6.5 ou mais novo (`npm run instalador`, ou abra `instalador/lebr.iss` no Inno Setup e compile).
Crie a release com a tag `vX.Y.Z` (igual à versão do `package.json`), anexe os dois arquivos, publique e deixe
marcado **Set as the latest release**.

**Assinatura digital (recomendado):** com um certificado de assinatura de código, defina um `SignTool` no Inno
Setup e descomente a linha `SignTool=` em `instalador/lebr.iss`; o aviso do SmartScreen deixa de aparecer depois
que o certificado ganha reputação.

## Outras formas

- **Código-fonte:** `npm install` e `npm start` (Node.js 22).
- **Instalador com o programa pronto** (electron-builder): `npm run dist:win:completo` (cerca de 115 MB) ou
  `npm run dist:win` (instalador web). Esses instaladores usam a atualização do electron-updater, que lê o
  `latest.yml` da release.
