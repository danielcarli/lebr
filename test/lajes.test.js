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
 * Testes da seção T e dos módulos de laje treliçada, nervurada e alveolar.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { concreto, aco } from '../src/engine/materiais.js';
import { dimensionarFlexao } from '../src/engine/flexao.js';
import { propriedadesT, larguraColaborante, dimensionarFlexaoT, inerciaEstadioIIT } from '../src/engine/secao-t.js';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento, contextoCalculo } from '../src/renderer/core/calculo.js';
import * as trel from '../src/modules/concreto-laje-trelicada/calculo.js';
import * as nerv from '../src/modules/concreto-laje-nervurada/calculo.js';
import * as alv from '../src/modules/concreto-laje-alveolar/calculo.js';
import * as viga from '../src/modules/concreto-viga/calculo.js';

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg}: ${a} ≠ ${b} (±${tol * 100}%)`);
const C25 = concreto(25), CA50 = aco(500);

const registro = {
  mods: {
    'concreto.laje.trelicada': { calcular: trel.calcularLajeTrelicada, cargasTransmitidas: trel.cargasTransmitidas },
    'concreto.laje.nervurada': { calcular: nerv.calcularLajeNervurada, cargasTransmitidas: nerv.cargasTransmitidas },
    'concreto.laje.alveolar': { calcular: alv.calcularLajeAlveolar, cargasTransmitidas: alv.cargasTransmitidas },
    'concreto.viga': { calcular: viga.calcularViga, cargasTransmitidas: viga.cargasTransmitidas },
  },
  obter(id) { return this.mods[id]; },
};

test('seção T com bf = bw equivale à retangular', () => {
  const p = propriedadesT({ bf: 20, bw: 20, hf: 5, h: 50 });
  perto(p.I, (20 * 50 ** 3) / 12, 1e-9, 'I');
  perto(p.yTop, 25, 1e-9, 'centroide');
});

test('mesa colaborante limitada por 0,5·b2 e 0,1·a', () => {
  assert.equal(larguraColaborante({ bw: 10, e: 60, a: 6 }), 60);   // b1 = min(25, 60) = 25
  assert.equal(larguraColaborante({ bw: 10, e: 60, a: 1 }), 30);   // b1 = min(25, 10) = 10
});

test('flexão T com linha neutra na mesa = retangular de largura bf', () => {
  const t = dimensionarFlexaoT({ Md: 8, bf: 42, bw: 9, hf: 4, h: 16, d: 13, c: C25, s: CA50 });
  const r = dimensionarFlexao({ Md: 8, b: 42, h: 16, d: 13, c: C25, s: CA50 });
  assert.equal(t.comoT, false);
  perto(t.AsCalc, r.AsCalc, 1e-9, 'As');
});

test('flexão T com linha neutra na alma: As maior que o da retangular bf', () => {
  const t = dimensionarFlexaoT({ Md: 80, bf: 40, bw: 10, hf: 4, h: 30, d: 27, c: C25, s: CA50 });
  const r = dimensionarFlexao({ Md: 80, b: 40, h: 30, d: 27, c: C25, s: CA50 });
  assert.equal(t.comoT, true);
  assert.ok(t.AsCalc > r.AsCalc);
});

test('estádio II da seção T recai na retangular quando x ≤ hf', () => {
  const t = inerciaEstadioIIT({ bf: 42, bw: 9, hf: 4, d: 13, As: 1, ae: 8.7 });
  const x = (-8.7 + Math.sqrt(8.7 ** 2 + 2 * 42 * 8.7 * 13)) / 42;
  perto(t.x, x, 1e-9, 'x');
});

test('treliçada biapoiada: Md = pd·e·L²/8 e reações = p·L/2', () => {
  const p = criarProjeto();
  const el = { id: 'lt1', modulo: 'concreto.laje.trelicada', codigo: 'LT1', nome: 'LT1', ...trel.criarLajeTrelicada(), L: 3.5 };
  p.elementos.push(el);
  const r = calcularElemento(el, p, registro);
  assert.ok(!r.erro, r.erro);
  const pd = 1.4 * (r.cargas.g + r.cargas.q);
  perto(r.MdPos, (pd * 0.42 * 3.5 ** 2) / 8, 0.005, 'Md');
  perto(r.reacoes[0].g, (r.cargas.g * 3.5) / 2, 0.005, 'Rg por metro');
  assert.ok(r.ok, r.verificacoes.filter((v) => !v.ok).map((v) => v.nome).join(', '));
});

test('treliçada: contraflecha é limitada a L/350', () => {
  const p = criarProjeto();
  const el = { ...trel.criarLajeTrelicada(), L: 4, contraflecha: 50 };
  const r = trel.calcularLajeTrelicada(el, ctxDe(p));
  assert.equal(r.verificacoes.find((v) => v.nome === 'Contraflecha').ok, false);
});

test('nervurada em duas direções: reações somam a carga total', () => {
  const p = criarProjeto();
  const el = { id: 'ln1', modulo: 'concreto.laje.nervurada', codigo: 'LN1', nome: 'LN1', ...nerv.criarLajeNervurada() };
  p.elementos.push(el);
  const r = calcularElemento(el, p, registro);
  assert.ok(!r.erro, r.erro);
  const tot = r.reacoes.reduce((s, x) => s + x.d * (x.id.startsWith('x') ? el.ly : el.lx), 0);
  perto(tot, r.cargas.pd * el.lx * el.ly, 0.01, 'soma das reações');
  assert.equal(r.cortante.criterio, 'VRd1 (como laje)');
});

test('nervurada com intereixo de 80 cm verifica a mesa e o cortante como viga', () => {
  const p = criarProjeto();
  const r = nerv.calcularLajeNervurada({ ...nerv.criarLajeNervurada(), intereixo: 80 }, ctxDe(p));
  assert.ok(r.mesa, 'deve haver verificação da mesa');
  assert.equal(r.cortante.criterio, 'VRd2 (como viga)');
});

test('nervurada em uma direção só descarrega nas bordas x', () => {
  const p = criarProjeto();
  const t = nerv.cargasTransmitidas({ ...nerv.criarLajeNervurada(), direcao: 'x' }, ctxDe(p));
  assert.equal(t.y0.g, 0);
  assert.ok(t.x0.g > 0 && t.x1.g > 0);
});

test('alveolar: Md = pd·L²/8 e falha quando passa de MRd', () => {
  const p = criarProjeto();
  const ok = alv.calcularLajeAlveolar(alv.criarLajeAlveolar(), ctxDe(p));
  perto(ok.Md, (ok.cargas.pd * 49) / 8, 0.001, 'Md');
  const longo = alv.calcularLajeAlveolar({ ...alv.criarLajeAlveolar(), L: 9 }, ctxDe(p));
  assert.equal(longo.verificacoes.find((v) => v.nome === 'Momento fletor').ok, false);
});

test('viga recebe a reação de uma laje treliçada', () => {
  const p = criarProjeto();
  p.elementos.push(
    { id: 'lt1', modulo: 'concreto.laje.trelicada', codigo: 'LT1', nome: 'LT1', ...trel.criarLajeTrelicada() },
    { id: 'v1', modulo: 'concreto.viga', codigo: 'V1', nome: 'V1', ...viga.criarViga(), cargas: [{ id: 'c', tipo: 'elemento', elementoId: 'lt1', ligacao: 'apoio-a', vao: 'todos' }] },
  );
  const r = calcularElemento(p.elementos[1], p, registro);
  assert.ok(!r.erro, r.erro);
  assert.ok(r.vaos[0].gk > 2.5, 'a viga deve somar a reação da laje ao peso próprio');
});

/** Contexto de cálculo para chamar o módulo direto. */
function ctxDe(p) { return contextoCalculo(p, registro); }
