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
/** Flexão oblíqua em pilares (17.2) e envoltória mínima (11.3.3.4.3). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esforcosObliqua, curvaInteracao, resistenciaNaDirecao, verificarPontos, envoltoriaMinima } from '../src/engine/flexao-obliqua.js';
import { esforcosResistentes, distribuirBarras } from '../src/engine/flexocompressao.js';
import { concreto, aco } from '../src/engine/materiais.js';
import { areaBarra } from '../src/engine/barras.js';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';

const c = concreto(25), s = aco(500);
const registro = { obter: (id) => MODULOS_CALCULO[id] };
const secao = (phi, n, bx = 20, by = 40) => {
  const { pontos } = distribuirBarras({ bx, by, n, o: 3 + 0.5 + phi / 20 });
  return { bx, by, barras: pontos.map((p) => ({ ...p, A: areaBarra(phi) })) };
};

test('com a linha neutra paralela a um eixo, coincide com a flexão normal (tensão plena)', () => {
  const sec = secao(16, 6);
  const secX = { b: 40, h: 20, barras: sec.barras.map((p) => ({ y: 20 - p.x, A: p.A })) };
  for (const x of [6, 12, 18]) {
    const a = esforcosObliqua(0, x, sec, c, s), b = esforcosResistentes(x, secX, c, s);
    assert.ok(Math.abs(a.N - b.N) < 1e-6 && Math.abs(a.Mx - b.M / 100) < 1e-6 && Math.abs(a.My) < 1e-9);
  }
});

test('curva simétrica e maior com mais armadura', () => {
  const pequena = curvaInteracao(500, secao(12.5, 6), c, s).pontos;
  const grande = curvaInteracao(500, secao(16, 6), c, s).pontos;
  for (const [mx, my] of [[1, 0], [0, 1], [1, 1], [-1, 1], [1, -0.3]]) {
    assert.ok(resistenciaNaDirecao(grande, mx, my).MRd > resistenciaNaDirecao(pequena, mx, my).MRd);
  }
  const a = resistenciaNaDirecao(grande, 1, 1).MRd, b = resistenciaNaDirecao(grande, -1, -1).MRd;
  assert.ok(Math.abs(a - b) / a < 0.02, 'simetria');
});

test('pontos sobre os eixos usam o MRd da flexão normal', () => {
  const v = verificarPontos([], [{ Mx: 10, My: 0 }, { Mx: 0, My: 20 }], { MRdx: 40, MRdy: 50 });
  assert.equal(v.pontos[0].uso, 0.25);
  assert.equal(v.pontos[1].uso, 0.4);
  assert.equal(envoltoriaMinima(10, 5, 4)[1].My.toFixed(6), '5.000000');
});

test('pilar com momentos nos dois eixos: curva, pontos e armadura maior que sem os momentos', () => {
  const p = criarProjeto();
  const base = { id: 'p', modulo: 'concreto.pilar', codigo: 'P1', nome: 'P1', ...MODULOS_CALCULO['concreto.pilar'].criar(p), bx: 20, by: 40, pesoProprio: false, cargas: [{ id: 'n', tipo: 'concentrada', natureza: 'g', valor: 500 }] };
  const so = calcularElemento({ ...base }, p, registro);
  const ob = calcularElemento({ ...base, momentos: { x: { A: 15, B: 0 }, y: { A: 25, B: 0 } } }, p, registro);
  assert.ok(so.armadura.curva.length > 40);
  assert.equal(so.armadura.obliqua.pontos.length, 0, 'sem momentos: só a envoltória mínima');
  assert.equal(ob.armadura.obliqua.pontos.length, 2);
  assert.ok(ob.armadura.As >= so.armadura.As);
  assert.ok(ob.armadura.obliqua.usoMax <= 1);
  assert.ok(ob.verificacoes.some((v) => v.nome.startsWith('Flexão oblíqua')));
});
