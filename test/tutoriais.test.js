/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Opus 5.5, sob a orientação de Daniel Michelon De Carli.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/** Tutoriais: o PDF está na pasta e o projeto do tutorial 1 monta sem problemas e atende. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { verificarConsistencia } from '../src/renderer/core/consistencia.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const ORDEM = { sondagens: -1, lajes: 0, escadas: 0.5, vigas: 1, pilares: 2, fundacoes: 3 };

test('tutorial 1: PDF na pasta tutoriais e a casa térrea calculada sem pendências', () => {
  assert.ok(fs.statSync(new URL('../tutoriais/01-casa-terrea.pdf', import.meta.url)).size > 100000);
  const p = lerProjeto(fs.readFileSync(new URL('../tutoriais/casa-terrea.lebr.json', import.meta.url), 'utf8'));
  const conta = (m) => p.elementos.filter((e) => e.modulo === m).length;
  assert.deepEqual([conta('concreto.pilar'), conta('concreto.viga'), conta('concreto.laje.macica'), conta('concreto.sapata')], [12, 10, 2, 6]);
  assert.deepEqual(verificarConsistencia(p, reg).filter((x) => x.gravidade === 'erro'), []);
  const falhas = [];
  for (const e of [...p.elementos].sort((a, b) => (ORDEM[MODULOS_CALCULO[a.modulo].categoria] ?? 5) - (ORDEM[MODULOS_CALCULO[b.modulo].categoria] ?? 5))) {
    const r = calcularElemento(e, p, reg);
    e.resultado = r;
    if (r.erro || !r.ok) falhas.push(e.codigo);
  }
  assert.deepEqual(falhas, []);
});
