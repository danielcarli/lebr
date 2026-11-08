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
/** Estacas: Aoki-Velloso e Décourt-Quaresma, influência do comprimento e do tipo, erros de entrada. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { criarEstaca } from '../src/modules/geotecnia-estaca/calculo.js';
import { soloDaCamada, TIPOS_ESTACA, geometriaEstaca } from '../src/engine/estacas.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const exemplo = () => lerProjeto(fs.readFileSync(new URL('./fixtures/edificio-3-pavimentos-sem-baldrame.lebr.json', import.meta.url), 'utf8'));
const calc = (p, ajuste = {}) => {
  const el = { id: 'ex', modulo: 'geotecnia.estaca', codigo: 'EX', nome: 'EX', ...criarEstaca(), local: { x: -1.5, y: -1.5 }, ...ajuste };
  p.elementos.push(el);
  try { return calcularElemento(el, p, reg); } finally { p.elementos.pop(); }
};

test('tabelas: solos, F1 da pré-moldada e geometria', () => {
  assert.equal(soloDaCamada({ solo: 'silte', secundario: 'arenoso' }).av, 'silte-arenoso');
  assert.equal(soloDaCamada({ solo: 'argila', secundario: 'siltoso' }).grupo, 'argila');
  assert.equal(soloDaCamada({ solo: 'aterro' }).semAtrito, true);
  assert.equal(soloDaCamada({ solo: 'pedregulho' }).dq, 'areia');
  assert.ok(Math.abs(TIPOS_ESTACA.premoldada.F1(0.4) - 1.5) < 1e-12);
  const q = geometriaEstaca({ secao: 'quadrada', D: 30 });
  assert.ok(Math.abs(q.U - 1.2) < 1e-12 && Math.abs(q.Ap - 0.09) < 1e-12);
});

test('a estaca mostra os dois métodos; comprimento e tipo mudam a capacidade', () => {
  const p = exemplo();
  const r6 = calc(p, { L: 6 }), r8 = calc(p, { L: 8 });
  for (const r of [r6, r8]) {
    assert.ok(!r.erro, r.erro);
    assert.ok(r.av.R > 0 && r.dq.R > 0 && r.Padm > 0);
    assert.ok(r.memorial.some((m) => /Aoki-Velloso/.test(m.titulo)) && r.memorial.some((m) => /Décourt-Quaresma/.test(m.titulo)));
  }
  assert.ok(r8.av.R > r6.av.R && r8.dq.R > r6.dq.R, 'mais comprida, mais capacidade');
  const pm = calc(p, { L: 8, tipo: 'premoldada', D: 40 });
  assert.notEqual(pm.av.R, r8.av.R);
  assert.ok(pm.Padm > r8.Padm, 'cravada sem o limite de ponta das escavadas');
  assert.ok(r8.curva.length >= 3 && r8.curva.some((c) => c.L === 8));
  // sem limite de ponta, a hélice sobe
  const livre = calc(p, { L: 8, limitarPonta: false });
  assert.ok(livre.av.Padm > r8.av.Padm);
});

test('carga de trabalho do pilar e comprimento mínimo', () => {
  const p = exemplo();
  const pl = p.elementos.find((e) => e.codigo === 'P109');
  const r = calc(p, { pilarId: pl.id, L: 6, tipo: 'premoldada', D: 40 });
  assert.ok(r.Nk > 0 && /P109/.test(r.origemCarga));
  assert.ok(r.verificacoes.some((v) => /Aoki-Velloso/.test(v.nome)));
  const muito = calc(p, { cargaTrabalho: 5000, L: 6 });
  assert.equal(muito.ok, false);
});

test('erros: ponta abaixo da sondagem e projeto sem furo', () => {
  const p = exemplo();
  assert.match(calc(p, { L: 30 }).erro, /sondagem/);
  p.elementos = p.elementos.filter((e) => e.modulo !== 'geotecnia.sondagem');
  assert.match(calc(p).erro, /furos de sondagem/);
});
