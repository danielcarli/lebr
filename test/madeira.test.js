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
 * Testes do motor de madeira (NBR 7190-1:2022) e dos módulos viga, pilar e entrepiso.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { madeira, fatorKc, compressaoMadeira, flexaoMadeira, cisalhamentoMadeira, estabilidadeLateral, flechaFinal, classeMadeira } from '../src/engine/madeira.js';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento, contextoCalculo } from '../src/renderer/core/calculo.js';
import * as viga from '../src/modules/madeira-viga/calculo.js';
import * as pilar from '../src/modules/madeira-pilar/calculo.js';
import * as piso from '../src/modules/madeira-entrepiso/calculo.js';

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg}: ${a} ≠ ${b} (±${tol * 100}%)`);

const registro = {
  mods: {
    'madeira.viga': { calcular: viga.calcularVigaMadeira, cargasTransmitidas: viga.cargasTransmitidas },
    'madeira.pilar': { calcular: pilar.calcularPilarMadeira, cargasTransmitidas: pilar.cargasTransmitidas },
    'madeira.entrepiso': { calcular: piso.calcularEntrepiso, cargasTransmitidas: piso.cargasTransmitidas },
  },
  obter(id) { return this.mods[id]; },
};

test('kmod e resistências de cálculo — C24, longa duração, umidade 2', () => {
  const m = madeira('C24', { umidade: 2, carregamento: 'longa' });
  perto(m.kmod, 0.63, 1e-9, 'kmod = 0,70 × 0,90');
  perto(m.fmd, (0.63 * 24) / 1.4, 1e-9, 'fm,d');
  perto(m.fvd, (0.63 * 4) / 1.8, 1e-9, 'fv,d');
  perto(m.Eef, 0.63 * 11000, 1e-9, 'Ec0,ef');
});

test('espécie nativa: fm,d = fc0,d e E0,05 = 0,7·E0,med', () => {
  const m = madeira('D40', { umidade: 1, carregamento: 'longa' });
  assert.equal(m.fmd, m.fc0d);
  perto(m.E005, 0.7 * 14500, 1e-9, 'E0,05');
  assert.equal(classeMadeira('D30').fc0k, 30);
});

test('kc: curva de estabilidade (βc = 0,2)', () => {
  assert.equal(fatorKc(0.25, 0.2), 1);
  perto(fatorKc(1.0, 0.2), 0.6893, 1e-3, 'kc(λrel = 1)');
  assert.ok(fatorKc(1.0, 0.1) > fatorKc(1.0, 0.2), 'MLC tem curva mais favorável');
});

test('compressão centrada de peça curta: σN/fc0,d', () => {
  const m = madeira('C24', { umidade: 2, carregamento: 'longa' });
  const r = compressaoMadeira({ Nd: 50, b: 15, h: 15, L0x: 30, L0y: 30, m });
  assert.ok(r.semInstab);
  perto(r.interacaoX, ((50 / 225) * 10 / m.fc0d) ** 2, 1e-9, 'interação');
});

test('flexão, cisalhamento e flecha final', () => {
  const m = madeira('C24', { umidade: 2, carregamento: 'longa' });
  perto(flexaoMadeira({ Md: 3, b: 6, h: 16, m }).sigma, (300 / ((6 * 256) / 6)) * 10, 1e-9, 'σ = M/W');
  perto(cisalhamentoMadeira({ Vd: 5, b: 6, h: 16, m }).tau, ((1.5 * 5) / 96) * 10, 1e-9, 'τ = 1,5V/A');
  perto(flechaFinal({ uG: 4, uQ: 5, psi2: 0.3, phi: 0.8 }), (4 + 1.5) * 1.8, 1e-9, 'ufin');
});

test('estabilidade lateral: viga esbelta e sem travamento é limitada', () => {
  const m = madeira('C24', { umidade: 2, carregamento: 'longa' });
  const r = estabilidadeLateral({ L1: 600, b: 4, h: 30, sigma: 8, m });
  assert.equal(r.dispensada, false);
  assert.ok(r.sigmaLim < m.fmd);
});

test('viga biapoiada: Md = pd·L²/8 com γg = 1,4 e γq = 1,5', () => {
  const p = criarProjeto();
  const el = { id: 'v', modulo: 'madeira.viga', codigo: 'VM1', nome: 'VM1', ...viga.criarVigaMadeira(p), pesoProprio: false };
  p.elementos.push(el);
  const r = calcularElemento(el, p, registro);
  assert.ok(!r.erro, r.erro);
  perto(r.MdPos, ((1.4 * 1.5 + 1.5 * 1.0) * 3.5 ** 2) / 8, 0.002, 'Md');
});

test('entrepiso → viga → pilar de madeira', () => {
  const p = criarProjeto();
  p.elementos.push(
    { id: 'e', modulo: 'madeira.entrepiso', codigo: 'EM1', nome: 'EM1', ...piso.criarEntrepiso(p) },
    { id: 'v', modulo: 'madeira.viga', codigo: 'VM1', nome: 'VM1', ...viga.criarVigaMadeira(p), secao: { b: 12, h: 30 }, cargas: [{ id: 'c', tipo: 'elemento', elementoId: 'e', ligacao: 'apoio-a', vao: 'todos' }] },
    { id: 'p', modulo: 'madeira.pilar', codigo: 'PM1', nome: 'PM1', ...pilar.criarPilarMadeira(p), cargas: [{ id: 'c', tipo: 'elemento', elementoId: 'v', ligacao: 'apoio-0' }] },
  );
  const rp = calcularElemento(p.elementos[2], p, registro);
  assert.ok(!rp.erro, rp.erro);
  const rv = calcularElemento(p.elementos[1], p, registro);
  perto(rp.Nk.g + rp.Nk.q, rv.apoios[0].Rg + rv.apoios[0].Rq + 4.12 * 0.12 * 0.12 * 2.8, 0.01, 'reação da viga chega ao pilar');
});

test('entrepiso: frequência natural da faixa biapoiada', () => {
  const p = criarProjeto();
  const r = piso.calcularEntrepiso(piso.criarEntrepiso(p), contextoCalculo(p, registro));
  const m = madeira('C24');
  const I = (4.5 * 23 ** 3) / 12;
  const f1 = (Math.PI / (2 * 3.6 ** 2)) * Math.sqrt((m.E0m * 1e6 * I * 1e-8 / 0.4) / ((r.cargas.g * 1000) / 9.81));
  perto(r.f1, f1, 0.002, 'f1');
});

test('montante travado pelo painel tem esbeltez y reduzida', () => {
  const p = criarProjeto();
  const ctx = contextoCalculo(p, registro);
  const livre = pilar.calcularPilarMadeira({ ...pilar.criarPilarMadeira(p), b: 4, h: 9 }, ctx);
  const montante = pilar.calcularPilarMadeira({ ...pilar.criarPilarMadeira(p), b: 4, h: 9, montante: true, travamentoY: 0.6 }, ctx);
  assert.ok(montante.lambdaY < livre.lambdaY / 3);
});
