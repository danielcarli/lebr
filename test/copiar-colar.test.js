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
/** Copiar, colar e duplicar na montagem (0.66): elementos e eixos. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { copiaDoElemento, copiaDoEixo, colarElemento, colarEixo } from '../src/renderer/core/copiar-colar.js';
import { listaEixos, criarEixo } from '../src/renderer/core/eixos.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';

const abrir = (arq) => lerProjeto(fs.readFileSync(new URL(`../exemplos/${arq}`, import.meta.url), 'utf8'));

test('copiar e colar: viga com código novo, deslocada, sem as ligações do original, e calcula', () => {
  const p = abrir('edificio-exemplo.lebr.json');
  const v = p.elementos.find((e) => e.modulo === 'concreto.viga' && e.cargas?.some((c) => c.tipo === 'elemento'));
  const c = copiaDoElemento(v);
  assert.ok(c && !c.el.resultado);
  const n0 = p.elementos.length;
  const { el, ligacoesRemovidas } = colarElemento(p, c, { dx: 1, dy: -2 });
  assert.equal(p.elementos.length, n0 + 1);
  assert.notEqual(el.id, v.id); assert.notEqual(el.codigo, v.codigo);
  assert.ok(!p.elementos.some((e) => e !== el && e.codigo === el.codigo), 'código único');
  assert.equal(el.posicao.x, (v.posicao.x ?? 0) + 1); assert.equal(el.posicao.y, (v.posicao.y ?? 0) - 2);
  assert.ok(ligacoesRemovidas > 0 && !el.cargas.some((x) => x.tipo === 'elemento'));
  assert.ok(v.cargas.some((x) => x.tipo === 'elemento'), 'o original fica como estava');
  // colar de novo dá outro código
  const b = colarElemento(p, c, { dx: 2 }).el;
  assert.notEqual(b.codigo, el.codigo);
  const r = calcularElemento(el, p, { obter: (id) => MODULOS_CALCULO[id] });
  assert.ok(!r.erro, r.erro);
});

test('copiar e colar: pilar em outro pavimento ganha o pé-direito dele; fundação presa ao pilar não é copiada', () => {
  const p = abrir('edificio-exemplo.lebr.json');
  const pil = p.elementos.find((e) => e.modulo === 'concreto.pilar' && e.posicao);
  const { el } = colarElemento(p, copiaDoElemento(pil), { pavimento: 'outro', peDireito: 3.4 });
  assert.equal(el.posicao.pavimento, 'outro'); assert.equal(el.comprimento, 3.4);
  assert.equal(copiaDoElemento({ id: 's', codigo: 'S1', modulo: 'concreto.sapata', pilarId: pil.id, posicao: { x: 0, y: 0 } }), null);
  assert.equal(copiaDoElemento({ id: 'x', codigo: 'P9', modulo: 'concreto.pilar' }), null, 'sem posição não copia');
});

test('copiar e colar eixo: paralelo pelo ponto ou deslocado na normal', () => {
  const p = { elementos: [] };
  const a = criarEixo(p, [2, 0], 90);
  const c = copiaDoEixo(listaEixos(p).find((e) => e.id === a));
  const b = colarEixo(p, c, { ponto: [5.5, 3] });
  const d = colarEixo(p, c, { desloc: 0.4 });
  const l = listaEixos(p);
  const eb = l.find((e) => e.id === b), ed = l.find((e) => e.id === d);
  assert.equal(eb.tipo, 'vertical'); assert.equal(eb.p[0], 5.5);
  assert.equal(ed.tipo, 'vertical'); assert.ok(Math.abs(Math.abs(ed.d - l.find((e) => e.id === a).d) - 0.4) < 1e-9);
});

test('copiar e colar: o código segue a numeração do original', async () => {
  const { proximoCodigoApos } = await import('../src/renderer/core/copiar-colar.js');
  const p = { elementos: [{ codigo: 'P210' }, { codigo: 'P211' }, { codigo: 'VB001' }, { codigo: 'L1' }] };
  assert.equal(proximoCodigoApos(p, 'P210'), 'P212');
  assert.equal(proximoCodigoApos(p, 'VB001'), 'VB002');
  assert.equal(proximoCodigoApos(p, 'L1'), 'L2');
  assert.equal(proximoCodigoApos(p, 'X'), 'X1');
});
