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
 * Bitolas escolhidas pelo usuário em vigas, lajes e pilares de concreto armado.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { criarProjeto } from '../src/renderer/core/projeto.js';
import { contextoCalculo } from '../src/renderer/core/calculo.js';
import { escolherBarrasLaje, motivoBarraLaje, bitolaFixa } from '../src/engine/barras.js';
import * as viga from '../src/modules/concreto-viga/calculo.js';
import * as laje from '../src/modules/concreto-laje-macica/calculo.js';
import * as pilar from '../src/modules/concreto-pilar/calculo.js';
import * as trel from '../src/modules/concreto-laje-trelicada/calculo.js';
import * as nerv from '../src/modules/concreto-laje-nervurada/calculo.js';

const registro = {
  mods: {
    'concreto.viga': { calcular: viga.calcularViga, cargasTransmitidas: viga.cargasTransmitidas },
    'concreto.laje.macica': { calcular: laje.calcularLaje, cargasTransmitidas: laje.cargasTransmitidas },
    'concreto.pilar': { calcular: pilar.calcularPilar, cargasTransmitidas: pilar.cargasTransmitidas },
  },
  obter(id) { return this.mods[id]; },
};
const ctx = () => contextoCalculo(criarProjeto(), registro);
const comArmadura = (el, a) => ({ ...el, armadura: { ...el.armadura, ...a } });

test('bitolaFixa: "auto" e vazio são automáticos', () => {
  assert.equal(bitolaFixa('auto'), null);
  assert.equal(bitolaFixa(undefined), null);
  assert.equal(bitolaFixa(''), null);
  assert.equal(bitolaFixa(12.5), 12.5);
  assert.equal(bitolaFixa('16'), 16);
});

test('viga: barras e estribos com a bitola escolhida', () => {
  const c = ctx();
  const r = viga.calcularViga(comArmadura(viga.criarViga(), { inferior: 16, superior: 10, estribo: 8 }), c);
  assert.equal(r.vaos[0].positiva.barras.phi, 16);
  assert.equal(r.vaos[0].estribos.phi, 8);
  assert.ok(r.memorial.some((m) => m.linhas.some((l) => l.includes('inferior ø 16'))));
});

test('viga: bitola que não cabe na largura gera aviso e não atende', () => {
  const c = ctx();
  const el = { ...viga.criarViga(), secao: { b: 12, h: 60 }, vaos: [{ L: 7 }], armadura: { inferior: 25, superior: 'auto', estribo: 'auto' } };
  el.cargas = [{ id: 'c', tipo: 'distribuida', natureza: 'g', vao: 'todos', valor: 40, descricao: 'carga alta' }];
  const r = viga.calcularViga(el, c);
  assert.equal(r.ok, false);
  assert.ok(r.avisos.some((a) => a.includes('ø 25 não cabem')));
});

test('viga de arquivo antigo (só phiT) mantém o estribo automático', () => {
  const c = ctx();
  const novo = viga.calcularViga(viga.criarViga(), c);
  const antigo = viga.calcularViga({ ...viga.criarViga(), armadura: { phiT: 5 } }, c);
  assert.deepEqual(antigo.vaos.map((v) => v.estribos.rotulo), novo.vaos.map((v) => v.estribos.rotulo));
});

test('laje: escolhe a bitola pedida ou explica por que não serve', () => {
  assert.equal(escolherBarrasLaje({ As: 2, h: 10, phi: 8 }).phi, 8);
  assert.equal(escolherBarrasLaje({ As: 2, h: 10, phi: 16 }), null);
  assert.match(motivoBarraLaje({ As: 2, h: 10, phi: 16 }), /h\/8/);
  assert.match(motivoBarraLaje({ As: 8, h: 12, phi: 5 }), /abaixo de 8 cm/);
  const c = ctx();
  const r = laje.calcularLaje(comArmadura(laje.criarLaje(), { inferior: 8 }), c);
  assert.ok(r.armaduras.filter((a) => a.rotulo.startsWith('Positiva')).every((a) => a.barras.phi === 8));
  const ruim = laje.calcularLaje(comArmadura(laje.criarLaje(), { inferior: 16 }), c);
  assert.equal(ruim.ok, false);
  assert.ok(ruim.avisos.some((a) => a.includes('escolha outra bitola')));
});

test('pilar: bitola longitudinal e estribo escolhidos', () => {
  const c = ctx();
  const r = pilar.calcularPilar(comArmadura(pilar.criarPilar(), { longitudinal: 16, estribo: 6.3 }), c);
  assert.equal(r.armadura.phi, 16);
  assert.equal(r.armadura.estribo.phi, 6.3);
  // estribo menor que ø/4 não atende (18.4.3)
  const est = pilar.calcularPilar(comArmadura({ ...pilar.criarPilar(), bx: 30, by: 40 }, { longitudinal: 25, estribo: 5 }), c);
  assert.equal(est.verificacoes.find((v) => v.nome === 'Diâmetro do estribo').ok, false);
  // ø maior que b/8
  const grossa = pilar.calcularPilar(comArmadura(pilar.criarPilar(), { longitudinal: 32 }), c);
  assert.equal(grossa.ok, false);
  assert.ok(grossa.avisos.some((a) => a.includes('b/8')));
});

test('treliçada e nervurada: bitolas de reforço e negativa', () => {
  const c = ctx();
  const lt = trel.calcularLajeTrelicada(comArmadura({ ...trel.criarLajeTrelicada(), L: 4.5, bordas: { x0: 'engastada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' } }, { adicional: 8, superior: 8 }), c);
  if (lt.adicional) assert.match(lt.adicional.rotulo, /ø 8$/);
  assert.match(lt.negativa.rotulo, /^ø 8 /);
  const ln = nerv.calcularLajeNervurada(comArmadura(nerv.criarLajeNervurada(), { nervura: 12.5 }), c);
  assert.ok(ln.armaduras.filter((a) => !a.negativa).every((a) => a.barras.includes('ø 12,5')));
});
