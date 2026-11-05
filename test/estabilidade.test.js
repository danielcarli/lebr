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
/** Estabilidade global: desaprumo, α, γz, rigidez reduzida (fatorEI) e majoração por 0,95·γz. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { desaprumo, acaoHorizontal, alfa1, classificarGamaZ, gamaZ } from '../src/engine/estabilidade.js';
import { analisarPortico } from '../src/engine/portico.js';
import { majorarHorizontais, casosGlobais, gerarCombinacoes, coeficientesAcoes } from '../src/engine/combinacoes.js';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { porticoDoEdificio } from '../src/modules/comum/portico-edificio.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const exemplo = () => lerProjeto(fs.readFileSync(new URL('./fixtures/edificio-3-pavimentos-sem-baldrame.lebr.json', import.meta.url), 'utf8'));
const secoes = (p, b, h) => { for (const e of p.elementos) if (e.modulo === 'concreto.pilar') { e.bx = b; e.by = h; } };

test('desaprumo: limites de θ1 e efeito do número de pilares', () => {
  assert.equal(desaprumo({ H: 100, n: 1 }).theta1, 1 / 300);
  assert.equal(desaprumo({ H: 1, n: 1 }).theta1, 1 / 200);
  assert.ok(desaprumo({ H: 9, n: 20 }).thetaA < desaprumo({ H: 9, n: 2 }).thetaA);
  assert.throws(() => desaprumo({ H: 0, n: 1 }));
  assert.equal(acaoHorizontal(0, 50), 'desaprumo');
  assert.equal(acaoHorizontal(50, 0), 'vento');
  assert.equal(alfa1(1), 0.3);
  assert.equal(alfa1(5, 'misto'), 0.6);
  assert.deepEqual(classificarGamaZ(1.05), { classe: 'fixos', fator: 1 });
  assert.equal(classificarGamaZ(1.2).classe, 'moveis');
  assert.equal(classificarGamaZ(1.35).classe, 'excede');
  assert.equal(gamaZ({ M1: 10, dM: 12 }).classe, 'instavel');
});

test('fatorEI reduz a rigidez à flexão e aumenta o deslocamento na mesma proporção', () => {
  const m = (f) => analisarPortico({ material: { E: 2e7 }, nos: [{ id: 'A', x: 0, y: 0, z: 0, apoio: 'engaste' }, { id: 'B', x: 0, y: 0, z: 3 }],
    barras: [{ id: 'P', i: 'A', j: 'B', secao: [30, 30], fatorEI: f }], cargas: [{ no: 'B', Fx: 10 }] });
  assert.ok(Math.abs(m(0.5).no('B').ux / m(1).no('B').ux - 2) < 1e-9);
  assert.throws(() => m(0));
});

test('majoração por 0,95·γz só nas combinações últimas e só nos casos horizontais indicados', () => {
  const par = { vento: { ativo: true } };
  const casos = casosGlobais(par);
  const k = coeficientesAcoes(par);
  const combs = gerarCombinacoes(casos, k);
  const maj = majorarHorizontais(combs, casos, { V1: 1.1, V3: 1.1 });
  const a = combs.find((c) => c.id === 'ELU2'), b = maj.find((c) => c.id === 'ELU2');
  assert.ok(Math.abs(b.fatores.V1 - 1.4 * 1.1) < 1e-9 && b.fatores.G === a.fatores.G && b.fatores.Q === a.fatores.Q);
  assert.equal(maj.find((c) => c.id === 'ELU4').fatores.V2, 1.4, 'V2 não muda');
  assert.equal(maj.find((c) => c.id === 'RARA2').fatores.V1, 1, 'serviço não muda');
});

test('exemplo de 3 pavimentos: α e γz nas duas direções; pilares maiores reduzem γz', () => {
  const p = exemplo();
  const g = porticoDoEdificio(p, reg);
  const e = g.estabilidade;
  for (const d of ['x', 'y']) {
    assert.ok(e[d].alfa > 0 && e[d].gz > 1 && e[d].gz < 1.3, `${d}: α ${e[d].alfa} γz ${e[d].gz}`);
    assert.equal(e[d].acao, 'desaprumo');
  }
  assert.equal(e.nNiveis, 3);
  const q = exemplo();
  secoes(q, 30, 40);
  const e2 = porticoDoEdificio(q, reg).estabilidade;
  assert.ok(e2.x.gz < e.x.gz && e2.y.gz < e.y.gz, 'seções maiores, γz menor');
  assert.ok(e2.x.alfa < e.x.alfa);
  // rigidez simplificada 0,7 nos pilares e vigas: γz diferente da separada
  const s = exemplo();
  s.parametros.estabilidade = { ...s.parametros.estabilidade, rigidez: 'simplificada' };
  assert.notEqual(porticoDoEdificio(s, reg).estabilidade.x.gz, e.x.gz);
});

test('edifício esbelto: γz acima de 1,3 gera aviso, também no pilar', () => {
  const p = exemplo();
  p.parametros.vento.ativo = true;
  p.parametros.analiseGlobal = { pilares: 'portico' };
  secoes(p, 14, 14);
  const g = porticoDoEdificio(p, reg);
  assert.ok(g.estabilidade.x.gz > 1.3);
  assert.ok(g.estabilidade.avisos.some((a) => /1,3/.test(a)));
  assert.ok(g.combinacoes.some((c) => c.majorada));
  const pil = p.elementos.find((x) => x.codigo === 'P101');
  const r = calcularElemento(pil, p, reg);
  assert.ok(r.avisos.some((a) => /γz/.test(a)), 'o pilar mostra o aviso');
  assert.ok(r.portico.estabilidade.x.fator > 1);
});

test('sem desaprumo e sem vento não há casos horizontais (como antes da 0.19)', () => {
  const p = exemplo();
  p.parametros.estabilidade = { desaprumo: false };
  const g = porticoDoEdificio(p, reg);
  assert.equal(g.horizontais.casos, false);
  assert.equal(g.combinacoes.length, 7);
  assert.ok(g.estabilidade.x.gz > 1, 'γz avaliado com a distribuição do desaprumo');
  assert.ok(!g.resultado.casos.includes('V1'));
});
