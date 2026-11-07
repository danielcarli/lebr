# Instalador do LEBR para Windows

| Arquivo | O que é |
|---|---|
| `LEBR-Instalador.exe` | O instalador (Inno Setup, cerca de 2 MB). Serve para todas as versões. |
| `instalar-lebr.ps1` | O script que o instalador roda: baixa o código-fonte da última release do GitHub, confere os SHA-256, instala as dependências com `npm ci`, roda os testes e monta o LEBR neste computador. |
| `lebr.iss` | O projeto do Inno Setup (`npm run instalador` ou `iscc instalador/lebr.iss`). |
| `antes-de-instalar.txt` | O texto mostrado antes da instalação. |

Requisitos: Windows 10 (1809+) ou 11 de 64 bits, internet durante a instalação, cerca de 1,5 GB livres
temporariamente. Não precisa de administrador.

O Windows SmartScreen pode avisar "O Windows protegeu o computador", porque o instalador ainda não tem
assinatura digital: clique em **Mais informações → Executar assim mesmo**.

Detalhes, segurança e como publicar uma versão: [docs/INSTALACAO.md](../docs/INSTALACAO.md).
