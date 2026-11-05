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
 * Bordas livres (balanço) em todos os tipos de laje: treliçada, nervurada,
 * alveolar e entrepiso de madeira (a laje maciça está em placa-livre.test.js).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento, contextoCalculo } from '../src/renderer/core/calculo.js';
import { bordasFaixa, problemaFaixa } from '../src/modules/comum/bordas.js';
import * as trel from '../src/modules/concreto-laje-trelicada/calculo.js';
import * as nerv from '../src/modules/concreto-laje-nervurada/calculo.js';
import * as alv from '../src/modules/concreto-laje-alveolar/calculo.js';
import * as piso from '../src/modules/madeira-entrepiso/calculo.js';
import * as viga from '../src/modules/concreto-viga/calculo.js';

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg}: ${a} ≠ ${b} (±${tol * 100}%)`);

const registro = {
  mods: {
    'concreto.laje.trelicada': { calcular: trel.calcularLajeTrelicada, cargasTransmitidas: trel.cargasTransmitidas },
    'concreto.laje.nervurada': { calcular: nerv.calcularLajeNervurada, cargasTransmitidas: nerv.cargasTransmitidas },
    'concreto.laje.alveolar': { calcular: alv.calcularLajeAlveolar, cargasTransmitidas: alv.cargasTransmitidas },
    'madeira.entrepiso': { calcular: piso.calcularEntrepiso, cargasTransmitidas: piso.cargasTransmitidas },
    'concreto.viga': { calcular: viga.calcularViga, cargasTransmitidas: viga.cargasTransmitidas },
  },
  obter(id) { return this.mods[id]; },
};
const ctx = () => contextoCalculo(criarProjeto(), registro);
const comBordas = (el, b) => ({ ...el, bordas: { ...el.bordas, ...b } });

test('bordas: arquivos antigos com "vinculo" viram bordas', () => {
  assert.deepEqual(bordasFaixa({ vinculo: 'balanco' }), { x0: 'engastada', x1: 'livre', y0: 'apoiada', y1: 'apoiada' });
  assert.deepEqual(bordasFaixa({ vinculo: 'engaste-apoio' }), { x0: 'engastada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' });
  assert.deepEqual(bordasFaixa({}), { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' });
  assert.ok(problemaFaixa({ x0: 'livre', x1: 'apoiada' }), 'livre + apoiada é instável');
  assert.ok(problemaFaixa({ x0: 'livre', x1: 'livre' }), 'duas livres é instável');
  assert.equal(problemaFaixa({ x0: 'livre', x1: 'engastada' }), null);
});

test('treliçada em balanço: reação = w·L, momento = w·L²/2, nos dois sentidos', () => {
  const c = ctx();
  const base = { ...trel.criarLajeTrelicada(), L: 1.5 };
  const bi = trel.calcularLajeTrelicada(base, c);
  const dir = trel.calcularLajeTrelicada(comBordas(base, { x0: 'engastada', x1: 'livre' }), c);
  const esq = trel.calcularLajeTrelicada(comBordas(base, { x0: 'livre', x1: 'engastada' }), c);
  perto(dir.MdNeg, -4 * bi.MdPos, 0.01, 'w·L²/2 = 4 × w·L²/8');
  assert.equal(dir.MdPos, 0);
  assert.equal(dir.reacoes.length, 1);
  perto(dir.reacoes[0].d, 2 * bi.reacoes[0].d, 0.01, 'reação do balanço = w·L');
  assert.equal(dir.reacoes[0].id, 'apoio-a');
  assert.equal(esq.reacoes[0].id, 'apoio-b');
  perto(esq.MdNeg, dir.MdNeg, 1e-6, 'simetria');
  assert.equal(dir.flecha.lim, (2 * 1.5 * 1000) / 250, 'limite 2·L/250');
  assert.deepEqual(trel.ligacoes(comBordas(base, { x0: 'engastada', x1: 'livre' })).map((l) => l.id), ['apoio-a']);
  // arquivo antigo com vinculo: 'balanco' dá o mesmo resultado
  const antigo = { ...base, vinculo: 'balanco' };
  delete antigo.bordas;
  assert.equal(trel.calcularLajeTrelicada(antigo, c).MdNeg, dir.MdNeg);
  assert.throws(() => trel.calcularLajeTrelicada(comBordas(base, { x1: 'livre' }), c), /engastada/);
});

test('treliçada: borda lateral livre só gera aviso', () => {
  const c = ctx();
  const r = trel.calcularLajeTrelicada(comBordas(trel.criarLajeTrelicada(), { y1: 'livre' }), c);
  assert.ok(r.avisos.some((a) => a.includes('lateral superior livre')));
  assert.equal(r.reacoes.length, 2);
});

test('nervurada em duas direções: varanda engastada numa borda e livre nas outras três', () => {
  const c = ctx();
  const el = comBordas({ ...nerv.criarLajeNervurada(), lx: 2, ly: 4 }, { x0: 'engastada', x1: 'livre', y0: 'livre', y1: 'livre' });
  const r = nerv.calcularLajeNervurada(el, c);
  assert.equal(r.balanco, true);
  assert.equal(r.metodoReacoes, 'placa');
  for (const b of ['x1', 'y0', 'y1']) assert.ok(Math.abs(r.reacoes.find((x) => x.id === b).g) < 1e-6, `${b} livre sem reação`);
  perto(r.reacoes.find((x) => x.id === 'x0').g * 4, r.cargas.g * 2 * 4, 0.01, 'toda a carga vai ao engaste');
  assert.ok(r.flecha.bordaLivre, 'flecha medida na borda livre');
  assert.deepEqual(nerv.ligacoes(el).map((l) => l.id), ['x0']);
  assert.throws(() => nerv.calcularLajeNervurada(comBordas(el, { x0: 'apoiada' }), c), /instável/);
});

test('nervurada em uma direção: balanço livre à esquerda', () => {
  const c = ctx();
  const el = comBordas({ ...nerv.criarLajeNervurada(), direcao: 'x', lx: 2, ly: 4 }, { x0: 'livre', x1: 'engastada' });
  const r = nerv.calcularLajeNervurada(el, c);
  const e = el.intereixo / 100;
  perto(r.reacoes.find((x) => x.id === 'x1').g, r.cargas.g * 2, 0.01, 'reação = g·L');
  perto(Math.min(...r.armaduras.map((a) => a.Md)), -(r.cargas.pd * e * 4) / 2, 0.01, 'Md = pd·e·L²/2');
  assert.ok(!r.armaduras.some((a) => a.rotulo.includes('positiva')), 'sem armadura positiva no balanço');
});

test('alveolar: biapoiada continua pd·L²/8; balanço exige MRd−', () => {
  const c = ctx();
  const base = alv.criarLajeAlveolar();
  const bi = alv.calcularLajeAlveolar(base, c);
  perto(bi.Md, (bi.cargas.pd * 49) / 8, 0.001, 'Md');
  const bal = comBordas({ ...base, L: 1.5 }, { x0: 'engastada', x1: 'livre' });
  const semNeg = alv.calcularLajeAlveolar(bal, c);
  perto(semNeg.MdNeg, -(semNeg.cargas.pd * 1.5 ** 2) / 2, 0.001, 'Md− = pd·L²/2');
  assert.equal(semNeg.ok, false, 'sem MRd− não atende');
  const comNeg = alv.calcularLajeAlveolar({ ...bal, painel: { ...bal.painel, MRdNeg: 30 } }, c);
  assert.ok(comNeg.verificacoes.find((v) => v.nome.startsWith('Momento negativo')).ok);
  perto(comNeg.reacoes[0].d, comNeg.cargas.pd * 1.5, 0.001, 'reação = pd·L');
  assert.deepEqual(alv.ligacoes(bal).map((l) => l.id), ['apoio-a']);
});

test('entrepiso de madeira em balanço e arquivo antigo', () => {
  const p = criarProjeto();
  const c = contextoCalculo(p, registro);
  const base = { ...piso.criarEntrepiso(p), L: 1.2 };
  const r = piso.calcularEntrepiso(comBordas(base, { x0: 'livre', x1: 'engastada' }), c);
  assert.equal(r.balanco, true);
  assert.equal(r.reacoes.length, 1);
  assert.equal(r.reacoes[0].id, 'apoio-b');
  assert.equal(r.f1, null, 'frequência só para biapoiada');
  assert.ok(r.MdNeg < 0 && r.MdPos === 0);
  const antigo = { ...base, vinculo: 'engaste-apoio' };
  delete antigo.bordas;
  const ra = piso.calcularEntrepiso(antigo, c);
  assert.deepEqual(ra.bordas, { x0: 'engastada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' });
});

test('viga recebe só a borda vinculada de uma laje treliçada em balanço', () => {
  const p = criarProjeto();
  const lt = comBordas({ id: 'lt1', modulo: 'concreto.laje.trelicada', codigo: 'LT1', nome: 'Varanda', ...trel.criarLajeTrelicada(), L: 1.2 }, { x0: 'engastada', x1: 'livre' });
  p.elementos.push(lt, { id: 'v1', modulo: 'concreto.viga', codigo: 'V1', nome: 'V1', ...viga.criarViga(), cargas: [{ id: 'c', tipo: 'elemento', elementoId: 'lt1', ligacao: 'apoio-a', vao: 'todos' }] });
  const transmitidas = trel.cargasTransmitidas(lt, contextoCalculo(p, registro));
  assert.deepEqual(Object.keys(transmitidas), ['apoio-a']);
  const r = calcularElemento(p.elementos[1], p, registro);
  assert.ok(!r.erro, r.erro);
});

test('treliçada com as vigotas em y: apoios nas bordas inferior e superior da planta', () => {
  const c = ctx();
  const emX = { ...trel.criarLajeTrelicada(), L: 3.5, largura: 4 };
  const emY = { ...emX, direcao: 'y' };
  const rx = trel.calcularLajeTrelicada(emX, c), ry = trel.calcularLajeTrelicada(emY, c);
  assert.equal(ry.MdPos, rx.MdPos, 'mesmo vão L, mesmos esforços');
  assert.deepEqual(ry.reacoes.map((r) => r.nome), ['Borda inferior (y = 0)', 'Borda superior (y = 3,50 m)']);
  assert.deepEqual(trel.ligacoes(emY).map((l) => l.id), ['apoio-a', 'apoio-b']);
  // bordas da planta: com vigotas em y, engaste embaixo e livre em cima = balanço
  const bal = { ...emY, L: 1.5, bordas: { x0: 'apoiada', x1: 'apoiada', y0: 'engastada', y1: 'livre' } };
  const rb = trel.calcularLajeTrelicada(bal, c);
  assert.equal(rb.balanco, true);
  assert.deepEqual(trel.ligacoes(bal).map((l) => l.nome), ['Borda inferior (y = 0)']);
  // bordas esquerda/direita livres são laterais quando as vigotas estão em y
  const lat = trel.calcularLajeTrelicada({ ...emY, bordas: { x0: 'livre', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' } }, c);
  assert.ok(lat.avisos.some((a) => a.includes('lateral esquerda livre')));
  assert.throws(() => trel.calcularLajeTrelicada({ ...emY, bordas: { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'livre' } }, c), /borda superior livre .* borda inferior precisa ser engastada/);
});
