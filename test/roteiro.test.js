/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Opus 5.5, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU General Public
 * License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas SEM
 * NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/gpl-3.0.html>.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
/** O roteiro do programa (Ajuda › Roteiro) e o docs/ROTEIRO.md têm o mesmo conteúdo. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROTEIRO, roteiroMarkdown } from '../src/renderer/views/roteiro-dados.js';

test('roteiro: três fases com critério de saída e áreas preenchidas', () => {
  assert.equal(ROTEIRO.fases.length, 3);
  for (const f of ROTEIRO.fases) { assert.ok(f.itens.length >= 5); assert.ok(f.saida); }
  for (const a of ROTEIRO.areas) {
    assert.ok(a.linhas || a.grupos || a.itens, a.titulo);
    for (const l of a.linhas ?? []) assert.equal(l.length, a.colunas.length, `${a.titulo}: ${l[0]}`);
  }
});

test('roteiro: docs/ROTEIRO.md está em dia com os dados', () => {
  const md = fs.readFileSync(new URL('../docs/ROTEIRO.md', import.meta.url), 'utf8');
  assert.equal(md.trim(), roteiroMarkdown().trim(), 'gere de novo: node -e "…roteiroMarkdown()" > docs/ROTEIRO.md');
});
