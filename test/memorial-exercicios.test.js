/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Opus 5.5, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU Affero General
 * Public License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas
 * SEM NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/agpl-3.0.html>.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/** Memorial dos exercícios resolvidos: todo caso da bibliografia tem passos sem NaN e um desenho conhecido. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { memorialDoCaso } from '../src/validacao/memorial-exercicios.js';
import { ehArquivoBibliografia } from '../src/validacao/bibliografia-notas.js';

const pasta = new URL('../validacao/casos/', import.meta.url);
// o módulo dos desenhos importa o DOM; lê os tipos direto do fonte
const fonte = fs.readFileSync(new URL('../src/renderer/views/bibliografia-desenhos.js', import.meta.url), 'utf8');
const corpoD = fonte.slice(fonte.indexOf('const D = {'), fonte.indexOf('/** SVG do desenho'));
const TIPOS = new Set([...corpoD.matchAll(/^ {2}(?:'([\w-]+)'|(\w+))\(d\)/gm)].map((m) => m[1] ?? m[2]));

test('memorial dos exercícios resolvidos: todo caso tem passos legíveis e um desenho', () => {
  assert.ok(TIPOS.size >= 15, `tipos de desenho lidos: ${[...TIPOS].join(', ')}`);
  let total = 0;
  for (const arq of fs.readdirSync(pasta).filter((f) => f.endsWith('.json') && ehArquivoBibliografia(f))) {
    for (const caso of JSON.parse(fs.readFileSync(new URL(arq, pasta), 'utf8')).casos) {
      const m = memorialDoCaso(caso);
      total++;
      assert.ok(m.secoes.length > 0, `${caso.id}: sem passos`);
      for (const s of m.secoes) for (const l of s.linhas) assert.ok(!/NaN|undefined/.test(l), `${caso.id}: "${l}"`);
      assert.ok(m.desenho && TIPOS.has(m.desenho.tipo), `${caso.id}: desenho ${m.desenho?.tipo}`);
    }
  }
  assert.ok(total > 100, `${total} casos`);
});
