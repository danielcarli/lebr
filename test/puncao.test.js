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
/** Punção (NBR 6118:2023, 19.5): motor e laje maciça com cargas concentradas. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perimetro, verificarPuncao, fywdPuncao, coeficienteK } from '../src/engine/puncao.js';
import { posicoesConectores } from '../src/modules/comum/puncao.js';
import { concreto, aco } from '../src/engine/materiais.js';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';

const registro = { obter: (id) => MODULOS_CALCULO[id] };
const c = concreto(25), s = aco(500);

function laje(extra) {
  const p = criarProjeto({ nome: 't' });
  const el = { id: 'l', modulo: 'concreto.laje.macica', codigo: 'L1', nome: 'L1', ...MODULOS_CALCULO['concreto.laje.macica'].criar(p), ...extra };
  p.elementos.push(el);
  return calcularElemento(el, p, registro);
}

test('perímetros: borda e canto limitados por 1,5d e 0,5c', () => {
  assert.equal(perimetro({ posicao: 'borda', c1: 60, c2: 30, d: 10, r: 0 }).a1, 15, 'a = 1,5d');
  assert.equal(perimetro({ posicao: 'borda', c1: 20, c2: 30, d: 10, r: 0 }).a1, 10, 'a = 0,5·c1');
  const cn = perimetro({ posicao: 'canto', c1: 20, c2: 50, d: 10, r: 0 });
  assert.deepEqual([cn.a1, cn.a2], [10, 15]);
  assert.ok(Math.abs(perimetro({ posicao: 'interna', c1: 20, c2: 20, d: 10, r: 20 }).u - (80 + 40 * Math.PI)) < 1e-9);
});

test('fywd da armadura de punção e coeficiente K', () => {
  assert.equal(fywdPuncao(15), 250);
  assert.equal(fywdPuncao(35), 435);
  assert.ok(Math.abs(fywdPuncao(25) - 342.5) < 1e-9);
  assert.equal(coeficienteK(0.4, 1), 0.45);
  assert.equal(coeficienteK(4, 1), 0.8);
});

test('sem armadura quando C\' atende; com armadura e C\'\' quando não', () => {
  const leve = verificarPuncao({ FSd: 50, posicao: 'interna', c1: 20, c2: 20, d: 12, h: 15, rho: 0.005, c, s });
  assert.equal(leve.armadura, null);
  assert.ok(leve.ok && leve.C1.dispensa);
  const pesado = verificarPuncao({ FSd: 300, posicao: 'interna', c1: 20, c2: 20, d: 14, h: 18, rho: 0.006, c, s });
  assert.ok(pesado.armadura, 'precisa de armadura');
  assert.ok(pesado.armadura.Asw >= pesado.armadura.AswNec);
  assert.ok(pesado.C1.tauRd >= pesado.C1.tauSd, 'τRd3 cobre τSd');
  assert.ok(pesado.C2.ok && pesado.C2.tauSd <= pesado.tauRd1);
  assert.ok(pesado.armadura.linhas >= 8);
  assert.ok(pesado.ok);
});

test('momento transferido aumenta τSd no pilar interno', () => {
  const sem = verificarPuncao({ FSd: 200, posicao: 'interna', c1: 30, c2: 30, d: 15, h: 18, rho: 0.008, c, s });
  const com = verificarPuncao({ FSd: 200, MSd: 30, posicao: 'interna', c1: 30, c2: 30, d: 15, h: 18, rho: 0.008, c, s });
  assert.ok(com.C1.tauSd > sem.C1.tauSd);
  assert.equal(com.K, 0.6);
});

test('laje com armadura de punção e h < 16 cm não atende', () => {
  const r = verificarPuncao({ FSd: 160, posicao: 'interna', c1: 20, c2: 20, d: 9, h: 12, rho: 0.004, c, s });
  assert.ok(r.armadura);
  assert.equal(r.ok, false);
  assert.ok(r.avisos.some((a) => a.includes('16 cm')));
});

test('conectores: linhas × contornos posições', () => {
  const r = verificarPuncao({ FSd: 300, posicao: 'borda', c1: 25, c2: 30, d: 14, h: 18, rho: 0.006, c, s });
  const p = { posicao: 'borda', c1: 25, c2: 30, d: r.d, armadura: r.armadura };
  assert.equal(posicoesConectores(p).length, r.armadura.linhas * r.armadura.contornos);
});

test('laje maciça: punção nas cargas concentradas', () => {
  const sem = laje({});
  assert.deepEqual(sem.puncao, []);
  const r = laje({ cargasConcentradas: [{ id: 'a', posicao: 'interna', c1: 20, c2: 20, g: 20, q: 10, phi: 'auto' }] });
  assert.equal(r.puncao.length, 1);
  assert.equal(r.puncao[0].FSd, 42);
  assert.ok(r.verificacoes.some((v) => v.nome.startsWith('Punção P1 — contorno C ')));
  assert.ok(r.memorial.some((m) => m.titulo.startsWith('Punção P1')));
  // reduzir a espessura e aumentar a carga passa a exigir armadura de punção
  const fina = laje({ h: 12, cargasConcentradas: [{ id: 'a', posicao: 'interna', c1: 20, c2: 20, g: 80, q: 40, phi: 'auto' }] });
  assert.ok(fina.puncao[0].armadura);
  assert.equal(fina.ok, false, 'h < 16 cm com armadura de punção');
  const grossa = laje({ h: 22, cargasConcentradas: [{ id: 'a', posicao: 'interna', c1: 20, c2: 20, g: 80, q: 40, phi: 'auto' }] });
  assert.equal(grossa.puncao[0].armadura, null);
});
