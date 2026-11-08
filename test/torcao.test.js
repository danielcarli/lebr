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
/** Torção em vigas (17.5) e torção de equilíbrio vinda de lajes em balanço. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { torcaoNoVao, dimensionarTorcao, secaoVazada } from '../src/engine/torcao.js';
import { concreto, aco } from '../src/engine/materiais.js';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento, contextoCalculo } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';

const registro = { obter: (id) => MODULOS_CALCULO[id] };
const novo = (p, modulo, extra) => ({ id: extra.id ?? modulo, modulo, codigo: extra.codigo ?? 'X', nome: 'X', ...MODULOS_CALCULO[modulo].criar(p), ...extra });

test('diagrama de torção por vão', () => {
  assert.equal(torcaoNoVao(2, 4, 0, false, false), 4);
  assert.equal(torcaoNoVao(2, 4, 2, false, false), 0);
  assert.equal(torcaoNoVao(2, 4, 0, false, true), 8, 'balanço engastado no início: t·L');
  assert.equal(torcaoNoVao(2, 4, 4, true, false), -8, 'balanço engastado no fim');
  assert.equal(torcaoNoVao(0, 4, 1, false, false), 0);
});

test('seção vazada e torção crescente', () => {
  assert.ok(Math.abs(secaoVazada({ b: 30, h: 60, c1: 4 }).he - 10) < 1e-9);
  const c = concreto(25), s = aco(500);
  const t1 = dimensionarTorcao({ Td: 10, Vd: 50, VRd2: 300, b: 20, h: 50, c1: 4, c, s });
  const t2 = dimensionarTorcao({ Td: 20, Vd: 50, VRd2: 300, b: 20, h: 50, c1: 4, c, s });
  assert.ok(t2.A90 > t1.A90 && t2.Asl > t1.Asl && t2.interacao > t1.interacao);
});

test('lajes só transmitem torção quando em balanço', () => {
  const p = criarProjeto();
  const ctx = contextoCalculo(p, registro);
  const tre = MODULOS_CALCULO['concreto.laje.trelicada'];
  const bi = novo(p, 'concreto.laje.trelicada', { id: 'a' });
  assert.equal(tre.cargasTransmitidas(bi, ctx)['apoio-a'].t, undefined);
  const bal = novo(p, 'concreto.laje.trelicada', { id: 'b', L: 1.2, bordas: { x0: 'engastada', x1: 'livre', y0: 'apoiada', y1: 'apoiada' } });
  const t = tre.cargasTransmitidas(bal, ctx)['apoio-a'];
  assert.ok(Math.abs(t.t.q - (t.q * 1.2) / 2) < 1e-6, 'm = q·L²/2 = R·L/2');
  const mac = MODULOS_CALCULO['concreto.laje.macica'];
  const continua = novo(p, 'concreto.laje.macica', { id: 'c', bordas: { x0: 'engastada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' } });
  assert.equal(mac.cargasTransmitidas(continua, ctx).x0.t, undefined, 'engaste entre lajes é torção de compatibilidade: desprezada');
});

test('viga com laje em balanço: torção, estribos maiores e verificação combinada', () => {
  const p = criarProjeto();
  const laje = novo(p, 'concreto.laje.macica', { id: 'l', codigo: 'L1', lx: 1.5, ly: 4, bordas: { x0: 'engastada', x1: 'livre', y0: 'livre', y1: 'livre' } });
  p.elementos.push(laje);
  const sem = calcularElemento(novo(p, 'concreto.viga', { id: 'v0', vaos: [{ L: 4 }], cargas: [{ id: 'r', tipo: 'elemento', elementoId: 'l', ligacao: 'x0', vao: 'todos' }] }), p, registro);
  assert.ok(sem.vaos[0].torcao, 'torção presente');
  assert.ok(sem.vaos[0].estribos.asw > sem.vaos[0].estribos.aswV, 'estribos de torção somados');
  assert.ok(sem.verificacoes.some((v) => v.nome.startsWith('Torção + cortante')));
  assert.equal(sem.diagrama.Td.length, sem.diagrama.x.length);
  // viga sem torção não ganha campos de torção
  const r = calcularElemento(novo(p, 'concreto.viga', { id: 'v1' }), p, registro);
  assert.ok(!r.vaos[0].torcao);
  assert.equal(r.diagrama.Td, undefined);
});
