/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 * SPDX-License-Identifier: GPL-3.0-only
 */
/**
 * Deixa os arquivos do instalador prontos para a release do GitHub.
 *
 * O instalador (LEBR-Setup-win-x64.exe) não traz o programa: ele baixa sempre
 * https://github.com/danielcarli/lebr/releases/latest/download/lebr-x64.nsis.7z — o pacote da release mais recente.
 * Para esse endereço fixo funcionar, o pacote precisa ter o mesmo nome em todas as releases, sem a versão.
 * O electron-builder gera lebr-X.Y.Z-x64.nsis.7z; este script renomeia e corrige o latest.yml (que a atualização
 * automática do programa instalado lê).
 */
import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const pasta = process.argv[2] ?? 'dist/nsis-web';
const fixo = 'lebr-x64.nsis.7z';
const pacote = readdirSync(pasta).find((f) => /^lebr-\d+\.\d+\.\d+.*-x64\.nsis\.7z$/.test(f));
if (!pacote && !existsSync(join(pasta, fixo))) {
  console.error(`Nenhum pacote lebr-*-x64.nsis.7z em ${pasta}.`);
  process.exit(1);
}
if (pacote) renameSync(join(pasta, pacote), join(pasta, fixo));
const yml = join(pasta, 'latest.yml');
const texto = readFileSync(yml, 'utf8').replace(/lebr-\d+\.\d+\.\d+[^\s]*-x64\.nsis\.7z/g, fixo);
writeFileSync(yml, texto);
console.log(`Pronto para a release: ${readdirSync(pasta).filter((f) => !f.endsWith('.yml') || f === 'latest.yml').join(', ')}`);
