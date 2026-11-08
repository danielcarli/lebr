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
/** Exemplo do terminal de aeroporto: montagem sem problemas e todos os elementos atendendo. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { verificarConsistencia } from '../src/renderer/core/consistencia.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const ORDEM = { sondagens: -1, lajes: 0, escadas: 0.5, vigas: 1, pilares: 2, fundacoes: 3 };

test('terminal de aeroporto: níveis, malha de 9 m, sem problemas de montagem e tudo atende', () => {
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/terminal-aeroporto.lebr.json', import.meta.url), 'utf8'));
  assert.deepEqual([...p.pavimentos].sort((a, b) => a.cota - b.cota).map((x) => [x.nome, x.cota]), [['Térreo (baldrame)', 0], ['Embarque', 5], ['Cobertura', 10]]);
  const conta = (m) => p.elementos.filter((e) => e.modulo === m).length;
  assert.equal(conta('concreto.laje.nervurada'), 60, '28 no embarque (vazio do saguão) + 32 na cobertura');
  assert.equal(conta('concreto.pilar'), 135, '45 por nível, com os arranques');
  assert.deepEqual(verificarConsistencia(p, reg), []);
  const falhas = [];
  for (const e of [...p.elementos].sort((a, b) => (ORDEM[MODULOS_CALCULO[a.modulo].categoria] ?? 5) - (ORDEM[MODULOS_CALCULO[b.modulo].categoria] ?? 5))) {
    const r = calcularElemento(e, p, reg);
    e.resultado = r;
    if (r.erro || !r.ok) falhas.push(`${e.codigo}: ${r.erro ?? r.verificacoes.filter((v) => !v.ok).map((v) => v.nome).join(', ')}`);
  }
  assert.deepEqual(falhas, []);
});

test('aeroporto com terminal e satélite: terminal, conector e satélite sem problemas e tudo atende', () => {
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/aeroporto-terminal-satelite.lebr.json', import.meta.url), 'utf8'));
  assert.deepEqual([...p.pavimentos].sort((a, b) => a.cota - b.cota).map((x) => [x.nome, x.cota]), [['Térreo (baldrame)', 0], ['Embarque', 5], ['Cobertura', 10]]);
  const lajes = p.elementos.filter((e) => e.modulo === 'concreto.laje.nervurada');
  assert.equal(lajes.length, 91, 'terminal 21 + conector 6 + satélite 20 por nível, menos o vazio do saguão');
  assert.equal(lajes.filter((e) => /Conector/.test(e.nome)).length, 6);
  assert.deepEqual(verificarConsistencia(p, reg), []);
  const falhas = [];
  for (const e of [...p.elementos].sort((a, b) => (ORDEM[MODULOS_CALCULO[a.modulo].categoria] ?? 5) - (ORDEM[MODULOS_CALCULO[b.modulo].categoria] ?? 5))) {
    const r = calcularElemento(e, p, reg);
    e.resultado = r;
    if (r.erro || !r.ok) falhas.push(`${e.codigo}: ${r.erro ?? r.verificacoes.filter((v) => !v.ok).map((v) => v.nome).join(', ')}`);
  }
  assert.deepEqual(falhas, []);
});
