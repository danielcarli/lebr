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
/** Casos de carga e combinações (engine/combinacoes.js) e envoltória nas vigas. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PSI_USO, coeficientesAcoes, casosPadrao, gerarCombinacoes, envolvente, extremo, combinar, doTipo, expressao } from '../src/engine/combinacoes.js';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';

const registro = { obter: (id) => MODULOS_CALCULO[id] };

test('ψ da Tabela 11.2 por uso e preenchimento a partir de arquivos antigos', () => {
  assert.deepEqual([PSI_USO.residencial.psi0, PSI_USO.residencial.psi1, PSI_USO.residencial.psi2], [0.5, 0.4, 0.3]);
  assert.deepEqual([PSI_USO.comercial.psi0, PSI_USO.comercial.psi1, PSI_USO.comercial.psi2], [0.7, 0.6, 0.4]);
  assert.deepEqual([PSI_USO.garagem.psi0, PSI_USO.garagem.psi1, PSI_USO.garagem.psi2], [0.8, 0.7, 0.6]);
  // arquivo até a 0.9: só psi2 e o uso
  const k = coeficientesAcoes({ uso: 'comercial', coeficientes: { gg: 1.4, gq: 1.4, psi2: 0.4 } });
  assert.equal(k.psi0, 0.7); assert.equal(k.psi1, 0.6); assert.equal(k.ggFav, 1.0);
});

test('combinações de G e Q: ids, fatores e expressões', () => {
  const c = gerarCombinacoes(casosPadrao(coeficientesAcoes({ uso: 'residencial' })));
  assert.deepEqual(c.map((x) => x.id), ['ELU1', 'ELU2', 'ELU3', 'ELU4', 'QP', 'FREQ1', 'RARA1']);
  assert.equal(c[0].expressao, '1,4·G + 1,4·Q');
  assert.equal(c[3].expressao, 'G');
  assert.equal(c.find((x) => x.id === 'QP').expressao, 'G + 0,3·Q');
  assert.equal(doTipo(c, 'ELU').length, 4);
});

test('sem variáveis não repete combinações; γg favorável igual ao desfavorável colapsa', () => {
  const so = gerarCombinacoes([{ id: 'G', nome: 'G', tipo: 'permanente' }]);
  assert.deepEqual(so.map((x) => x.id), ['ELU1', 'ELU2', 'QP', 'RARA1']);
  const igual = gerarCombinacoes(casosPadrao(coeficientesAcoes()), { gg: 1.4, ggFav: 1.4, gq: 1.4 });
  assert.equal(doTipo(igual, 'ELU').length, 2);
});

test('envolvente e extremo', () => {
  const c = doTipo(gerarCombinacoes(casosPadrao(coeficientesAcoes())), 'ELU');
  const env = envolvente(c, { G: [10, -5], Q: [-4, 3] });
  assert.equal(+env.max[0].toFixed(6), 14); // 1,4·10 (Q favorável omitida)
  assert.equal(env.combMax[0], 'ELU3');
  assert.equal(+env.min[1].toFixed(6), -7); // 1,4·(−5)
  assert.equal(+env.max[1].toFixed(6), -0.8); // 1,0·(−5) + 1,4·3
  assert.equal(extremo(c, { G: 100, Q: 50 }).id, 'ELU1');
  assert.equal(combinar({ G: 1.4, Q: 1.4 }, { G: 1, Q: 2 }).toFixed(2), '4.20');
  assert.equal(expressao({ G: 1, Q: 0.3 }, casosPadrao(coeficientesAcoes())), 'G + 0,3·Q');
});

test('viga mostra a combinação que governa cada esforço', () => {
  const p = criarProjeto();
  const el = { id: 'v', modulo: 'concreto.viga', codigo: 'V1', nome: 'V1', ...MODULOS_CALCULO['concreto.viga'].criar(p) };
  const r = calcularElemento(el, p, registro);
  assert.ok(r.combinacoes.length >= 7);
  assert.equal(r.vaos[0].comb.Mdpos, 'ELU1');
  assert.equal(r.apoios[0].comb.Rd, 'ELU1');
  assert.equal(r.diagrama.MdMin.length, r.diagrama.Md.length);
  assert.ok(r.casos.some((c) => c.id === 'G1'), 'peso próprio separado');
  assert.ok(r.memorial.some((m) => m.titulo.startsWith('Combinações')));
});

test('pilar e viga de madeira trazem as combinações', () => {
  const p = criarProjeto();
  const pil = calcularElemento({ id: 'p', modulo: 'concreto.pilar', codigo: 'P1', nome: 'P1', ...MODULOS_CALCULO['concreto.pilar'].criar(p) }, p, registro);
  assert.equal(pil.comb.Nd, 'ELU1');
  const vm = calcularElemento({ id: 'm', modulo: 'madeira.viga', codigo: 'VM1', nome: 'VM1', ...MODULOS_CALCULO['madeira.viga'].criar(p) }, p, registro);
  assert.equal(vm.comb.MdPos, 'ELU1');
  assert.ok(vm.combinacoes.find((c) => c.id === 'ELU1').expressao.includes('1,5·Q'), 'γq da madeira');
});
