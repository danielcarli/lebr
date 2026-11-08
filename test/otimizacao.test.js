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
/** Otimização das bitolas por elemento: menos bitolas diferentes e menos aço. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { medirAco, criterioDe } from '../src/modules/comum/otimizacao.js';
import { BITOLAS_USO } from '../src/engine/barras.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const ordem = { sondagens: -1, lajes: 0, escadas: 0.5, reservatorios: 0.6, vigas: 1, pilares: 2, fundacoes: 3 };
function calculado() {
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-3-pavimentos.lebr.json', import.meta.url), 'utf8'));
  for (const e of [...p.elementos].sort((a, b) => (ordem[MODULOS_CALCULO[a.modulo].categoria] ?? 5) - (ordem[MODULOS_CALCULO[b.modulo].categoria] ?? 5))) e.resultado = calcularElemento(e, p, reg);
  return p;
}
const p = calculado();
const el = (cod) => p.elementos.find((e) => e.codigo === cod);
const comCriterio = (e, c, extra = {}) => calcularElemento({ ...e, otimizacao: c, ...extra }, p, reg);

test('sem critério nada muda; critério só vale para módulos que aceitam otimização', () => {
  const v = el('V201');
  assert.equal(criterioDe(v), null);
  assert.equal(calcularElemento(v, p, reg).otimizacao, undefined);
  assert.equal(criterioDe({ modulo: 'concreto.viga', otimizacao: 'aco' }), 'aco');
  assert.equal(criterioDe({ modulo: 'concreto.laje.trelicada', otimizacao: 'aco' }), null);
  assert.equal(criterioDe({ modulo: 'concreto.viga', otimizacao: 'qualquer' }), null);
});

test('menos bitolas: nunca mais bitolas que o automático, todas as verificações atendidas e medida igual aos quantitativos', () => {
  for (const cod of ['V201', 'V104', 'P101', 'L101']) {
    const e = el(cod);
    const arm = JSON.stringify(e.armadura);
    const r = comCriterio(e, 'bitolas');
    const o = r.otimizacao;
    assert.equal(r.ok, true, cod);
    assert.ok(o.bitolas.length <= o.base.bitolas.length, `${cod}: ${o.bitolas} × ${o.base.bitolas}`);
    const m = medirAco(e, r, p);
    assert.deepEqual(m.bitolas, o.bitolas, cod);
    assert.ok(Math.abs(m.kg - o.kg) < 0.01, cod);
    assert.equal(JSON.stringify(e.armadura), arm, `${cod}: o elemento original não é alterado`);
    assert.ok(r.memorial.some((b) => b.titulo.startsWith('Otimização das bitolas')));
  }
  // a viga de exemplo cai de 4 para 2 bitolas
  const o = comCriterio(el('V201'), 'bitolas').otimizacao;
  assert.ok(o.bitolas.length < o.base.bitolas.length && o.melhorou);
});

test('menos aço: nunca mais pesado que o automático', () => {
  for (const cod of ['V201', 'V104', 'P205', 'L101', 'L102', 'ES1']) {
    const r = comCriterio(el(cod), 'aco');
    const o = r.otimizacao;
    assert.equal(r.ok, true, cod);
    assert.ok(o.kg <= o.base.kg + 1e-9, `${cod}: ${o.kg} > ${o.base.kg}`);
  }
  // na laje, o automático (posição por posição) não é o mais leve
  const o = comCriterio(el('L101'), 'aco').otimizacao;
  assert.ok(o.kg < o.base.kg - 1);
});

test('busca exaustiva da laje: coincide com a melhor de todas as combinações calculadas uma a uma', () => {
  const e = el('L101');
  const opcoes = ['auto', ...BITOLAS_USO.laje];
  let melhorKg = Infinity;
  for (const i of opcoes) for (const s of opcoes) {
    const r = calcularElemento({ ...e, armadura: { inferior: i, superior: s } }, p, reg);
    if (!r.erro && r.ok !== false) melhorKg = Math.min(melhorKg, medirAco(e, r, p).kg);
  }
  assert.ok(Math.abs(comCriterio(e, 'aco').otimizacao.kg - Math.round(melhorKg * 100) / 100) < 0.01);
});

test('bitola escolhida pelo usuário fica como está', () => {
  const e = el('V201');
  const r = comCriterio(e, 'bitolas', { armadura: { inferior: 'auto', superior: 'auto', estribo: 6.3 } });
  const o = r.otimizacao;
  assert.ok(!('estribo' in o.escolha));
  assert.equal(o.fixadas.estribo, 6.3);
  assert.ok(o.bitolas.includes(6.3));
  assert.ok(r.detalhamento.posicoes.filter((q) => q.tipo === 'estribo').every((q) => q.phi === 6.3));
});

test('sem combinação que atenda: mantém o cálculo automático e avisa', () => {
  const e = { ...el('V201'), secao: { ...el('V201').secao, h: 18 } };
  const r = calcularElemento({ ...e, otimizacao: 'aco' }, p, reg);
  assert.equal(r.otimizacao.semAlternativa, true);
  assert.equal(r.otimizacao.melhorou, false);
  assert.equal(r.ok, false);
});

test('menos segmentos: menos peças que o automático, dentro do acréscimo de aço aceito', () => {
  for (const cod of ['V104', 'V001', 'P205', 'L101', 'ES1']) {
    const r = comCriterio(el(cod), 'segmentos');
    const o = r.otimizacao;
    assert.equal(r.ok, true, cod);
    assert.equal(o.limiteAco, 10);
    assert.ok(o.segmentos < o.base.segmentos, `${cod}: ${o.segmentos} × ${o.base.segmentos}`);
    assert.ok(o.kg <= o.base.kg * 1.1 + 1e-6, `${cod}: ${o.kg} > 1,1 × ${o.base.kg}`);
  }
  // um acréscimo maior permite cortar mais segmentos; 0 % não deixa passar nada mais pesado
  const v = el('V104');
  const o10 = comCriterio(v, 'segmentos').otimizacao, o25 = comCriterio(v, 'segmentos', { otimizacaoLimiteAco: 25 }).otimizacao;
  assert.ok(o25.segmentos <= o10.segmentos && o25.kg <= o25.base.kg * 1.25 + 1e-6);
  const o0 = comCriterio(v, 'segmentos', { otimizacaoLimiteAco: 0 }).otimizacao;
  assert.ok(o0.kg <= o0.base.kg + 1e-6);
});

test('segmentos de barra: barras acima de 12 m contam uma peça por emenda', async () => {
  const { quantitativosDoElemento } = await import('../src/modules/comum/quantitativos.js');
  const v = el('V201');
  const q = quantitativosDoElemento(v, v.resultado, p);
  const esperado = v.resultado.detalhamento.posicoes.reduce((s, x) => s + x.n * ((x.emendas ?? 0) + 1), 0);
  assert.equal(Object.values(q.pecas).reduce((s, x) => s + x, 0), esperado);
  const { segmentosPorBarra } = await import('../src/modules/comum/quantitativos.js');
  assert.equal(segmentosPorBarra(11.9, 0), 1);
  assert.equal(segmentosPorBarra(12, 0), 1);
  assert.equal(segmentosPorBarra(12.5, 0), 2);   // malha mais longa que a barra comercial
  assert.equal(segmentosPorBarra(24.6, 1), 2);   // detalhamento: 1 emenda (o comprimento já inclui o traspasse)
  assert.equal(segmentosPorBarra(30, 2), 3);
});
