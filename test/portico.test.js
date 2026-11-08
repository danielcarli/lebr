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
/** Pórtico espacial (engine/portico.js): conferências que não estão no banco de validação. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisarPortico, ModeloPortico, exemploPortico, eixosLocais, propriedadesSecao, restricoesDe } from '../src/engine/portico.js';
import { analisarViga } from '../src/engine/viga-solver.js';

const E = 2e7;
const perto = (a, b, tol = 1e-6, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg ?? ''} ${a} ≠ ${b}`);

test('eixos locais: viga com y vertical, pilar com y = X, ângulo gira a seção', () => {
  const v = eixosLocais([0, 0, 0], [4, 0, 0]);
  assert.deepEqual(v.R[1], [0, 0, 1]);
  assert.deepEqual(v.R[2].map((c) => c + 0), [0, -1, 0]);
  const p = eixosLocais([0, 0, 0], [0, 0, 3]);
  assert.deepEqual(p.R[1], [1, 0, 0]);
  assert.deepEqual(p.R[2], [0, 1, 0]);
  const g = eixosLocais([0, 0, 0], [4, 0, 0], 90);
  perto(g.R[1][1], -1); perto(g.R[1][2], 0);
});

test('restrições e seções', () => {
  assert.deepEqual(restricoesDe('engaste'), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(restricoesDe('apoio'), [1, 1, 1, 0, 0, 0]);
  assert.deepEqual(restricoesDe('001000'), [0, 0, 1, 0, 0, 0]);
  assert.throws(() => restricoesDe('xyz'));
  const s = propriedadesSecao([20, 40]);
  perto(s.Iz, 0.2 * 0.4 ** 3 / 12); perto(s.Iy, 0.4 * 0.2 ** 3 / 12);
});

test('confere com o solver de vigas contínuas (3 vãos, cargas diferentes)', () => {
  const vaos = [4, 5.5, 3], q = [12, 8, 15], EI = E * (0.2 * 0.5 ** 3 / 12);
  const v = analisarViga({ vaos, apoios: ['engaste', 'apoio', 'apoio', 'apoio'], q, P: [], EI: vaos.map(() => EI) });
  const xs = [0, 4, 9.5, 12.5];
  const r = analisarPortico({
    tipo: 'plano-xz', material: { E }, secao: [20, 50],
    nos: xs.map((x, k) => ({ id: `N${k}`, x, apoio: k === 0 ? 'engaste' : '011000' })),
    barras: vaos.map((_, k) => ({ id: `V${k}`, i: `N${k}`, j: `N${k + 1}`, q: { Z: -q[k] } })),
  });
  v.vaos.forEach((vv, k) => {
    perto(r.barra(`V${k}`).max.Mz.max, vv.Mpos, 1e-3, `M+ vão ${k}`);
    perto(Math.min(r.barra(`V${k}`).i.Mz, r.barra(`V${k}`).j.Mz), vv.Mneg, 1e-3, `M− vão ${k}`);
  });
  const somaR = r.reacoes.reduce((s, x) => s + x.R[2], 0);
  perto(somaR, 12 * 4 + 8 * 5.5 + 15 * 3, 1e-9);
});

test('carga concentrada no vão e cargas em eixos locais', () => {
  const r = analisarPortico({
    tipo: 'plano-xz', material: { E }, secao: [20, 40],
    nos: [{ id: 'A', apoio: 'apoio' }, { id: 'B', x: 5, apoio: '011000' }],
    barras: [{ id: 'b', i: 'A', j: 'B', cargas: [{ tipo: 'P', dir: 'y', valor: -20, a: 2 }] }],
  });
  perto(r.barra('b').max.Mz.max, (20 * 2 * 3) / 5); // P·a·b/L
  perto(r.reacao('A').Fz, 12); perto(r.reacao('B').Fz, 8);
  perto(r.barra('b', 1).Mz, 12 * 1);
  perto(r.barra('b', 4).Vy, -8);
});

test('barra inclinada: equilíbrio e momento de uma biapoiada', () => {
  // barra a 45° no plano XZ, biapoiada (A rotulado, B com apoio deslizante em X), q = 10 kN/m vertical por metro de barra
  const L = 4 * Math.SQRT2;
  const r = analisarPortico({
    tipo: 'plano-xz', material: { E }, secao: [20, 40],
    nos: [{ id: 'A', apoio: 'apoio' }, { id: 'B', x: 4, z: 4, apoio: '011000' }],
    barras: [{ id: 'b', i: 'A', j: 'B', q: { Z: -10 } }],
  });
  assert.ok(r.equilibrio.erro < 1e-9);
  perto(r.reacao('A').Fz + r.reacao('B').Fz, 10 * L);
  // componente transversal q·cos 45°, momento máximo = q⊥·L²/8
  perto(r.barra('b').max.Mz.max, (10 * Math.SQRT1_2 * L * L) / 8, 1e-6);
});

test('apoio elástico (mola) e combinação de casos', () => {
  const k = 5000; // kN/m
  // barra muito rígida: rótula em A, mola vertical em B, carga no meio → a mola recebe P/2
  const r = analisarPortico({
    tipo: 'plano-xz', material: { E: 1e12 }, secao: [20, 40],
    nos: [{ id: 'A', apoio: 'apoio' }, { id: 'M', x: 3 }, { id: 'B', x: 6, apoio: '010000', molas: [0, 0, k, 0, 0, 0] }],
    barras: [{ id: 'b1', i: 'A', j: 'M' }, { id: 'b2', i: 'M', j: 'B' }],
    cargas: [{ no: 'M', Fz: -10, caso: 'G' }, { no: 'M', Fz: -4, caso: 'Q' }],
  });
  assert.deepEqual(r.casos, ['G', 'Q']);
  perto(r.porCaso.G.deslocamentos.find((d) => d.id === 'B').u[2], -5 / k, 1e-6);
  perto(r.porCaso.G.reacoes.find((x) => x.id === 'A').R[2], 5, 1e-6);
  const c = r.combinar({ G: 1.4, Q: 1.4 });
  perto(c.equilibrio.cargas[2], -1.4 * 14, 1e-9);
  perto(c.deslocamentos.find((d) => d.id === 'B').u[2], (-1.4 * 7) / k, 1e-6);
  perto(r.no('B').uz, -7 / k, 1e-6);
  perto(r.reacao('B').Fz, 7, 1e-6);
  assert.ok(r.equilibrio.erro < 1e-9);
});

test('treliça rotulada: nós sem rigidez à rotação são restringidos com aviso', () => {
  const r = analisarPortico({
    tipo: 'plano-xz', material: { E: 2e8 },
    nos: [{ id: 'A', apoio: 'apoio' }, { id: 'B', x: 4, apoio: 'apoio' }, { id: 'C', x: 2, z: 2 }],
    barras: [{ id: 'a', i: 'A', j: 'C', secao: [10, 10], rotula: 'ambas' }, { id: 'b', i: 'B', j: 'C', secao: [10, 10], rotula: 'ambas' }],
    cargas: [{ no: 'C', Fz: -10 }],
  });
  assert.ok(r.avisos.some((a) => a.includes('sem rigidez')));
  perto(r.barra('a').i.N, -10 / 2 / Math.SQRT1_2);
  perto(r.barra('a').max.Mz.max, 0, 1e-9);
});

test('mecanismos e erros de entrada', () => {
  assert.throws(() => analisarPortico({ nos: [{ id: 'A', apoio: 'apoio' }, { id: 'B', x: 3 }], barras: [{ id: 'a', i: 'A', j: 'B', secao: [20, 40] }] }), /hipostática/);
  assert.throws(() => analisarPortico({ nos: [{ id: 'A', apoio: 'engaste' }, { id: 'B', x: 3 }], barras: [{ id: 'a', i: 'A', j: 'B', secao: [20, 40], liberar: { i: ['T'], j: ['T'] } }] }), /mecanismo/);
  assert.throws(() => analisarPortico({ nos: [{ id: 'A' }, { id: 'B', x: 3 }], barras: [{ id: 'a', i: 'A', j: 'X', secao: [20, 40] }] }), /não existe/);
  assert.throws(() => analisarPortico({ nos: [{ id: 'A' }, { id: 'A', x: 3 }], barras: [] }), /repetido/);
  assert.throws(() => analisarPortico({ nos: [{ id: 'A', apoio: 'engaste' }, { id: 'B', x: 3 }], barras: [{ id: 'a', i: 'A', j: 'B' }] }), /Seção/);
});

test('edifício em grade 4 × 4 × 5 pavimentos: resolve, banda pequena e equilíbrio', () => {
  const m = new ModeloPortico({ material: { fck: 30 }, pesoProprio: true });
  const id = (i, j, k) => `N${i}${j}${k}`;
  for (let k = 0; k <= 5; k++) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) m.no(id(i, j, k), i * 5, j * 4, k * 3, k === 0 ? 'engaste' : null);
  for (let k = 1; k <= 5; k++) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    m.barra(`P${i}${j}${k}`, id(i, j, k - 1), id(i, j, k), { secao: [30, 30] });
    if (i < 3) m.barra(`VX${i}${j}${k}`, id(i, j, k), id(i + 1, j, k), { secao: [20, 50], q: { Z: -15 }, caso: 'G' });
    if (j < 3) m.barra(`VY${i}${j}${k}`, id(i, j, k), id(i, j + 1, k), { secao: [20, 50], q: { Z: -15 }, caso: 'G' });
    m.carga(id(0, 0, k), { Fx: 5, Fy: 3 }, 'V');
  }
  const t0 = Date.now();
  const r = m.resolver();
  assert.ok(Date.now() - t0 < 5000);
  assert.equal(r.resumo.equacoes, 16 * 5 * 6);
  assert.ok(r.resumo.banda < 200, `banda ${r.resumo.banda}`);
  for (const c of r.casos) assert.ok(r.porCaso[c].equilibrio.erro < 1e-8, c);
  assert.ok(r.no(id(0, 0, 5)).ux > 0);
});

test('modelo do console e texto do resultado', () => {
  const r = exemploPortico().resolver();
  const txt = r[Symbol.for('lebr.console')]();
  assert.match(txt, /DESLOCAMENTOS DOS NÓS/);
  assert.match(txt, /REAÇÕES DE APOIO/);
  assert.match(txt, /ESFORÇOS NAS BARRAS/);
  assert.match(txt, /Equilíbrio: .*✓/);
  // vento a 8 kN: soma das reações horizontais = −8
  perto(r.porCaso.V.equilibrio.reacoes[0], -8, 1e-9);
  // vertical: simétrico, reações iguais a 36 kN
  perto(r.porCaso.G.reacoes[0].R[2], 36, 1e-9);
  assert.throws(() => r.combinar({ X: 1 }), /não existe/);
});
