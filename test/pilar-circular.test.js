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
/**
 * Pilar de seção circular (0.33) e as vistas 3D da armadura seguindo os espaçamentos da norma.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { criarProjeto } from '../src/renderer/core/projeto.js';
import { contextoCalculo } from '../src/renderer/core/calculo.js';
import * as pilar from '../src/modules/concreto-pilar/calculo.js';
import * as viga from '../src/modules/concreto-viga/calculo.js';
import { dimensionarPilarCircular } from '../src/engine/flexocompressao.js';
import { propriedadesSecao } from '../src/engine/portico.js';
import { detalhamentoPilar } from '../src/modules/comum/detalhamento.js';
import { aplicarEdicoes } from '../src/engine/detalhamento.js';
import { modeloPilar, modeloViga, eixoEstriboRetangular, livreHorizontal, livreVertical } from '../src/modules/comum/armadura3d.js';

const registro = {
  mods: {
    'concreto.viga': { calcular: viga.calcularViga, cargasTransmitidas: viga.cargasTransmitidas },
    'concreto.pilar': { calcular: pilar.calcularPilar, cargasTransmitidas: pilar.cargasTransmitidas },
  },
  obter(id) { return this.mods[id]; },
};
const ctx = () => contextoCalculo(criarProjeto(), registro);
const circular = (D, extra = {}) => ({ ...pilar.criarPilar(), forma: 'circular', D, bx: D, by: D, ...extra });

test('pilar circular: área πD²/4, i = D/4 (λ = 4·le/D), no mínimo 6 barras e simetria MRdx = MRdy', () => {
  const r = pilar.calcularPilar(circular(30), ctx());
  assert.ok(r.armadura, 'tem arranjo');
  assert.equal(r.armadura.forma, 'circular');
  assert.ok(r.armadura.n >= 6);
  const le = pilar.criarPilar().comprimento * 100;
  assert.ok(Math.abs(r.dirX.lambda - (4 * le) / 30) < 0.2, `λ = ${r.dirX.lambda}`);
  assert.ok(Math.abs(r.armadura.MRdx - r.armadura.MRdy) / r.armadura.MRdx < 0.03);
  // barras no círculo de raio R, igualmente espaçadas
  const R = r.armadura.raio, c = 15;
  for (const p of r.armadura.pontos) assert.ok(Math.abs(Math.hypot(p.x - c, p.y - c) - R) < 0.05);
  const v = r.verificacoes.find((x) => x.nome === 'Número de barras (seção circular)');
  assert.ok(v?.ok);
  assert.ok(r.verificacoes.find((x) => x.nome === 'Espaçamento entre as barras')?.ok);
});

test('pilar circular: espaçamento entre eixos ≤ mín(2D; 40 cm) e livre ≥ máx(2 cm; ø; 1,2·dmax)', () => {
  const mat = ctx().materiais;
  const r = dimensionarPilarCircular({ D: 80, lex: 300, ley: 300, Nd: 5000, Mx: { A: 50, B: -50 }, My: {}, cob: 3, dmax: 19, c: mat.concreto, s: mat.aco });
  const e = r.escolha;
  assert.ok(e, 'arranjo');
  const corda = 2 * e.raio * Math.sin(Math.PI / e.n);
  assert.ok(corda <= 40 + 1e-9, `corda ${corda}`);
  assert.ok(corda - e.phi / 10 >= Math.max(2, e.phi / 10, 2.28) - 1e-9);
});

test('pórtico: propriedades da seção circular', () => {
  const p = propriedadesSecao({ D: 40 });
  assert.ok(Math.abs(p.A - (Math.PI * 0.4 ** 2) / 4) < 1e-9 || Math.abs(p.A - (Math.PI * 40 ** 2) / 4) < 1e-6);
});

test('estribo retangular 3D: contorna as barras de canto e fecha com dois ganchos de 135° para dentro', () => {
  const r = 0.8, eixo = eixoEstriboRetangular(4, 4, 21, 36, r, 5, 3);
  // todos os pontos do eixo ficam a r das barras de canto ou além, sem sair da caixa do estribo
  for (const [u, v] of eixo) {
    assert.ok(u >= 4 - r - 1e-6 && u <= 21 + r + 1e-6 && v >= 4 - r - 1e-6 && v <= 36 + r + 1e-6);
  }
  const ini = eixo[0], fim = eixo.at(-1);
  // as pontas dos ganchos apontam para o núcleo (dentro do retângulo dos centros das barras)
  for (const p of [ini, fim]) assert.ok(p[0] > 4 && p[0] < 21 && p[1] > 4 && p[1] < 36, `ponta ${p}`);
  // ponta reta ≥ 5 cm
  const d = Math.hypot(eixo[1][0] - ini[0], eixo[1][1] - ini[1]);
  assert.ok(d >= 5 - 1e-6);
});

test('armadura 3D do pilar: barras nos pontos do cálculo, estribos e grampos no mesmo nível', () => {
  const c = ctx();
  const el = { ...pilar.criarPilar(), bx: 25, by: 60 };
  el.resultado = pilar.calcularPilar(el, c);
  const det = detalhamentoPilar(el, el.resultado, c.projeto ?? criarProjeto());
  const m = modeloPilar(el, det, det.posicoes, { pontos: el.resultado.armadura.pontos, cob: el.resultado.armadura.cobrimento });
  const longs = m.barras.filter((b) => b.tipo === 'longitudinal');
  assert.equal(longs.length, el.resultado.armadura.pontos.length);
  const zEst = new Set(m.barras.filter((b) => b.tipo === 'estribo').map((b) => Math.round(b.pts[0][2])));
  for (const g of m.barras.filter((b) => b.tipo === 'suplementar')) assert.ok(zEst.has(Math.round(g.pts[0][2] - 0.5)) || zEst.has(Math.round(g.pts[0][2])), 'grampo no nível de um estribo');
  assert.ok(m.info.espacamento <= Math.min(2 * 25, 40) + 1e-6);
  assert.ok(m.legenda.includes('18.4.2.2'));
});

test('armadura 3D do pilar circular: concreto cilíndrico e estribos circulares', () => {
  const c = ctx();
  const el = circular(40);
  el.resultado = pilar.calcularPilar(el, c);
  const det = detalhamentoPilar(el, el.resultado, criarProjeto());
  const m = modeloPilar(el, det, det.posicoes, { pontos: el.resultado.armadura.pontos, cob: el.resultado.armadura.cobrimento });
  assert.equal(m.caixas[0].forma, 'cilindro');
  const est = m.barras.find((b) => b.tipo === 'estribo');
  const R = Math.hypot(est.pts[5][0] - 20, est.pts[5][1] - 20);
  assert.ok(R > 15 && R < 20);
  assert.ok(!m.barras.some((b) => b.tipo === 'suplementar'));
});

test('armadura 3D da viga: espaçamento livre horizontal ≥ ah e camadas separadas por av', () => {
  const c = ctx();
  const el = { ...viga.criarViga(), secao: { b: 14, h: 40 } };
  el.cargas = [{ id: 'q', tipo: 'distribuida', natureza: 'g', valor: 30 }];
  el.resultado = viga.calcularViga(el, c);
  const det = el.resultado.detalhamento;
  const m = modeloViga(el, det, aplicarEdicoes(det.posicoes, {}), { cob: 3, dmax: 19 });
  const inf = m.barras.filter((b) => ['positiva', 'construtiva'].includes(b.tipo));
  assert.ok(inf.length >= 2);
  // na seção do meio do vão, as barras inferiores não se atropelam
  const xm = (det.limites[0] + det.limites[1]) * 50;
  const noMeio = inf.filter((b) => b.pts.some((p) => p[0] <= xm) && b.pts.some((p) => p[0] >= xm));
  for (let i = 0; i < noMeio.length; i++) for (let j = i + 1; j < noMeio.length; j++) {
    const [a, b] = [noMeio[i], noMeio[j]];
    const ya = a.pts.find((p) => Math.abs(p[0] - xm) < 1e9)[1], yb = b.pts.find((p) => Math.abs(p[0] - xm) < 1e9)[1];
    const za = a.pts[a.pts.length > 2 && a.pts[0][2] !== a.pts[1][2] ? 1 : 0][2], zb = b.pts[b.pts.length > 2 && b.pts[0][2] !== b.pts[1][2] ? 1 : 0][2];
    const livreH = Math.abs(ya - yb) - (a.phi + b.phi) / 20, livreV = Math.abs(za - zb) - (a.phi + b.phi) / 20;
    assert.ok(livreH >= livreHorizontal(Math.max(a.phi, b.phi), 19) - 0.05 || livreV >= livreVertical(Math.max(a.phi, b.phi), 19) - 0.05, `barras ${i},${j}: livre h ${livreH}, v ${livreV}`);
  }
  // estribos com ganchos: o eixo tem mais de 5 pontos (arcos nos cantos)
  assert.ok(m.barras.find((b) => b.tipo === 'estribo').pts.length > 10);
});
