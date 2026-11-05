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
/** Unidade de exibição das dimensões (cm ou mm): conversão de textos e números. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { definirUnidadeComprimento, converterTexto, converterCelula, cmParaMmTexto } from '../src/renderer/core/unidades.js';
import { criarProjeto, lerProjeto, serializar } from '../src/renderer/core/projeto.js';

test('em cm nada muda', () => {
  definirUnidadeComprimento('cm');
  assert.equal(converterTexto('h = 18 cm · ø 5 c/ 15'), 'h = 18 cm · ø 5 c/ 15');
  assert.equal(converterCelula('6,50'), '6,50');
});

test('em mm: dimensões, pares b × h e espaçamentos; áreas não mudam', () => {
  definirUnidadeComprimento('mm');
  const casos = [
    ['h = 18 cm', 'h = 180 mm'],
    ['Seção 20 × 40 cm', 'Seção 200 × 400 mm'],
    ['ø 5 c/ 15 cm', 'ø 5 c/ 150 mm'],
    ['ø 5 c/ 10,5', 'ø 5 c/ 105'],
    ['As = 2,00 cm²/m', 'As = 2,00 cm²/m'],
    ['d = 6,50 cm', 'd = 65 mm'],
    ['c1 = 12,25 cm', 'c1 = 122,5 mm'],
    ['flecha 4,4 mm', 'flecha 4,4 mm'],
    ['vão 5,00 m', 'vão 5,00 m'],
    ['−3,5 cm', '−35 mm'],
  ];
  for (const [a, b] of casos) assert.equal(converterTexto(a), b, a);
  assert.equal(converterCelula('6,50'), '65');
  assert.equal(converterCelula('—'), '—');
  assert.equal(cmParaMmTexto('0,25'), '2,5');
  definirUnidadeComprimento('cm');
});

test('parâmetro salvo no projeto e padrão em arquivos antigos', () => {
  const p = criarProjeto({ nome: 't' });
  assert.equal(p.parametros.unidades.comprimento, 'cm');
  p.parametros.unidades.comprimento = 'mm';
  assert.equal(lerProjeto(serializar(p)).parametros.unidades.comprimento, 'mm');
  const antigo = JSON.parse(serializar(p));
  delete antigo.parametros.unidades;
  assert.equal(lerProjeto(JSON.stringify(antigo)).parametros.unidades.comprimento, 'cm');
});
