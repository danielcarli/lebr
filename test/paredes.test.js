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
/** Etapa L12: paredes do DXF de arquitetura viram cargas nas vigas (e nas lajes, sem viga embaixo). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { segmentosDoFundo, paredesDeSegmentos, planoDeParedes, aplicarParedes, camadasProvaveis, blocoMaisProximo, ORIGEM } from '../src/renderer/core/paredes.js';
import { cargaParede } from '../src/engine/cargas.js';
import { cargasLaje } from '../src/modules/concreto-laje-macica/calculo.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const perto = (a, b, msg, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} ≠ ${b}`);

/** Térreo (cota 0) com três vigas 20 × 50 em U e o pavimento de cima a 2,88 m. */
function projeto() {
  const p = criarProjeto();
  p.pavimentos = [{ id: 'p1', nome: 'Térreo', cota: 0 }, { id: 'p2', nome: 'Superior', cota: 2.88 }];
  const viga = (id, x, y, angulo, L) => ({ id, modulo: 'concreto.viga', codigo: id, nome: id, ...MODULOS_CALCULO['concreto.viga'].criar(), cargas: [], vaos: [{ L }], apoios: ['apoio', 'apoio'], secao: { b: 20, h: 50 }, posicao: { pavimento: 'p1', x, y, angulo } });
  p.elementos.push(viga('V1', 0, 0, 0, 5), viga('V2', 0, 4, 0, 5), viga('V3', 0, 0, 90, 4));
  return p;
}
/** Parede desenhada como duas linhas paralelas (DXF em m), de espessura e (m), entre a e b. */
function linhas(a, b, e) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = [-(b[1] - a[1]) / L * (e / 2), (b[0] - a[0]) / L * (e / 2)];
  return [[a[0] + n[0], a[1] + n[1], b[0] + n[0], b[1] + n[1]], [a[0] - n[0], a[1] - n[1], b[0] - n[0], b[1] - n[1]]];
}
const plantaCom = (paredes, outras = []) => ({
  camadas: ['ARQ-PAREDE', 'MOBILIARIO'],
  entidades: [...paredes.flatMap(([a, b, e]) => linhas(a, b, e)).map((p) => ({ c: 0, p, f: 0 })), ...outras.map((p) => ({ c: 1, p, f: 0 }))],
});
const id = (x, y) => [x, y];

test('L12: três paredes de 14 cm sobre três vigas geram três cargas com o valor da conta à mão', () => {
  const p = projeto();
  const planta = plantaCom([[[0, 0], [5, 0], 0.14], [[0, 4], [5, 4], 0.14], [[0, 0], [0, 4], 0.14]]);
  const segs = segmentosDoFundo(planta, id, ['ARQ-PAREDE']);
  const paredes = paredesDeSegmentos(segs);
  assert.equal(paredes.length, 3);
  for (const w of paredes) perto(w.espessura, 0.14, 'espessura');

  // bloco cerâmico de vedação de 14 cm, 2 cm de revestimento por face: 1,9 kN/m² (NBR 6120, Tabela 2)
  // altura = 2,88 − 0,50 = 2,38 m → 1,9 × 2,38 = 4,522 kN/m
  const plano = planoDeParedes(p, reg, 'p1', paredes, { desenho: 'bloco', revestimento: 2 });
  assert.equal(plano.resumo.cargasViga, 3);
  for (const w of plano.paredes) { perto(w.altura, 2.38, 'altura'); perto(w.gPorMetro, 4.522, 'g'); }

  const n = aplicarParedes(p, 'p1', plano);
  assert.equal(n, 3);
  for (const v of ['V1', 'V2', 'V3']) {
    const cs = p.elementos.find((e) => e.id === v).cargas.filter((c) => c.origem === ORIGEM);
    assert.equal(cs.length, 1, v);
    assert.equal(cs[0].tipo, 'alvenaria');
    assert.equal(cs[0].espessura, 14);
    assert.equal(cs[0].vao, 0);
    perto(cargaParede(cs[0]).g, 4.522, `${v} kN/m`);
  }
  // aplicar de novo troca, não duplica
  aplicarParedes(p, 'p1', planoDeParedes(p, reg, 'p1', paredes, { desenho: 'bloco' }));
  assert.equal(p.elementos.flatMap((e) => e.cargas).filter((c) => c?.origem === ORIGEM).length, 3);
});

test('L12: espessura desenhada com revestimento desconta 2 × 2 cm (14 cm → bloco de 9); a altura pode ser trocada', () => {
  assert.equal(blocoMaisProximo('ceramico-vedacao', 10), 9);
  assert.equal(blocoMaisProximo('ceramico-vedacao', 19), 19);
  const p = projeto();
  const paredes = paredesDeSegmentos(segmentosDoFundo(plantaCom([[[0, 0], [5, 0], 0.14]]), id));
  const plano = planoDeParedes(p, reg, 'p1', paredes, { alturas: { 0: 2.5 } });
  assert.equal(plano.paredes[0].bloco, 9);
  perto(plano.paredes[0].gPorMetro, 1.6 * 2.5, 'g'); // 9 cm com 2 cm/face: 1,6 kN/m²
});

test('L12: trecho curto no vão vira concentrada com o peso do trecho, no centro dele', () => {
  const p = projeto();
  const paredes = paredesDeSegmentos(segmentosDoFundo(plantaCom([[[1, 0], [2.5, 0], 0.14]]), id));
  const plano = planoDeParedes(p, reg, 'p1', paredes, { desenho: 'bloco' });
  aplicarParedes(p, 'p1', plano);
  const [c] = p.elementos.find((e) => e.id === 'V1').cargas;
  assert.equal(c.tipo, 'concentrada');
  perto(c.valor, 4.522 * 1.5, 'P');
  perto(c.posicao, 1.75, 'x');
});

test('L12: encontro em T não quebra a parede; linhas de outra camada e fora da faixa ficam de fora', () => {
  // face de baixo de V1 cortada pela parede que chega de baixo em x = 2,5
  const planta = {
    camadas: ['PAR', 'MOB'],
    entidades: [
      { c: 0, p: [0, 0.07, 5, 0.07], f: 0 },
      { c: 0, p: [0, -0.07, 2.43, -0.07], f: 0 },
      { c: 0, p: [2.57, -0.07, 5, -0.07], f: 0 },
      { c: 1, p: [0, 1, 3, 1], f: 0 }, { c: 1, p: [0, 1.1, 3, 1.1], f: 0 }, // móvel de 10 cm, outra camada
      { c: 0, p: [0, 2, 3, 2], f: 0 }, { c: 0, p: [0, 2.4, 3, 2.4], f: 0 }, // 40 cm: não é parede
    ],
  };
  const paredes = paredesDeSegmentos(segmentosDoFundo(planta, id, ['PAR']));
  assert.equal(paredes.length, 1);
  perto(paredes[0].comprimento, 5, 'comprimento');
  assert.equal(camadasProvaveis(planta, id)[0].nome, 'PAR');
});

test('L12: parede sem viga embaixo vai para a laje como peso ÷ área (kN/m²), descontando a laje na altura', () => {
  const p = projeto();
  p.elementos.push({ id: 'L1', modulo: 'concreto.laje.macica', codigo: 'L1', nome: 'L1', ...MODULOS_CALCULO['concreto.laje.macica'].criar(), lx: 5, ly: 4, h: 10, posicao: { pavimento: 'p1', x: 0, y: 0, angulo: 0 } });
  const paredes = paredesDeSegmentos(segmentosDoFundo(plantaCom([[[2.5, 0.5], [2.5, 3.5], 0.14]]), id));
  const plano = planoDeParedes(p, reg, 'p1', paredes, { desenho: 'bloco' });
  assert.equal(plano.resumo.cargasViga, 0);
  perto(plano.paredes[0].altura, 2.78, 'altura'); // 2,88 − 0,10
  const peso = 1.9 * 2.78 * 3;
  perto(plano.lajes[0].valor, peso / 20, 'kN/m²');
  aplicarParedes(p, 'p1', plano);
  const L1 = p.elementos.find((e) => e.id === 'L1');
  perto(L1.cargas.paredes, peso / 20, 'na laje');
  const ctx = { materiais: { gama: 25 } };
  const sem = cargasLaje({ ...L1, cargas: { ...L1.cargas, paredes: 0 } }, ctx).g;
  perto(cargasLaje(L1, ctx).g - sem, peso / 20, 'somada às permanentes');
});

test('L12: parede fora de viga e de laje fica marcada como sem apoio', () => {
  const p = projeto();
  const paredes = paredesDeSegmentos(segmentosDoFundo(plantaCom([[[8, 0], [8, 3], 0.14]]), id));
  const plano = planoDeParedes(p, reg, 'p1', paredes);
  assert.equal(plano.resumo.semApoio, 1);
  assert.equal(aplicarParedes(p, 'p1', plano), 0);
});
