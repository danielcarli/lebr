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
/**
 * Tamanho do LEBR em Configurações › Aplicativos (Windows, 0.69.1).
 *
 * O LEBR-Instalador.exe instala arquivos montados na hora (Flags: external), cujo tamanho o Inno Setup não conhece;
 * o "EstimatedSize" da chave de desinstalação ficava errado e o Windows mostrava ~164 GB. O instalador 1.0.1 grava o
 * valor certo, mas a atualização pelo programa roda a cópia do instalador guardada no computador, que pode ser a
 * antiga. Por isso o próprio LEBR, instalado pelo instalador, mede a pasta dele e corrige o valor ao abrir.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

/** Chave de desinstalação do LEBR-Instalador (AppId do lebr.iss + "_is1"), por usuário. */
const CHAVE = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{E3A3337D-22FB-4322-8B98-148D363E6F6A}_is1';

/** Tamanho de uma pasta e de tudo o que está nela, em KB (como o FolderKB do instalador: arquivo a arquivo). */
async function pastaKB(dir) {
  let kb = 0;
  let itens;
  try { itens = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return 0; }
  for (const it of itens) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) kb += await pastaKB(p);
    else if (it.isFile()) { try { kb += Math.floor((await fs.promises.stat(p)).size / 1024); } catch { /* sumiu */ } }
  }
  return kb;
}

const reg = (args) => new Promise((ok) => execFile('reg.exe', args, { windowsHide: true }, (err, saida) => ok(err ? null : String(saida))));

/** Lê o EstimatedSize atual (KB) da saída do reg query, ou null. */
function lerEstimado(saida) {
  const m = /EstimatedSize\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(saida ?? '');
  return m ? parseInt(m[1], 16) : null;
}

/**
 * Corrige o EstimatedSize, se o LEBR foi instalado pelo instalador (a chave existe) e o valor gravado estiver longe
 * do tamanho real (mais de 10 %). Silencioso: qualquer erro só deixa como estava.
 */
async function corrigirTamanhoInstalado(pasta = path.dirname(process.execPath)) {
  if (process.platform !== 'win32') return null;
  const atual = await reg(['query', CHAVE]);
  if (atual == null || !/DisplayName/i.test(atual)) return null;      // não foi o instalador: não cria a chave
  const kb = await pastaKB(pasta);
  if (!(kb > 0)) return null;
  const antes = lerEstimado(atual);
  if (antes != null && Math.abs(antes - kb) <= kb * 0.1) return { kb, antes, gravado: false };
  const ok = await reg(['add', CHAVE, '/v', 'EstimatedSize', '/t', 'REG_DWORD', '/d', String(Math.min(kb, 0xffffffff)), '/f']);
  return { kb, antes, gravado: ok != null };
}

module.exports = { corrigirTamanhoInstalado, pastaKB, lerEstimado, CHAVE };
