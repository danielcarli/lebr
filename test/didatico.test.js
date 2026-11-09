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
/** Módulo Aprender: as contas das lições batem com as fórmulas de livro e com os módulos de cálculo. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esforcosViga, flechaElastica, flexaoSecao, momentoLimite, esbeltezPilar, direcoesLaje } from '../src/engine/didatico.js';
import { vigaDidatica, lajeDidatica, pilarDidatico, resumoLista } from '../src/modules/comum/didatico-elementos.js';
import { LICOES } from '../src/renderer/views/aprender-licoes.js';

const perto = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} ≠ ${b}`);

test('viga: qL²/8, qL²/2 e qL²/12 e 24; reações e cortante máximo', () => {
  const L = 6, q = 10;
  const bi = esforcosViga('biapoiada', L, q);
  perto(bi.Mmax, (q * L * L) / 8, 'M biapoiada');
  perto(bi.Vmax, (q * L) / 2, 'V biapoiada');
  assert.deepEqual(bi.reacoes.map((r) => r.R), [30, 30]);
  const ba = esforcosViga('balanco', L, q);
  perto(ba.Mmin, -(q * L * L) / 2, 'M balanço');
  perto(ba.Vmax, q * L, 'V balanço');
  const be = esforcosViga('biengastada', L, q);
  perto(be.Mmin, -(q * L * L) / 12, 'M engaste');
  perto(be.Mmax, (q * L * L) / 24, 'M vão');
  // forma da deformada: máximo 1, nula nos apoios
  assert.equal(Math.max(...bi.forma), 1);
  perto(bi.forma[0], 0, 'apoio'); perto(bi.forma.at(-1), 0, 'apoio');
  perto(ba.forma.at(-1), 1, 'ponta do balanço');
  // flecha: 5qL⁴/384EI
  const f = flechaElastica('biapoiada', 5, 10, 20, 50, 25000);
  perto(f, (5 * 10 * 5 ** 4) / (384 * 25000e3 * (0.2 * 0.5 ** 3) / 12) * 100, 'flecha', 1e-9);
});

test('flexão: domínios 2, 3 e 4, equilíbrio Rc = Rs e Md = Rc·z', () => {
  const sec = { b: 20, h: 50, fck: 25 };
  const d2 = flexaoSecao({ ...sec, Md: 40 });
  assert.equal(d2.dominio, 2);
  perto(d2.epsS, 10, 'εs no domínio 2');
  const d3 = flexaoSecao({ ...sec, Md: 150 });
  assert.equal(d3.dominio, 3);
  perto(d3.epsC, 3.5, 'εc no domínio 3');
  for (const r of [d2, d3]) {
    perto(r.Rc, r.Rs, 'Rc = Rs', 1e-9);
    perto((r.Rc * r.z) / 100, r === d2 ? 40 : 150, 'Md = Rc·z', 1e-9);
  }
  // conta de livro: K = Md/(b·d²·fcd), ξ da equação do 2º grau
  const fcd = 25 / 1.4 / 10, d = 46, K = 15000 / (20 * d * d * fcd);
  perto(d3.xi, (0.68 - Math.sqrt(0.68 ** 2 - 4 * 0.272 * K)) / 0.544, 'ξ');
  assert.equal(flexaoSecao({ ...sec, Md: 260 }).dominio, 4);
  assert.equal(flexaoSecao({ ...sec, Md: 400 }).ok, false);
  // momentoLimite dá x/d = 0,45
  perto(flexaoSecao({ ...sec, Md: momentoLimite(sec) }).xi, 0.45, 'ξ limite', 1e-6);
});

test('pilar: λ = le·√12/h, λ1 entre 35 e 90 e a classe', () => {
  const p = esbeltezPilar({ h: 20, le: 2.8 });
  perto(p.lambda, 280 * Math.sqrt(12) / 20, 'λ');
  assert.equal(p.lambda1, 35);
  assert.equal(p.classe, 'medianamente esbelto');
  assert.equal(esbeltezPilar({ h: 40, le: 2.8 }).classe, 'curto');
  assert.equal(esbeltezPilar({ h: 15, le: 6 }).classe, 'esbelto');
});

test('laje: λ = ly/lx; acima de 2, uma direção', () => {
  assert.equal(direcoesLaje(4, 5).umaDirecao, false);
  assert.equal(direcoesLaje(2, 5).umaDirecao, true);
  const q = direcoesLaje(4, 4);
  perto(q.kCurto, 0.5, 'quadrada divide meio a meio');
});

test('elementos das lições: viga, laje e pilar calculados pelos módulos, com lista de ferros e modelo 3D', () => {
  for (const tipo of ['biapoiada', 'balanco', 'biengastada']) {
    const v = vigaDidatica({ tipo, L: tipo === 'balanco' ? 2 : 5 });
    assert.ok(v.res.ok, `${tipo}: ${v.res.erro ?? ''}`);
    assert.ok(v.posicoes.some((p) => p.tipo === 'estribo'), tipo);
    assert.ok(v.modelo.barras.length > 0 && v.modelo.caixas.length > 0, tipo);
    assert.ok(resumoLista(v.posicoes).massa > 0);
  }
  // a viga da lição usa o fck pedido
  assert.notDeepEqual(vigaDidatica({ fck: 40 }).res.vaos[0].positiva, vigaDidatica({ fck: 20 }).res.vaos[0].positiva);
  const l = lajeDidatica({});
  assert.ok(!l.res.erro && l.modelo.barras.length > 0);
  const p = pilarDidatico({});
  assert.ok(!p.res.erro && p.modelo.barras.length > 0);
  assert.ok(p.res.armadura.curva.length > 10, 'envoltória de momentos resistentes');
});

test('lições: identificador único, título, objetivo, passos e explicação de todo gráfico', () => {
  const ids = new Set();
  assert.ok(LICOES.length >= 6);
  for (const l of LICOES) {
    assert.ok(!ids.has(l.id), l.id); ids.add(l.id);
    assert.ok(l.titulo && l.objetivo && l.passos?.length, l.id);
    for (const g of l.graficos ?? []) assert.ok(g.titulo && g.paraQueServe && g.comoLer, `${l.id}: ${g.id}`);
    assert.ok(l.antes && l.naPratica?.arquitetura && l.naPratica?.engenharia && l.formulas?.length >= 3 && l.erros?.length >= 2 && l.pergunta && l.resposta && l.norma?.length >= 2, `${l.id}: blocos didáticos`);
    for (const p of l.passos) assert.ok(typeof p === 'string' || (p.faca && p.observe), `${l.id}: passo`);
  }
});
