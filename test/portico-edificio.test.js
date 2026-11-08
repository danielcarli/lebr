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
/** Pórtico espacial do edifício (modules/comum/portico-edificio.js) e diafragma rígido no motor. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analisarPortico } from '../src/engine/portico.js';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento, contextoCalculo } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { porticoDoEdificio, porticoDoPilar } from '../src/modules/comum/portico-edificio.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const exemplo = () => lerProjeto(fs.readFileSync(new URL('./fixtures/edificio-3-pavimentos-sem-baldrame.lebr.json', import.meta.url), 'utf8'));

test('diafragma rígido: pavimento translada e gira como corpo rígido', () => {
  const nos = [], barras = [];
  [[0, 0], [6, 0], [6, 4], [0, 4]].forEach(([x, y], k) => {
    nos.push({ id: `B${k}`, x, y, z: 0, apoio: 'engaste' }, { id: `T${k}`, x, y, z: 3 });
    barras.push({ id: `P${k}`, i: `B${k}`, j: `T${k}`, secao: [20, 20] });
  });
  const sem = analisarPortico({ material: { fck: 25 }, nos, barras, cargas: [{ no: 'T0', Fx: 10 }] });
  const com = analisarPortico({ material: { fck: 25 }, nos, barras, cargas: [{ no: 'T0', Fx: 10 }], diafragmas: [{ nos: ['T0', 'T1', 'T2', 'T3'] }] });
  assert.ok(Math.abs(sem.reacao('B1').Fx) < 1e-9, 'sem diafragma só o pilar carregado trabalha');
  assert.ok(com.reacoes.every((r) => r.R[0] < -1), 'com diafragma todos os pilares recebem a força');
  const [u0, u1, u2] = ['T0', 'T1', 'T2'].map((id) => com.no(id));
  assert.ok(Math.abs(u0.ux - u1.ux) < 1e-6 && Math.abs(u0.rz - u2.rz) < 1e-7, 'mesma translação em x na linha y = 0 e mesmo giro');
  // giro em torno de z: ux(T2) − ux(T1) = −Δy·rz
  assert.ok(Math.abs((u2.ux - u1.ux) + 4 * u1.rz) < 1e-6);
  assert.ok(com.equilibrio.erro < 1e-6);
});

test('exemplo de 3 pavimentos: modelo, equilíbrio e prumadas', () => {
  const p = exemplo();
  const g = porticoDoEdificio(p, reg);
  assert.ok(!g.erro, g.erro);
  assert.equal(g.resultado.resumo.diafragmas, 3);
  assert.equal(g.pilares.size, 27);
  const t = g.totais;
  assert.ok(Math.abs(t.somaPavG - t.reacoesG) < 0.01 && Math.abs(t.somaPavQ - t.reacoesQ) < 0.01);
  assert.ok(Math.abs(t.cargasG - t.somaPavG) < 0.01);
  const pl = p.elementos.find((e) => e.codigo === 'P205');
  const pt = porticoDoPilar(pl, contextoCalculo(p, reg, [pl.id]));
  assert.deepEqual(pt.prumada.map((l) => l.codigo), ['P305', 'P205', 'P105']);
  assert.ok(pt.prumada[2].fundacao && !pt.prumada[0].fundacao);
  assert.ok(pt.prumada[2].calculo.Nd > pt.prumada[1].calculo.Nd);
});

test('pilar com pórtico: Nd e momentos do lance; sem pórtico, só comparação', () => {
  const p = exemplo();
  const el = p.elementos.find((e) => e.codigo === 'P101');
  const iso = calcularElemento(el, p, reg);
  assert.equal(iso.portico.usado, false);
  p.parametros.analiseGlobal = { pilares: 'portico' };
  const por = calcularElemento(el, p, reg);
  assert.equal(por.portico.usado, true);
  assert.equal(por.Nd, por.portico.NdPortico);
  assert.notEqual(por.Nd, iso.Nd);
  assert.ok(por.memorial.some((m) => m.titulo.startsWith('Pórtico espacial do edifício') && m.titulo.includes('usado')));
});
