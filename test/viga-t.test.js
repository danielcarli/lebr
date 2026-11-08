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
/** Vigas T e L (NBR 6118, 14.6.2.2, 17.2 e 18.3.7): mesa colaborante, flexão, ligação mesa–alma e o módulo da viga. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { concreto, aco } from '../src/engine/materiais.js';
import { distanciaMomentoNulo, larguraColaboranteViga, flexaoVigaT, ligacaoMesaAlma } from '../src/engine/secao-t.js';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { detectarLigacoes, aplicarLigacoes } from '../src/renderer/core/montagem.js';
import { mesaDasLajes } from '../src/modules/comum/mesa-colaborante.js';

const C25 = concreto(25), CA50 = aco(500);
const reg = { obter: (id) => MODULOS_CALCULO[id] };
const perto = (a, b, msg, tol = 0.02) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} ≠ ${b}`);

test('14.6.2.2: a pela continuidade do tramo e bf da viga T e da viga L', () => {
  assert.equal(distanciaMomentoNulo(8).a, 8);
  assert.equal(distanciaMomentoNulo(8, { esq: true }).a, 6);
  perto(distanciaMomentoNulo(8, { esq: true, dir: true }).a, 4.8, 'a');
  assert.equal(distanciaMomentoNulo(2, { balanco: true }).a, 4);
  // T: b1 = mín(0,5·b2; 0,10·a) de cada lado
  const t = larguraColaboranteViga({ bw: 20, mesa: { tipo: 'T', b2a: 400, b2b: 100 }, a: 6 });
  assert.deepEqual([t.b1a, t.b1b, t.bf], [60, 50, 130]);
  // L: só o lado da laje, mais a aba em balanço b3 = mín(b4; 0,10·a)
  const l = larguraColaboranteViga({ bw: 20, mesa: { tipo: 'L', b2: 400, b4: 30 }, a: 6 });
  assert.deepEqual([l.b1, l.b3, l.bf], [60, 30, 110]);
});

test('17.2: linha neutra na mesa — seção retangular bf × h (conta à mão)', () => {
  // C25, CA-50, bw 20, h 50, hf 10, bf 100, d 45, Md 300 kN·m
  const r = flexaoVigaT({ Md: 300, bf: 100, bw: 20, hf: 10, h: 50, d: 45, c: C25, s: CA50 });
  const scd = C25.sigmaCd / 10, fyd = CA50.fyd / 10;
  const Kmd = 30000 / (100 * 45 * 45 * scd);
  const xi = (1 - Math.sqrt(1 - 2 * Kmd)) / 0.8;
  const As = 30000 / (45 * (1 - 0.4 * xi) * fyd);
  assert.equal(r.comoT, false);
  assert.ok(0.8 * xi * 45 <= 10);
  perto(r.As, As, 'As');
});

test('17.2: linha neutra na alma — abas + alma (conta à mão)', () => {
  const r = flexaoVigaT({ Md: 650, bf: 100, bw: 20, hf: 10, h: 50, d: 45, c: C25, s: CA50 });
  const scd = C25.sigmaCd / 10, fyd = CA50.fyd / 10;
  const Ff = scd * 80 * 10, Mf = Ff * (45 - 5) / 100;
  const Kw = (650 - Mf) * 100 / (20 * 45 * 45 * scd);
  const xi = (1 - Math.sqrt(1 - 2 * Kw)) / 0.8;
  const As = Ff / fyd + (650 - Mf) * 100 / (45 * (1 - 0.4 * xi) * fyd);
  assert.equal(r.comoT, true);
  perto(r.Ff, Ff, 'Ff'); perto(r.Mf, Mf, 'Mf'); perto(r.As, As, 'As');
  assert.equal(r.dupla, false);
});

test('18.3.7: ligação mesa–alma — vSd = (Vd/z)·(b1/bf), mínimo de 1,5 cm²/m', () => {
  const r = ligacaoMesaAlma({ Vd: 200, d: 45, bf: 100, b1: 40, hf: 10, c: C25, s: CA50 });
  const vSd = (200 / (0.9 * 0.45)) * (40 / 100);
  perto(r.vSd, vSd, 'vSd');
  perto(r.AsfCalc, vSd / (CA50.fyd / 10), 'Asf');
  perto(r.vRd2, 0.5 * (1 - 25 / 250) * (C25.fcd / 10) * 10 * 100, 'vRd2');
  assert.equal(ligacaoMesaAlma({ Vd: 10, d: 45, bf: 100, b1: 40, hf: 10, c: C25, s: CA50 }).Asf, 1.5);
});

function projetoComLajes() {
  const p = criarProjeto();
  p.pavimentos = [{ id: 'p1', nome: '1º', cota: 3 }];
  const viga = (id, x, y, ang, L) => ({ id, modulo: 'concreto.viga', codigo: id, nome: id, ...MODULOS_CALCULO['concreto.viga'].criar(p), cargas: [], secao: { b: 20, h: 50 }, vaos: [{ L }], apoios: ['apoio', 'apoio'], posicao: { pavimento: 'p1', x, y, angulo: ang } });
  p.elementos.push(viga('V1', 0, 0, 0, 8), viga('V2', 0, 4, 0, 8), viga('V3', 0, 8, 0, 8), viga('V4', 0, 0, 90, 8), viga('V5', 8, 0, 90, 8));
  const laje = (id, y) => ({ id, modulo: 'concreto.laje.macica', codigo: id, nome: id, ...MODULOS_CALCULO['concreto.laje.macica'].criar(p), lx: 8, ly: 4, h: 12, posicao: { pavimento: 'p1', x: 0, y, angulo: 0 } });
  p.elementos.push(laje('L1', 0), laje('L2', 4));
  aplicarLigacoes(p, detectarLigacoes(p, reg));
  return p;
}

test('montagem: viga entre duas lajes vira T, viga de borda vira L, com hf e b2 das lajes', () => {
  const p = projetoComLajes();
  const v2 = mesaDasLajes(p, p.elementos.find((e) => e.id === 'V2'));
  assert.deepEqual({ tipo: v2.tipo, hf: v2.hf, b2a: v2.b2a, b2b: v2.b2b }, { tipo: 'T', hf: 12, b2a: 380, b2b: 380 });
  const v1 = mesaDasLajes(p, p.elementos.find((e) => e.id === 'V1'));
  assert.deepEqual({ tipo: v1.tipo, hf: v1.hf, b2: v1.b2 }, { tipo: 'L', hf: 12, b2: 380 });
});

test('módulo: a viga T precisa de menos aço e flecha menos que a retangular; a L fica entre as duas', () => {
  const p = projetoComLajes();
  const v2 = p.elementos.find((e) => e.id === 'V2');
  const calc = (mesa) => { const el = structuredClone(v2); if (mesa) el.mesa = mesa; else delete el.mesa; return calcularElemento(el, p, reg); };
  const R = calc(null), T = calc({ tipo: 'T', hf: 12, b2a: 380, b2b: 380 }), L = calc({ tipo: 'L', hf: 12, b2: 380, b4: 0 });
  assert.ok(!R.erro && !T.erro && !L.erro, R.erro ?? T.erro ?? L.erro);
  assert.equal(T.vaos[0].mesa.bf, 180, 'bw + 2 × 0,10·8 m');
  assert.equal(L.vaos[0].mesa.bf, 100);
  assert.ok(T.vaos[0].positiva.AsCalc <= L.vaos[0].positiva.AsCalc && L.vaos[0].positiva.AsCalc <= R.vaos[0].positiva.AsCalc);
  assert.ok(T.vaos[0].flecha.ft < L.vaos[0].flecha.ft && L.vaos[0].flecha.ft < R.vaos[0].flecha.ft);
  assert.ok(T.verificacoes.some((v) => v.nome.startsWith('Ligação mesa–alma')));
  assert.ok(T.memorial.some((m) => m.titulo.startsWith('Viga T — mesa colaborante')));
  // mesa mais grossa que a viga é erro de entrada
  assert.match(calc({ tipo: 'T', hf: 60, b2a: 100, b2b: 100 }).erro, /mesa/);
});

test('módulo: viga invertida usa a mesa só nos apoios; no balanço, seção retangular', () => {
  const p = criarProjeto();
  const el = { id: 'v', modulo: 'concreto.viga', codigo: 'V1', nome: 'V1', ...MODULOS_CALCULO['concreto.viga'].criar(p), secao: { b: 20, h: 60 }, vaos: [{ L: 6 }, { L: 6 }], apoios: ['apoio', 'apoio', 'apoio'], invertida: true, mesa: { tipo: 'T', hf: 10, b2a: 300, b2b: 300 } };
  p.elementos.push(el);
  const r = calcularElemento(el, p, reg);
  assert.ok(!r.erro, r.erro);
  assert.equal(r.vaos[0].mesa, null, 'no vão a mesa está tracionada');
  assert.ok(r.memorial.some((m) => m.linhas.some((l) => l.includes('Viga invertida: a laje fica embaixo'))));
});
