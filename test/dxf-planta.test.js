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
/** Planta de arquitetura em DXF como fundo da montagem: leitura, blocos, arcos, textos e unidade. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerPlantaDxf, comBulge, limparMtext } from '../src/engine/dxf-planta.js';
import { Dxf } from '../src/engine/dxf.js';
import { gerarPranchas } from '../src/modules/comum/pranchas.js';
import { lerProjeto } from '../src/renderer/core/projeto.js';

const texto = fs.readFileSync(new URL('./dados/planta-arquitetura.dxf', import.meta.url), 'utf8');

test('planta em mm: polilinhas, blocos expandidos (com rotação), textos e camadas', () => {
  const d = lerPlantaDxf(texto);
  assert.equal(d.unidade, 'mm');
  assert.equal(d.unidadeLida, 'mm');
  assert.equal(d.fatorMetros, 0.001);
  assert.deepEqual(d.camadas.sort(), ['A-PAREDE', 'A-PORTA', 'A-TEXTO']);
  assert.ok(d.limites.x0 <= 0 && d.limites.x1 >= 8150 && d.limites.y1 >= 10150);
  // 3 paredes fechadas + 2 portas (linha + arco cada)
  assert.equal(d.entidades.filter((e) => d.camadas[e.c] === 'A-PAREDE').length, 3);
  assert.equal(d.entidades.filter((e) => d.camadas[e.c] === 'A-PORTA').length, 4);
  // a porta girada 90° em (8000, 2000): a folha vai de (8000,2000) para (7200,2000)
  const folhas = d.entidades.filter((e) => d.camadas[e.c] === 'A-PORTA' && e.p.length === 4);
  assert.ok(folhas.some((e) => Math.abs(e.p[0] - 8000) < 1e-6 && Math.abs(e.p[2] - 7200) < 1e-6 && Math.abs(e.p[3] - 2000) < 1e-6));
  assert.deepEqual(d.textos.map((t) => t.t).sort(), ['QUARTO', 'SALA Área 39 m²']);
  assert.equal(d.ignoradas.HATCH, 1);
});

test('arco por bulge, MTEXT limpo e unidade pela extensão quando o cabeçalho não diz', () => {
  const p = comBulge(0, 0, 2, 0, 1);       // meia-volta anti-horária: passa por (1, -1)
  const ys = p.filter((_, i) => i % 2);
  assert.ok(Math.min(...ys) < -0.99 && Math.abs(p.at(-2) - 2) < 1e-12);
  assert.equal(limparMtext('{\\fArial|b0;A}\\PB %%c10'), 'A B ø10');
  const semUnidade = texto.replace('$INSUNITS\n70\n4', '$INSUNITS\n70\n0');
  assert.equal(lerPlantaDxf(semUnidade).unidade, 'mm');          // 10 m desenhados com 10150 unidades
  assert.throws(() => lerPlantaDxf('AC1032 binário'), /DWG/);
});

test('as pranchas que o próprio LEBR exporta voltam como planta (R12, POLYLINE/VERTEX, cm)', () => {
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-3-pavimentos.lebr.json', import.meta.url), 'utf8'));
  const formas = gerarPranchas(p, { locacao: false, vigas: false, pilares: false, lajes: false })[0];
  const d = lerPlantaDxf(formas.conteudo);
  assert.ok(d.entidades.length > 20 && d.textos.length > 10);
  assert.ok(d.camadas.includes('PILARES') && d.camadas.includes('VIGAS'));
  void Dxf;
});
