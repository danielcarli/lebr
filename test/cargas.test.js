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
/** Catálogo de cargas da NBR 6120:2019 (engine/cargas.js) e compatibilidade com arquivos antigos. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALVENARIAS, CARGAS_USO, PESOS_ESPECIFICOS, pesoAlvenaria, cargaParede, cargaRevestimento, cargaUso,
  espessurasAlvenaria, revestimentosAlvenaria, COMPOSICAO_PADRAO,
} from '../src/engine/cargas.js';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';

const registro = { obter: (id) => MODULOS_CALCULO[id] };

test('Tabela 2: cada linha cresce cerca de 0,4 kN/m² por centímetro de revestimento por face', () => {
  for (const a of ALVENARIAS) {
    for (const [e, v] of Object.entries(a.espessuras)) {
      const vals = v.filter((x) => x != null);
      for (let i = 1; i < vals.length; i++) {
        const passo = vals[i] - vals[i - 1];
        assert.ok(passo >= 0.25 && passo <= 0.55, `${a.id} ${e} cm: passo ${passo.toFixed(2)} entre ${i - 1} e ${i} cm`);
      }
    }
    const esp = espessurasAlvenaria(a.id);
    const sem = esp.map((e) => a.espessuras[e][0]);
    for (let i = 1; i < sem.length; i++) assert.ok(sem[i] >= sem[i - 1], `${a.id}: peso deve crescer com a espessura`);
  }
});

test('ids únicos e valores positivos no catálogo', () => {
  for (const lista of [ALVENARIAS, CARGAS_USO, PESOS_ESPECIFICOS]) {
    const ids = lista.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length);
  }
  for (const u of CARGAS_USO) assert.ok(u.q > 0 && u.q <= 10, u.id);
  for (const m of PESOS_ESPECIFICOS) assert.ok(m.gama > 0 && m.gama < 100, m.id);
});

test('pesoAlvenaria e mensagens para valores fora da tabela', () => {
  assert.equal(pesoAlvenaria('ceramico-vedacao', 14, 1), 1.5);
  assert.equal(pesoAlvenaria('tijolo-macico', 11.5, 2), 2.9);
  assert.throws(() => pesoAlvenaria('ceramico-vedacao', 15, 1), /fora da Tabela 2/);
  assert.throws(() => pesoAlvenaria('vidro', 8, 1), /não traz valor/);
  assert.throws(() => pesoAlvenaria('xyz', 14, 1), /desconhecida/);
  assert.deepEqual(revestimentosAlvenaria('vidro', 8), [0]);
});

test('cargaParede: tabela, aberturas e formato antigo', () => {
  assert.equal(cargaParede({ material: 'ceramico-vedacao', espessura: 14, revestimento: 2, altura: 2.8 }).g.toFixed(4), (1.9 * 2.8).toFixed(4));
  assert.equal(cargaParede({ material: 'celular', espessura: 10, revestimento: 1, altura: 3, aberturas: 25 }).g.toFixed(4), (1.0 * 3 * 0.75).toFixed(4));
  const antiga = cargaParede({ espessura: 15, altura: 2.7, peso: 13 });
  assert.equal(antiga.g.toFixed(4), (13 * 0.15 * 2.7).toFixed(4));
  assert.equal(antiga.porArea, null);
  assert.ok(cargaParede({ material: 'concreto-vedacao', espessura: 19, revestimento: 1, altura: 3 }).conferir, 'valor marcado para conferir');
});

test('cargaRevestimento soma as camadas e respeita forro: false', () => {
  const c = { ...COMPOSICAO_PADRAO, forro: 'gesso-acartonado' };
  const com = cargaRevestimento(c);
  const sem = cargaRevestimento(c, { forro: false });
  assert.equal(+(com.total - sem.total).toFixed(3), 0.25);
  assert.equal(cargaRevestimento({ contrapiso: 0, piso: 'nenhum', teto: 'nenhum', forro: 'nenhum' }).total, 0);
});

test('cargaUso: valores da Tabela 10 mais usados em residências', () => {
  assert.equal(cargaUso('res-dormitorio').q, 1.5);
  assert.equal(cargaUso('res-servico').q, 2.0);
  assert.equal(cargaUso('res-corredor-comum').q, 3.0);
  assert.equal(cargaUso('varanda-res').q, 2.5);
  assert.equal(cargaUso('nao-existe'), null);
});

test('viga de arquivo antigo calcula igual; viga nova usa a Tabela 2', () => {
  const p = criarProjeto();
  const base = { id: 'v', modulo: 'concreto.viga', codigo: 'V1', nome: 'V1', ...MODULOS_CALCULO['concreto.viga'].criar(p), pesoProprio: false };
  const antiga = { ...base, cargas: [{ id: 'a', tipo: 'alvenaria', vao: 'todos', espessura: 15, altura: 2.7, peso: 13 }] };
  const r = calcularElemento(antiga, p, registro);
  assert.ok(Math.abs(r.apoios[0].Rg - (13 * 0.15 * 2.7 * 5) / 2) < 0.01, `Rg = ${r.apoios[0].Rg}`);
  const nova = MODULOS_CALCULO['concreto.viga'].criar(p).cargas.find((c) => c.tipo === 'alvenaria');
  assert.equal(nova.material, 'ceramico-vedacao');
});

test('lajes novas trazem o uso da Tabela 10 coerente com a carga acidental', () => {
  const p = criarProjeto();
  for (const id of ['concreto.laje.macica', 'concreto.laje.trelicada', 'madeira.entrepiso']) {
    const el = MODULOS_CALCULO[id].criar(p);
    assert.equal(cargaUso(el.cargas.uso).q, el.cargas.acidental, id);
  }
});
