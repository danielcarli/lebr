# Instalação e atualização no Windows

## Instalar

1. Baixe `LEBR-Setup-X.Y.Z-win-x64.exe` na página de releases: <https://github.com/danielcarli/lebr/releases>.
2. Execute o instalador. Como ele ainda não tem assinatura digital, o Windows SmartScreen pode avisar
   "O Windows protegeu o computador": clique em **Mais informações → Executar assim mesmo**.
3. Escolha a pasta (o padrão é a pasta do usuário, sem precisar de administrador). O instalador cria os atalhos
   na Área de Trabalho e no menu Iniciar. Desinstale por **Configurações → Aplicativos**; os projetos salvos e as
   preferências não são apagados.

## Atualizar

- **Automático:** ao abrir, o LEBR instalado consulta a última release do GitHub. Havendo versão mais nova, ela é
  baixada em segundo plano e aparece o aviso **Reiniciar e atualizar**; se preferir, a atualização é instalada ao
  fechar o programa.
- **A pedido:** **Ajuda → Verificar atualizações**.
- **Manual:** executar o instalador de uma versão mais nova por cima da instalada também atualiza, mantendo os
  dados.

O executável portátil e o código-fonte (`npm start`) não se atualizam sozinhos.

## Publicar uma versão (mantenedores)

A atualização automática lê os arquivos da release: o instalador `.exe`, o `.exe.blockmap` e o `latest.yml`.

**Pelo GitHub Actions (recomendado):** atualize `version` no `package.json`, faça o commit e envie a tag:

```bash
git tag v0.33.1
git push origin v0.33.1
```

O fluxo `.github/workflows/release.yml` roda os testes, gera o instalador no Windows e publica os três arquivos
numa release com o nome da tag.

**À mão:** gere com `npm run dist:win` (no Windows; no Linux é preciso o Wine) e anexe à release `vX.Y.Z` os
três arquivos de `dist/`: `LEBR-Setup-X.Y.Z-win-x64.exe`, `LEBR-Setup-X.Y.Z-win-x64.exe.blockmap` e
`latest.yml`. A release precisa estar publicada (não rascunho) e a tag tem de corresponder à versão.
