/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU Affero General
 * Public License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas
 * SEM NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/agpl-3.0.html>.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/** Tamanho instalado no Windows (0.69.1): medida da pasta, leitura do registro e o .iss com o EstimatedSize. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { pastaKB, lerEstimado, corrigirTamanhoInstalado, CHAVE } = require('../src/main/tamanho-instalado.cjs');

test('tamanho instalado: soma os arquivos das subpastas em KB, arquivo a arquivo', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lebr-kb-'));
  fs.mkdirSync(path.join(d, 'a', 'b'), { recursive: true });
  fs.writeFileSync(path.join(d, 'x.bin'), Buffer.alloc(5000));          // 4 KB inteiros
  fs.writeFileSync(path.join(d, 'a', 'y.bin'), Buffer.alloc(2048));     // 2 KB
  fs.writeFileSync(path.join(d, 'a', 'b', 'z.bin'), Buffer.alloc(1023)); // 0 KB
  assert.equal(await pastaKB(d), 6);
  assert.equal(await pastaKB(path.join(d, 'nao-existe')), 0);
  fs.rmSync(d, { recursive: true, force: true });
});

test('tamanho instalado: lê o DWORD do reg query; fora do Windows não faz nada', async () => {
  assert.equal(lerEstimado('    EstimatedSize    REG_DWORD    0x56a4c\r\n'), 0x56a4c);
  assert.equal(lerEstimado('    DisplayName    REG_SZ    LEBR'), null);
  if (process.platform !== 'win32') assert.equal(await corrigirTamanhoInstalado('.'), null);
});

test('instalador: grava o EstimatedSize na chave do AppId depois de instalar', () => {
  const iss = fs.readFileSync(new URL('../instalador/lebr.iss', import.meta.url), 'utf8');
  const appId = /AppId=\{(\{[0-9A-F-]+\})/i.exec(iss)[1];
  assert.ok(iss.includes(`Uninstall\\${appId}_is1`), 'chave com o AppId de uma chave só');
  assert.ok(CHAVE.endsWith(`${appId}_is1`), 'o programa usa a mesma chave');
  assert.match(iss, /PrivilegesRequired=lowest/);
  assert.match(iss, /RegWriteDWordValue\(HKCU, '\{#ChaveDesinstalacao\}', 'EstimatedSize', KB\)/);
  const post = /if CurStep = ssPostInstall then\s*begin([\s\S]*?)end;\s*end;/.exec(iss)[1];
  assert.match(post, /WriteEstimatedSize;/, 'chamado no ssPostInstall');
  assert.match(iss, /Log\(Format\('Installed size: %d KB'/);
});
