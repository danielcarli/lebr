#!/usr/bin/env bash
# LEBR — anexa arquivos à release da tag atual ($GITHUB_REF_NAME), criando a release se ela ainda não existir.
# Os jobs de Windows, Linux e macOS rodam ao mesmo tempo: quem chegar primeiro cria a release e os outros só anexam.
# Uso: tools/anexar-release.sh arquivo1 [arquivo2 ...]   (precisa de GH_TOKEN e GITHUB_REF_NAME)
set -euo pipefail
TAG="${GITHUB_REF_NAME:?defina GITHUB_REF_NAME (a tag vX.Y.Z)}"
for tentativa in 1 2 3 4 5; do
  if gh release view "$TAG" >/dev/null 2>&1; then
    gh release upload "$TAG" "$@" --clobber && exit 0
  else
    gh release create "$TAG" "$@" --title "LEBR ${TAG#v}" --generate-notes --latest && exit 0
  fi
  echo "Tentativa $tentativa não deu certo (outro job pode ter criado a release agora); tentando de novo..."
  sleep $((tentativa * 10))
done
echo "Não foi possível anexar os arquivos à release $TAG." >&2
exit 1
