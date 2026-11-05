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
/** ELS de vigas: estádio II, abertura de fissuras (17.3.3.2), fluência (Tabela 17.1). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadioII, aberturaFissuras, alfaFluencia, xi, WK_LIMITE } from '../src/engine/fissuracao.js';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';

const registro = { obter: (id) => MODULOS_CALCULO[id] };
const base = { b: 20, h: 50, d: 45.9, cob: 3, phiT: 5, fctm: 2.565, eta1: 2.25 };

test('estádio II: equilíbrio da seção fissurada', () => {
  const { x, I } = estadioII({ b: 20, d: 45, As: 4, ae: 15 });
  assert.ok(Math.abs((20 * x * x) / 2 - 15 * 4 * (45 - x)) < 1e-6);
  assert.ok(I > 0);
});

test('Tabela 17.1: ξ e αf', () => {
  assert.equal(xi(1), 0.68);
  assert.equal(xi(70), 2);
  assert.equal(xi(100), 2);
  assert.ok(Math.abs(xi(1.5) - 0.76) < 1e-9, 'interpolação entre 1 e 2 meses');
  assert.ok(Math.abs(alfaFluencia(1).alfaF - 1.32) < 1e-12);
  assert.ok(alfaFluencia(1, 0.01).alfaF < alfaFluencia(1, 0).alfaF, 'armadura de compressão reduz αf');
});

test('Tabela 13.4: limites de wk', () => {
  assert.deepEqual(WK_LIMITE, { I: 0.4, II: 0.3, III: 0.3, IV: 0.2 });
});

test('wk cresce com o momento e cai com barras mais finas para a mesma área', () => {
  const w40 = aberturaFissuras({ ...base, Ms: 40, phi: 16, n: 2 }).wk;
  const w60 = aberturaFissuras({ ...base, Ms: 60, phi: 16, n: 2 }).wk;
  assert.ok(w60 > w40);
  // 2 ø 16 (4,02 cm²) × 5 ø 10 (3,93 cm²)
  const finas = aberturaFissuras({ ...base, Ms: 60, phi: 10, n: 5 }).wk;
  assert.ok(finas < w60, `ø 10: ${finas} < ø 16: ${w60}`);
});

test('viga: fissuras em vãos e apoios, flecha imediata + diferida e limite da carga acidental', () => {
  const p = criarProjeto();
  const el = { id: 'v', modulo: 'concreto.viga', codigo: 'V1', nome: 'V1', ...MODULOS_CALCULO['concreto.viga'].criar(p), vaos: [{ L: 5 }, { L: 5 }], apoios: ['apoio', 'apoio', 'apoio'] };
  const r = calcularElemento(el, p, registro);
  assert.ok(r.vaos[0].fissuras && r.apoios[1].fissuras, 'positiva e negativa');
  const fl = r.vaos[0].flecha;
  assert.ok(Math.abs(fl.ft - (fl.f0 + fl.fdif)) < 0.02);
  assert.ok(Math.abs(fl.fdif - fl.alfaF * fl.f0) < 0.02);
  assert.ok(fl.limQ > 0 && fl.fQ >= 0);
  assert.ok(r.verificacoes.some((v) => v.nome.startsWith('Abertura de fissuras')));
  // idade no carregamento maior → menos fluência
  const p3 = criarProjeto(); p3.parametros.els = { t0: 3 };
  const r3 = calcularElemento({ ...el }, p3, registro);
  assert.ok(r3.vaos[0].flecha.alfaF < fl.alfaF);
});
