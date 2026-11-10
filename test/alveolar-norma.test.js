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
/** Laje alveolar (0.69): flechas da Tabela 13.3, apoio mínimo e a vista 3D dos painéis. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { contextoCalculo } from '../src/renderer/core/calculo.js';
import * as alv from '../src/modules/concreto-laje-alveolar/calculo.js';
import { modeloAlveolar } from '../src/modules/comum/armadura3d.js';

const registro = { obter: () => null };
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b}`);
const ctx = () => contextoCalculo(criarProjeto(), registro);
const v = (r, inicio) => r.verificacoes.find((x) => x.nome.startsWith(inicio));

test('alveolar: flecha final = (1 + φ)·f(cargas após a montagem) − contraflecha, limitada a L/350, contra L/250', () => {
  const c = ctx();
  const el = alv.criarLajeAlveolar();
  const r = alv.calcularLajeAlveolar(el, c);
  // biapoiada: f = 5·w·L⁴/(384·EI)
  const w = r.cargas.g - r.cargas.painel + c.materiais.psi2 * r.cargas.q;
  const f0 = (5 * w * el.L ** 4) / (384 * el.painel.EI) * 1000;
  perto(r.flecha.sobreposta, f0, 0.02, 'flecha imediata');
  perto(r.flecha.final, 3 * f0, 0.05, 'φ = 2, sem contraflecha');
  perto(r.flecha.limFinal, 7000 / 250, 1e-9, 'L/250');
  // contraflecha de 30 mm: só L/350 = 20 mm é descontado
  const rc = alv.calcularLajeAlveolar({ ...el, painel: { ...el.painel, contraflecha: 30 } }, c);
  perto(rc.flecha.contraflecha, 20, 1e-9, 'contraflecha limitada');
  perto(rc.flecha.final, 3 * f0 - 20, 0.05, 'desconto');
  // painel mole: não atende L/250
  const mole = alv.calcularLajeAlveolar({ ...el, painel: { ...el.painel, EI: 6000 } }, c);
  assert.equal(v(mole, 'Aceitabilidade').ok, false);
});

test('alveolar: paredes pedem L/500 e 10 mm; apoio mínimo de 10 cm até h 20 e 15 cm acima', () => {
  const c = ctx();
  const el = alv.criarLajeAlveolar();
  assert.equal(v(alv.calcularLajeAlveolar(el, c), 'Paredes'), undefined);
  const comParede = alv.calcularLajeAlveolar({ ...el, cargas: { ...el.cargas, paredes: 2 } }, c);
  const p = v(comParede, 'Paredes');
  assert.ok(p); perto(comParede.flecha.limParede, 10, 1e-9, 'min(L/500 = 14; 10)');
  assert.equal(alv.apoioMinimo(20), 10); assert.equal(alv.apoioMinimo(26.5), 15);
  assert.equal(v(alv.calcularLajeAlveolar({ ...el, apoio: 8 }, c), 'Comprimento de apoio').ok, false);
  assert.equal(v(alv.calcularLajeAlveolar({ ...el, painel: { ...el.painel, h: 26.5 }, apoio: 12 }, c), 'Comprimento de apoio').ok, false);
  assert.ok(v(alv.calcularLajeAlveolar(el, c), 'Comprimento de apoio').ok);
});

test('alveolar 3D: painéis com alvéolos, o último cortado, chavetas, capa, cordoalhas e apoios', () => {
  const el = { ...alv.criarLajeAlveolar(), largura: 4.6 };   // 3 painéis de 125 + 1 de 85 cm
  const m = modeloAlveolar(el);
  const pain = m.caixas.filter((c) => c.parte === 'painel');
  assert.equal(pain.length, 4);
  assert.equal(pain[0].furos.length, 6);
  assert.ok(pain[3].furos.length < 6 && pain[3].furos.length > 0, 'painel cortado com menos alvéolos');
  for (const p of pain) for (const f of p.furos) assert.ok(f.y - f.r >= 1 && f.y + f.r <= p.max[1] - p.min[1] - 1 && f.z - f.r > 0 && f.z + f.r < el.painel.h, 'furo dentro do painel');
  assert.equal(m.caixas.filter((c) => c.parte === 'chaveta').length, 3);
  assert.equal(m.caixas.filter((c) => c.parte === 'capa').length, 1);
  assert.equal(m.caixas.filter((c) => c.parte === 'apoio').length, 2);
  assert.equal(m.barras.filter((b) => b.tipo === 'protensão').length, 3 * 7 + m.barras.filter((b, i) => i >= 21).length);
  // balanço: só um apoio
  const bal = modeloAlveolar({ ...el, bordas: { ...el.bordas, x1: 'livre', x0: 'engastada' } });
  assert.equal(bal.caixas.filter((c) => c.parte === 'apoio').length, 1);
});
