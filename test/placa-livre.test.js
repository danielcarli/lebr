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
/**
 * Placa por elementos finitos com bordas livres e laje maciça em balanço.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analisarPlaca, placaEstavel } from '../src/engine/placa.js';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { contextoCalculo } from '../src/renderer/core/calculo.js';
import * as laje from '../src/modules/concreto-laje-macica/calculo.js';

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg}: ${a} ≠ ${b} (±${tol * 100}%)`);
const B = (x0, x1, y0, y1) => ({ x0, x1, y0, y1 });

test('placa em balanço com ν = 0 equivale à viga: w = qL⁴/8D, M = qL²/2', () => {
  const r = analisarPlaca({ lx: 1.5, ly: 3, bordas: B('engastada', 'livre', 'livre', 'livre'), nu: 0 });
  perto(r.unit.wMax, 1.5 ** 4 / 8, 0.002, 'flecha na ponta');
  perto(-r.unit.mxNeg, 1.5 ** 2 / 2, 0.002, 'momento no engaste');
  perto(r.reacoes.x0, 1.5, 1e-6, 'reação no engaste');
  assert.equal(r.reacoes.x1, 0);
  assert.ok(r.flechaMaxima.naBordaLivre);
});

test('duas bordas opostas apoiadas e duas livres (ν = 0): w = 5qL⁴/384D', () => {
  const r = analisarPlaca({ lx: 4, ly: 3, bordas: B('apoiada', 'apoiada', 'livre', 'livre'), nu: 0 });
  perto(r.unit.wMax, (5 * 4 ** 4) / 384, 0.002, 'flecha');
  perto(r.unit.mxPos, 2, 0.002, 'momento qL²/8');
});

test('três bordas apoiadas e uma livre, quadrada, ν = 0,3 — Timoshenko', () => {
  const r = analisarPlaca({ lx: 1, ly: 1, bordas: B('apoiada', 'apoiada', 'apoiada', 'livre'), nu: 0.3, divisoes: 30 });
  perto(r.coef.w, 0.01286, 0.01, 'flecha no meio da borda livre');
  perto(r.coef.mxPos, 0.112, 0.01, 'momento na borda livre');
  perto(r.totalReacoes, 1, 1e-6, 'equilíbrio');
});

test('vínculos insuficientes são rejeitados', () => {
  assert.equal(placaEstavel(B('apoiada', 'livre', 'livre', 'livre')), false);
  assert.equal(placaEstavel(B('engastada', 'livre', 'livre', 'livre')), true);
  assert.equal(placaEstavel(B('apoiada', 'livre', 'apoiada', 'livre')), true);
  assert.throws(() => analisarPlaca({ lx: 1, ly: 1, bordas: B('apoiada', 'livre', 'livre', 'livre') }), /instável/);
});

test('laje maciça em balanço: γn, espessura mínima, reação e ligações', () => {
  const p = criarProjeto();
  const ctx = contextoCalculo(p, { obter: () => null });
  const el = { ...laje.criarLaje(), lx: 1.5, ly: 4, h: 12, bordas: B('engastada', 'livre', 'livre', 'livre') };
  const r = laje.calcularLaje(el, ctx);
  assert.equal(r.balanco, true);
  perto(r.gn, 1.95 - 0.05 * 12, 1e-6, 'γn');
  assert.equal(r.verificacoes.find((v) => v.nome.startsWith('Espessura')).limite, '≥ 10 cm');
  perto(r.reacoes.find((x) => x.id === 'x0').d, r.cargas.pd * 1.5, 0.01, 'reação = pd·L');
  assert.deepEqual(laje.ligacoes(el).map((l) => l.id), ['x0']);
  const t = laje.cargasTransmitidas(el, ctx);
  assert.equal(t.x1.g, 0);
});

test('laje sem borda livre continua usando o processo das áreas', () => {
  const p = criarProjeto();
  const r = laje.calcularLaje(laje.criarLaje(), contextoCalculo(p, { obter: () => null }));
  assert.equal(r.metodoReacoes, 'areas');
  assert.equal(r.balanco, false);
});
