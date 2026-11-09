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
/** Vigas com seção própria em cada vão (b, h e normal ou invertida). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { secaoDoVao, secoesDaViga, secaoVariavel, facesContinuas, volumeViga, rotuloSecao, secaoNoApoio } from '../src/engine/viga-secoes.js';
import { modeloViga } from '../src/modules/comum/armadura3d.js';
import { quantitativosDoElemento } from '../src/modules/comum/quantitativos.js';

const registro = { obter: (id) => MODULOS_CALCULO[id] };
const copia = (o) => JSON.parse(JSON.stringify(o));

function calcular(dados) {
  const proj = criarProjeto({ nome: 't' });
  const el = { id: 'v1', codigo: 'V1', modulo: 'concreto.viga', ...MODULOS_CALCULO['concreto.viga'].criar(), ...dados };
  proj.elementos.push(el);
  const r = calcularElemento(el, proj, registro);
  assert.ok(!r.erro, r.erro);
  return { el, r, proj };
}

test('seções por vão: leitura, níveis, faces e rótulo', () => {
  const el = { secao: { b: 20, h: 50 }, invertida: false, vaos: [{ L: 5 }, { L: 4, h: 40 }, { L: 3, invertida: true }] };
  assert.deepEqual(secaoDoVao(el, 0), { b: 20, h: 50, invertida: false });
  assert.deepEqual(secaoDoVao(el, 1), { b: 20, h: 40, invertida: false });
  const ss = secoesDaViga(el, { hLaje: 12 });
  assert.deepEqual([ss[2].base, ss[2].topo], [-12, 38], 'vão invertido: base na face inferior da laje');
  assert.deepEqual([ss[1].base, ss[1].topo], [-40, 0], 'vão normal: topo no piso');
  assert.ok(secaoVariavel(el));
  assert.deepEqual(facesContinuas(ss, 1), { superior: true, inferior: false }, 'altura diferente: só a face de baixo muda');
  assert.deepEqual(facesContinuas(ss, 2), { superior: false, inferior: false }, 'normal → invertida: as duas faces mudam');
  assert.equal(secaoNoApoio(ss, 1).h, 40);
  assert.equal(rotuloSecao(el), '20 × 50 / 20 × 40 / 20 × 50 inv. cm');
  assert.ok(Math.abs(volumeViga(el) - (0.2 * 0.5 * 5 + 0.2 * 0.4 * 4 + 0.2 * 0.5 * 3)) < 1e-9);
  assert.equal(secaoVariavel({ secao: { b: 20, h: 50 }, vaos: [{ L: 5 }, { L: 4, b: 20, h: 50 }] }), false);
});

test('viga com os vãos iguais à seção da viga dá o mesmo resultado que a seção constante', () => {
  const base = { vaos: [{ L: 5 }, { L: 4 }], apoios: ['apoio', 'apoio', 'apoio'] };
  const a = calcular(base).r;
  const b = calcular({ ...copia(base), vaos: [{ L: 5, b: 20, h: 50, invertida: false }, { L: 4, b: 20, h: 50, invertida: false }] }).r;
  assert.deepEqual(b.vaos, a.vaos);
  assert.deepEqual(b.apoios, a.apoios);
  assert.deepEqual(b.detalhamento.posicoes.map((q) => [q.id, q.n, q.phi, q.comprimento]), a.detalhamento.posicoes.map((q) => [q.id, q.n, q.phi, q.comprimento]));
});

test('equilíbrio e peso próprio vão a vão', () => {
  const { r } = calcular({ vaos: [{ L: 5, b: 20, h: 60 }, { L: 4, b: 15, h: 40 }, { L: 2, b: 20, h: 50 }], apoios: ['apoio', 'apoio', 'apoio', 'livre'], cargas: [] });
  const total = 25 * (0.2 * 0.6 * 5 + 0.15 * 0.4 * 4 + 0.2 * 0.5 * 2);
  const soma = r.apoios.reduce((s, a) => s + a.Rg, 0);
  assert.ok(Math.abs(soma - total) < 0.02, `ΣR = ${soma} × ${total}`);
});

test('mais altura num vão: menos aço e menos flecha nesse vão', () => {
  const base = { vaos: [{ L: 6, b: 20, h: 45 }, { L: 4, b: 20, h: 45 }], apoios: ['apoio', 'apoio', 'apoio'] };
  const a = calcular(base).r;
  const b = calcular({ ...copia(base), vaos: [{ L: 6, b: 20, h: 65 }, { L: 4, b: 20, h: 45 }] }).r;
  assert.ok(b.vaos[0].positiva.AsCalc < a.vaos[0].positiva.AsCalc);
  assert.ok(b.vaos[0].flecha.ft < a.vaos[0].flecha.ft);
  // Clapeyron: M_B é a média de qL²/8 dos vãos ponderada por L/I — enrijecer o vão longo (de qL²/8 maior) tira peso
  // dele e o negativo cai em direção ao do vão curto
  assert.ok(Math.abs(b.apoios[1].Mdneg) < Math.abs(a.apoios[1].Mdneg));
  // o negativo é dimensionado com a menor seção vizinha
  assert.ok(b.apoios[1].negativa.d < 45);
});

test('face que muda de nível: nenhuma barra passa de um vão ao outro, e as que chegam ao apoio têm gancho', () => {
  const { r, el } = calcular({ vaos: [{ L: 5, h: 50 }, { L: 4, h: 40 }, { L: 4, h: 50, invertida: true }], apoios: ['apoio', 'apoio', 'apoio', 'apoio'] });
  const det = r.detalhamento;
  const X = det.X;
  const larg = det.larguras;
  // apoio 2 (k = 1): só a face inferior muda; apoio 3 (k = 2): as duas
  const cruza = (q, k) => q.x0 < X[k] - (larg[k] / 2 - 3) / 100 - 1e-6 && q.x1 > X[k] + (larg[k] / 2 - 3) / 100 + 1e-6;
  for (const q of det.posicoes) {
    if (q.face === 'inferior') assert.ok(!cruza(q, 1) && !cruza(q, 2), `${q.N} (${q.local}) atravessa um apoio onde a face de baixo muda`);
    if (q.face === 'superior') assert.ok(!cruza(q, 2), `${q.N} (${q.local}) atravessa o apoio 3`);
  }
  // as negativas do apoio 3 viram duas, com gancho dentro do apoio
  const neg3 = det.posicoes.filter((q) => q.tipo === 'negativa' && q.local === 'Apoio 3');
  assert.ok(neg3.some((q) => q.x1 <= X[2] + 0.1 && q.gancho[1]) && neg3.some((q) => q.x0 >= X[2] - 0.1 && q.gancho[0]));
  // cada barra fica no nível do seu vão; estribos com a forma de cada seção
  assert.ok(det.posicoes.filter((q) => q.local === 'Vão 3').every((q) => q.sec.topo > 0), 'vão invertido acima do piso');
  assert.ok(det.posicoes.filter((q) => q.tipo === 'estribo').length >= 2);
  // 3D: um bloco de concreto por vão, nos níveis certos
  const m = modeloViga(el, det, det.posicoes, {});
  const conc = m.caixas.filter((c) => c.tipo === 'concreto');
  assert.equal(conc.length, 3);
  assert.ok(conc[2].min[2] > conc[0].min[2] && conc[2].max[2] > conc[0].max[2]);
  assert.ok(r.memorial.some((s) => s.titulo === 'Seções por vão'));
});

test('só parte da viga invertida: suspensão só nos vãos invertidos', () => {
  const proj = criarProjeto({ nome: 't' });
  proj.pavimentos ??= [];
  const laje = { id: 'l1', codigo: 'L1', modulo: 'concreto.laje.macica', ...MODULOS_CALCULO['concreto.laje.macica'].criar() };
  const viga = { id: 'v1', codigo: 'V1', modulo: 'concreto.viga', ...MODULOS_CALCULO['concreto.viga'].criar(),
    vaos: [{ L: 4, invertida: false }, { L: 4, invertida: true }], apoios: ['apoio', 'apoio', 'apoio'],
    cargas: [{ id: 'c', tipo: 'elemento', elementoId: 'l1', ligacao: 'x0', vao: 'todos' }] };
  proj.elementos.push(laje, viga);
  laje.resultado = calcularElemento(laje, proj, registro);
  const r = calcularElemento(viga, proj, registro);
  assert.ok(!r.erro, r.erro);
  assert.ok(!r.vaos[0].suspensao && r.vaos[1].suspensao?.asw > 0);
  assert.ok(r.vaos[1].estribos.asw > r.vaos[0].estribos.asw);
});

test('quantitativos: concreto e fôrma vão a vão', () => {
  const { el, r } = calcular({ vaos: [{ L: 5, b: 20, h: 60 }, { L: 4, b: 15, h: 40 }], apoios: ['apoio', 'apoio', 'apoio'] });
  el.resultado = r;
  const q = quantitativosDoElemento(el);
  assert.ok(Math.abs(q.concreto - (0.2 * 0.6 * 5 + 0.15 * 0.4 * 4)) < 1e-6);
  assert.ok(Math.abs(q.forma - ((0.2 + 1.2) * 5 + (0.15 + 0.8) * 4)) < 1e-6);
});
