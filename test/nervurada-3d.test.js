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
/** Laje nervurada: geometria (capa, nervuras, faixas de borda, travamentos, enchimento), lista de ferros e armadura em 3D. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faixasNervuras, travamentos, geometriaNervurada } from '../src/modules/comum/nervurada-geometria.js';
import { detalhamentoNervurada, posicoesDe } from '../src/modules/comum/detalhamento.js';
import { modeloNervurada, limitesDoModelo } from '../src/modules/comum/armadura3d.js';
import { quantitativosDoElemento } from '../src/modules/comum/quantitativos.js';
import { aplicarEdicoes } from '../src/engine/detalhamento.js';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const vol = (c) => (c.max[0] - c.min[0]) * (c.max[1] - c.min[1]) * (c.max[2] - c.min[2]);
const soma = (xs) => xs.reduce((s, x) => s + x, 0);

function laje(p, extra = {}) {
  const el = { id: extra.id ?? 'L1', modulo: 'concreto.laje.nervurada', codigo: extra.codigo ?? 'L1', nome: 'L1', ...MODULOS_CALCULO['concreto.laje.nervurada'].criar(p), ...extra };
  p.elementos.push(el);
  el.resultado = calcularElemento(el, p, reg);
  return el;
}

test('faixas: m = ⌊(L − bw)/e⌋ vazios, nervura nas duas pontas e a sobra como faixa maciça de borda', () => {
  const f = faixasNervuras(700, 60, 10);
  assert.equal(f.vazios.length, 11);
  assert.equal(f.eixos.length, 12);
  assert.equal(f.borda, 25, 'sobra (700 − 660 − 10)/2 = 15 + nervura de 10');
  assert.ok(f.vazios.every(([a, b]) => Math.abs(b - a - 50) < 1e-9), 'vazios de e − bw');
  assert.equal(soma(f.cheios.map(([a, b]) => b - a)) + soma(f.vazios.map(([a, b]) => b - a)), 700);
  assert.deepEqual([f.eixos[0], f.eixos.at(-1)], [20, 680]);
});

test('travamentos (uma direção): nenhum até 4 m, um no meio até 6 m, dois nos terços acima; nenhum em balanço', () => {
  assert.deepEqual(travamentos(4), []);
  assert.deepEqual(travamentos(5), [250]);
  assert.deepEqual(travamentos(7.5), [250, 500]);
  assert.deepEqual(travamentos(7.5, true), []);
});

test('geometria: as caixas preenchem a laje sem sobrepor — concreto + vazios = lx·ly·h; enchimento só fora da cubeta', () => {
  for (const el of [
    { lx: 6, ly: 7, h: 30, hf: 5, bw: 10, intereixo: 60, direcao: 'duas', enchimento: 'cubeta' },
    { lx: 7, ly: 5, h: 25, hf: 5, bw: 9, intereixo: 50, direcao: 'x', enchimento: 'eps', bordas: { x0: 'apoiada', x1: 'apoiada' } },
  ]) {
    const g = geometriaNervurada(el);
    const conc = soma(g.caixas.filter((c) => c.tipo === 'concreto').map(vol));
    const vazios = soma(g.faixasX.vazios.flatMap(([a, b]) => g.faixasY.vazios.map(([c, d]) => (b - a) * (d - c) * (g.h - g.hf))));
    assert.ok(Math.abs(conc + vazios - g.lx * g.ly * g.h) < 1, `${el.direcao}: ${conc} + ${vazios}`);
    const ench = g.caixas.filter((c) => c.tipo === 'enchimento');
    if (el.enchimento === 'cubeta') assert.equal(ench.length, 0);
    else assert.ok(Math.abs(soma(ench.map(vol)) - vazios) < 1);
  }
  const um = geometriaNervurada({ lx: 7, ly: 5, h: 25, hf: 5, bw: 9, intereixo: 50, direcao: 'x' });
  assert.deepEqual(um.travamento, [233.3, 466.7]);
  assert.deepEqual(um.nervurasY, um.travamento);
});

test('lista de ferros (duas direções): barras por nervura × nervuras, de face a face, e malha construtiva da capa', () => {
  const p = criarProjeto();
  const el = laje(p);
  const det = detalhamentoNervurada(el, el.resultado, p);
  const g = det.geometria;
  const nx = det.posicoes.find((q) => q.id === 'nerv-x'), ny = det.posicoes.find((q) => q.id === 'nerv-y');
  const ax = el.resultado.armaduras.find((a) => a.rotulo.startsWith('Nervura x')).arranjo;
  assert.equal(nx.n, g.nervurasX.length * ax.n);
  assert.equal(ny.n, g.nervurasY.length * el.resultado.armaduras.find((a) => a.rotulo.startsWith('Nervura y')).arranjo.n);
  // sem viga ligada: apoio de 15 cm → até a face oposta menos o cobrimento (7,5 − 2,5 = 5 cm de cada lado)
  assert.equal(nx.comprimento, 610);
  assert.deepEqual(det.posicoes.filter((q) => q.face === 'capa').map((q) => [q.phi, q.s]), [[5, 20], [5, 20]]);
  assert.ok(!det.posicoes.some((q) => q.tipo === 'estribo'));
  assert.deepEqual(det.posicoes.map((q) => q.N), det.posicoes.map((_, i) => `N${i + 1}`));
});

test('intereixo de 80 cm: mesa calculada e estribos nas nervuras (cortante como viga)', () => {
  const p = criarProjeto();
  const el = laje(p, { intereixo: 80, bw: 12, h: 35 });
  assert.ok(el.resultado.cortante.estribos, 'estribos no resultado');
  const det = detalhamentoNervurada(el, el.resultado, p);
  const est = det.posicoes.find((q) => q.tipo === 'estribo');
  assert.ok(est && est.trechos.length === det.geometria.nervurasX.length + det.geometria.nervurasY.length);
  assert.equal(est.n, soma(est.trechos.map((t) => t.qtd)));
  assert.equal(det.posicoes.find((q) => q.id === 'capa-x').phi, el.resultado.mesa.arranjo.phi);
  const m = modeloNervurada(el, det, aplicarEdicoes(det.posicoes), { maxEstribos: 100 });
  assert.ok(m.barras.filter((b) => b.tipo === 'estribo').length <= 100 + est.trechos.length);
  assert.match(m.legenda, /estribos mostrados de \d+ em \d+/);
});

test('uma direção com engaste: negativa na capa, distribuição e travamentos; armadura em 3D dentro da laje', () => {
  const p = criarProjeto();
  const el = laje(p, { direcao: 'x', lx: 7, ly: 6, enchimento: 'ceramico', bordas: { x0: 'apoiada', x1: 'engastada', y0: 'apoiada', y1: 'apoiada' } });
  const det = detalhamentoNervurada(el, el.resultado, p);
  const tipos = det.posicoes.map((q) => q.id);
  for (const id of ['nerv-x', 'travamento', 'neg-x1-1', 'dist-x1-1', 'capa-x', 'capa-y']) assert.ok(tipos.includes(id), id);
  const neg = det.posicoes.find((q) => q.id === 'neg-x1-1');
  assert.equal(neg.a1, 175, '0,25·lx');
  const m = modeloNervurada(el, det, aplicarEdicoes(det.posicoes));
  const pos = det.posicoes.find((q) => q.id === 'nerv-x');
  assert.equal(m.barras.filter((b) => b.id === 'nerv-x').length, pos.n);
  assert.equal(m.barras.filter((b) => b.id === 'travamento').length, det.posicoes.find((q) => q.id === 'travamento').n);
  assert.ok(m.caixas.some((c) => c.tipo === 'enchimento' && c.material === 'ceramico'));
  // as barras do fundo ficam dentro da altura das nervuras e as negativas no topo da capa
  for (const b of m.barras.filter((x) => x.tipo === 'positiva')) assert.ok(b.pts.every((q) => q[2] > 0 && q[2] < 25 - 5));
  for (const b of m.barras.filter((x) => x.tipo === 'negativa')) assert.ok(b.pts.every((q) => q[2] > 25 && q[2] < 30));
  const { min, max } = limitesDoModelo(m);
  assert.ok(min[2] >= 0 && max[2] <= 30);
});

test('duas nervuradas engastadas lado a lado: a negativa comum é detalhada uma vez, na de código menor', () => {
  const p = criarProjeto();
  p.pavimentos = [{ id: 'p1', nome: '1º', cota: 3 }];
  const b = (x0, x1) => ({ x0, x1, y0: 'apoiada', y1: 'apoiada' });
  const L1 = laje(p, { id: 'a', codigo: 'L1', lx: 6, ly: 6, bordas: b('apoiada', 'engastada'), posicao: { pavimento: 'p1', x: 0, y: 0, angulo: 0 } });
  const L2 = laje(p, { id: 'b', codigo: 'L2', lx: 5, ly: 6, bordas: b('engastada', 'apoiada'), posicao: { pavimento: 'p1', x: 6, y: 0, angulo: 0 } });
  const d1 = detalhamentoNervurada(L1, L1.resultado, p), d2 = detalhamentoNervurada(L2, L2.resultado, p);
  const n1 = d1.posicoes.filter((q) => q.tipo === 'negativa');
  assert.equal(n1.length, 1);
  assert.equal(n1[0].outro, 'L2');
  assert.equal(n1[0].a1, 150); assert.equal(n1[0].a2, 150, '0,25 do maior vão para cada lado');
  assert.equal(d2.posicoes.filter((q) => q.tipo === 'negativa').length, 0);
  assert.ok(d2.avisos.some((a) => /detalhada em L1/.test(a)));
});

test('quantitativos: concreto pela geometria e aço pela lista de ferros', () => {
  const p = criarProjeto();
  const el = laje(p);
  const q = quantitativosDoElemento(el, el.resultado, p);
  assert.equal(q.detalhado, true);
  const g = geometriaNervurada(el);
  assert.ok(Math.abs(q.concreto - soma(g.caixas.filter((c) => c.tipo === 'concreto').map(vol)) / 1e6) < 1e-9);
  const kg = soma(Object.values(q.aco));
  const lista = soma(posicoesDe(el, el.resultado, p).map((x) => x.massa));
  assert.ok(Math.abs(kg - lista) / lista < 0.05, `${kg} ≈ ${lista}`);
});
