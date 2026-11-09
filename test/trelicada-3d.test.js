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
/** Vista 3D da laje treliçada (0.66). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';

const abrir = (arq) => lerProjeto(fs.readFileSync(new URL(`../exemplos/${arq}`, import.meta.url), 'utf8'));

test('laje treliçada em 3D: vigotas, treliças, adicionais, distribuição e negativas dentro da laje', async () => {
  const { modeloTrelicada } = await import('../src/modules/comum/armadura3d.js');
  const { trelicaAdotada } = await import('../src/modules/concreto-laje-trelicada/calculo.js');
  const p = abrir('sobrado-garagem.lebr.json');
  const el = p.elementos.find((e) => e.modulo === 'concreto.laje.trelicada');
  const res = calcularElemento(el, p, { obter: (id) => MODULOS_CALCULO[id] });
  assert.ok(!res.erro, res.erro);
  const m = modeloTrelicada(el, res, trelicaAdotada(el));
  const nV = m.caixas.filter((c) => c.parte === 'vigota').length;
  assert.equal(nV, Math.ceil((el.largura * 100 - el.intereixo / 2) / el.intereixo));
  assert.ok(m.barras.filter((b) => b.tipo === 'treliça').length === 5 * nV, 'dois banzos inferiores, um superior e duas diagonais por vigota');
  assert.ok(m.barras.some((b) => b.tipo === 'distribuição'));
  const h = el.he + el.hf;
  for (const b of m.barras) for (const [, y, z] of b.pts) { assert.ok(y >= 0 && y <= el.largura * 100, `${b.id} y`); assert.ok(z > 0 && z < h, `${b.id} z ${z}`); }
  if (res.adicional) assert.equal(m.barras.filter((b) => b.id === 'adicional').length, res.adicional.n * nV);
  assert.match(m.legenda, /vigota/);
});
