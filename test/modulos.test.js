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
/**
 * Testes de integração dos módulos de concreto: laje → viga → pilar.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import * as viga from '../src/modules/concreto-viga/calculo.js';
import * as laje from '../src/modules/concreto-laje-macica/calculo.js';
import * as pilar from '../src/modules/concreto-pilar/calculo.js';

const registro = {
  mods: {
    'concreto.viga': { calcular: viga.calcularViga, cargasTransmitidas: viga.cargasTransmitidas },
    'concreto.laje.macica': { calcular: laje.calcularLaje, cargasTransmitidas: laje.cargasTransmitidas },
    'concreto.pilar': { calcular: pilar.calcularPilar, cargasTransmitidas: pilar.cargasTransmitidas },
  },
  obter(id) { return this.mods[id]; },
};

function projetoExemplo() {
  const p = criarProjeto({ nome: 'Teste' });
  p.elementos.push(
    { id: 'l1', modulo: 'concreto.laje.macica', codigo: 'L1', nome: 'L1', ...laje.criarLaje() },
    { id: 'v1', modulo: 'concreto.viga', codigo: 'V1', nome: 'V1', ...viga.criarViga() },
    { id: 'p1', modulo: 'concreto.pilar', codigo: 'P1', nome: 'P1', ...pilar.criarPilar() },
  );
  p.elementos[1].cargas.push({ id: 'c3', tipo: 'elemento', elementoId: 'l1', ligacao: 'y0', vao: 'todos' });
  p.elementos[2].cargas.push({ id: 'c2', tipo: 'elemento', elementoId: 'v1', ligacao: 'apoio-1' });
  return p;
}

test('laje 4×5 m apoiada: reações somam a carga total', () => {
  const p = projetoExemplo();
  const r = calcularElemento(p.elementos[0], p, registro);
  assert.ok(!r.erro, r.erro);
  const total = r.reacoes.reduce((s, x) => s + x.d * (x.id.startsWith('x') ? 5 : 4), 0);
  assert.ok(Math.abs(total - r.cargas.pd * 20) < 0.02 * r.cargas.pd * 20, `${total}`);
  assert.equal(r.umaDirecao, false);
});

test('viga recebe a reação da laje e dimensiona', () => {
  const p = projetoExemplo();
  const r = calcularElemento(p.elementos[1], p, registro);
  assert.ok(!r.erro, r.erro);
  assert.ok(r.vaos[0].positiva.barras, 'deve haver barras positivas');
  const Rtot = r.apoios.reduce((s, a) => s + a.Rg + a.Rq, 0);
  assert.ok(Rtot > 0);
  console.log('V1:', r.vaos[0].Mdpos, 'kN·m', r.vaos[0].positiva.barras.rotulo, r.vaos[0].estribos.rotulo, 'flecha', r.vaos[0].flecha);
});

test('pilar recebe a reação da viga', () => {
  const p = projetoExemplo();
  const r = calcularElemento(p.elementos[2], p, registro);
  assert.ok(!r.erro, r.erro);
  assert.ok(r.armadura, r.avisos.join(' '));
  console.log('P1:', r.Nd, 'kN', r.armadura.rotulo, 'λx', r.dirX.lambda, 'λy', r.dirY.lambda);
});

test('viga contínua com balanço e carga concentrada', () => {
  const p = projetoExemplo();
  const v = p.elementos[1];
  v.vaos = [{ L: 4 }, { L: 5 }, { L: 1.5 }];
  v.apoios = ['apoio', 'apoio', 'apoio', 'livre'];
  v.cargas.push({ id: 'c9', tipo: 'concentrada', natureza: 'g', vao: 2, posicao: 1.5, valor: 10 });
  const r = calcularElemento(v, p, registro);
  assert.ok(!r.erro, r.erro);
  assert.ok(r.apoios[2].Mdneg < 0);
  assert.ok(Math.abs(r.apoios[3].Mdneg) < 0.01, 'extremidade livre sem momento');
});

test('dependência circular é detectada', () => {
  const p = projetoExemplo();
  p.elementos[0].cargas = p.elementos[0].cargas; // laje não recebe cargas de elementos
  p.elementos[1].cargas.push({ id: 'cx', tipo: 'elemento', elementoId: 'v1', ligacao: 'apoio-0', vao: 0 });
  const r = calcularElemento(p.elementos[1], p, registro);
  assert.match(r.erro, /circular/);
});

test('projetos do OpenLabViga (formato antigo) continuam abrindo', async () => {
  const { lerProjeto, serializar, FORMATO } = await import('../src/renderer/core/projeto.js');
  const antigo = { formato: 'openlabviga.projeto', versao: 1, meta: { nome: 'Antigo' }, parametros: {}, elementos: [] };
  const p = lerProjeto(JSON.stringify(antigo));
  assert.equal(p.formato, FORMATO);
  assert.equal(FORMATO, 'lebr.projeto');
  assert.match(serializar(p), /"formato": "lebr.projeto"/);
  assert.throws(() => lerProjeto(JSON.stringify({ formato: 'outro' })), /LEBR/);
});
