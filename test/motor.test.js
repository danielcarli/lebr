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
 * Testes do motor de cálculo contra soluções clássicas.
 * Executar com:  npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { concreto, aco } from '../src/engine/materiais.js';
import { dimensionarFlexao } from '../src/engine/flexao.js';
import { dimensionarEstribos } from '../src/engine/cisalhamento.js';
import { analisarViga } from '../src/engine/viga-solver.js';
import { analisarPlaca, areasDeInfluencia } from '../src/engine/placa.js';
import { dimensionarPilar, momentoResistente } from '../src/engine/flexocompressao.js';

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg}: ${a} ≠ ${b} (±${tol * 100}%)`);
const C25 = concreto(25), C50 = concreto(50), CA50 = aco(500);

test('materiais: C25 e ηc da NBR 6118:2023', () => {
  perto(C25.fctm, 2.565, 0.01, 'fctm');
  perto(C25.Eci, 28000, 0.001, 'Eci');
  perto(C25.Ecs, 24150, 0.001, 'Ecs');
  assert.equal(C25.etaC, 1);
  perto(C50.etaC, Math.cbrt(40 / 50), 1e-9, 'ηc C50');
});

test('viga biapoiada com carga uniforme', () => {
  const EI = 20000;
  const r = analisarViga({ vaos: [5], apoios: ['apoio', 'apoio'], q: [10], P: [], EI: [EI] });
  perto(r.vaos[0].Mpos, 31.25, 0.001, 'M = qL²/8');
  perto(r.reacoes[0].V, 25, 1e-6, 'R = qL/2');
  perto(r.vaos[0].flecha, (5 * 10 * 5 ** 4) / (384 * EI), 0.001, 'flecha 5qL⁴/384EI');
});

test('viga contínua de dois vãos iguais', () => {
  const r = analisarViga({ vaos: [4, 4], apoios: ['apoio', 'apoio', 'apoio'], q: [10, 10], P: [], EI: [1e4, 1e4] });
  perto(r.vaos[0].Mneg, -20, 0.001, 'M apoio = −qL²/8');
  perto(r.vaos[0].Mpos, (9 / 128) * 10 * 16, 0.002, 'M vão = 9qL²/128');
  perto(r.reacoes[1].V, 50, 1e-6, 'R central = 1,25 qL');
});

test('balanço com carga concentrada na ponta', () => {
  const r = analisarViga({ vaos: [2], apoios: ['engaste', 'livre'], q: [5], P: [{ vao: 0, x: 2, P: 10 }], EI: [1e4] });
  perto(r.vaos[0].Mneg, -30, 0.001, 'M engaste');
  perto(r.reacoes[0].V, 20, 1e-6, 'R engaste');
});

test('placa quadrada simplesmente apoiada (ν = 0,3) — Timoshenko', () => {
  const b = { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' };
  const r = analisarPlaca({ lx: 1, ly: 1, bordas: b, nu: 0.3, divisoes: 30 });
  perto(r.coef.mxPos, 0.0479, 0.02, 'Mx centro');
  perto(r.coef.w, 0.00406, 0.02, 'w centro');
});

test('placa quadrada engastada (ν = 0,3) — Timoshenko', () => {
  const b = { x0: 'engastada', x1: 'engastada', y0: 'engastada', y1: 'engastada' };
  const r = analisarPlaca({ lx: 1, ly: 1, bordas: b, nu: 0.3, divisoes: 30 });
  perto(r.coef.mxPos, 0.0231, 0.04, 'Mx centro');
  perto(r.coef.mxNeg, -0.0513, 0.05, 'Mx borda');
  perto(r.coef.w, 0.00126, 0.03, 'w centro');
});

test('áreas de influência: laje quadrada apoiada divide a carga igualmente', () => {
  const r = areasDeInfluencia({ lx: 4, ly: 4, bordas: { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' } });
  for (const k of ['x0', 'x1', 'y0', 'y1']) perto(r.area[k], 4, 0.01, `área ${k}`);
});

test('flexão simples: 20×50, Md = 100 kN·m, C25/CA-50', () => {
  const r = dimensionarFlexao({ Md: 100, b: 20, h: 50, d: 45, c: C25, s: CA50 });
  perto(r.As, 5.61, 0.01, 'As');
  assert.equal(r.dupla, false);
  assert.equal(r.dominio, '2'); // ξ = 0,223 < ξ23 = 0,259
});

test('flexão: armadura dupla quando x/d > 0,45', () => {
  const r = dimensionarFlexao({ Md: 260, b: 20, h: 50, d: 45, dl: 4, c: C25, s: CA50 });
  assert.equal(r.dupla, true);
  assert.ok(r.Asl > 0);
});

test('cisalhamento: VRd2 e Vc para 20×50, C25', () => {
  const r = dimensionarEstribos({ Vd: 150, bw: 20, d: 45, c: C25, s: CA50 });
  perto(r.VRd2, 0.27 * 0.9 * (25 / 1.4 / 10) * 20 * 45, 1e-9, 'VRd2');
  assert.ok(r.estribo.s <= r.sMax);
});

test('pilar: compressão centrada não ultrapassa a resistência da seção', () => {
  const sec = { b: 20, h: 40, barras: [{ y: 4, A: 2 }, { y: 36, A: 2 }] };
  const { Nmax } = momentoResistente(0, sec, C25, CA50);
  const esperado = (C25.sigmaCd / 10) * 800 + 4 * Math.min(21000 * 0.002, 43.48);
  perto(Nmax, esperado, 0.01, 'Nmax');
});

test('pilar 20×40 com Nd = 1000 kN encontra arranjo', () => {
  const r = dimensionarPilar({ bx: 20, by: 40, lex: 280, ley: 280, Nd: 1000, cob: 3, c: C25, s: CA50 });
  assert.ok(r.escolha, r.avisos.join(' '));
  assert.ok(r.escolha.As >= r.AsMin);
  assert.ok(r.dirX.segundaOrdem, 'λx = 48 deve exigir 2ª ordem');
});
