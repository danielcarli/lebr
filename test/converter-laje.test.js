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
/** Converter laje (0.65): o contorno, as bordas e as cargas ficam; as ligações com as vigas são refeitas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { converterLaje, tiposParaConverter, TIPOS_LAJE } from '../src/renderer/core/converter-laje.js';
import { cantosLaje, detectarLigacoes } from '../src/renderer/core/montagem.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { calcularProjeto } from '../src/validacao/caminho-cargas.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const abrir = (arq) => lerProjeto(fs.readFileSync(new URL(`../exemplos/${arq}`, import.meta.url), 'utf8'));
const cantos = (el) => cantosLaje(el).map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);

test('converter laje: a lista oferece os outros três tipos', () => {
  assert.equal(TIPOS_LAJE.length, 4);
  assert.deepEqual(tiposParaConverter({ modulo: 'concreto.laje.macica' }, reg).map((t) => t.modulo), ['concreto.laje.trelicada', 'concreto.laje.nervurada', 'concreto.laje.alveolar']);
});

test('converter laje: maciça → treliçada → nervurada → alveolar → maciça mantém contorno, código e cargas, e calcula', () => {
  const p = abrir('edificio-exemplo.lebr.json');
  const laje = p.elementos.find((e) => e.modulo === 'concreto.laje.macica' && e.posicao);
  const c0 = cantos(laje), cod = laje.codigo, rev = laje.cargas.revestimento, acid = laje.cargas.acidental;
  const nLig = (pp) => pp.elementos.reduce((s, e) => s + (Array.isArray(e.cargas) ? e.cargas.filter((c) => c?.tipo === 'elemento' && c.elementoId === laje.id).length : 0), 0);
  const antes = nLig(p);
  assert.ok(antes > 0);
  for (const m of ['concreto.laje.trelicada', 'concreto.laje.nervurada', 'concreto.laje.alveolar', 'concreto.laje.macica']) {
    const r = converterLaje(p, laje.id, m, reg);
    const el = p.elementos.find((e) => e.id === laje.id);
    assert.equal(el.modulo, m);
    assert.equal(el.codigo, cod);
    assert.deepEqual(cantos(el), c0, `contorno em ${m}`);
    assert.equal(el.cargas.revestimento, rev); assert.equal(el.cargas.acidental, acid);
    assert.ok(!el.resultado, 'resultado limpo');
    assert.ok(r.ligacoes > 0, `ligações refeitas em ${m}`);
    // nenhuma carga aponta para borda que o tipo novo não tem
    const ids = new Set(reg.obter(m).ligacoes(el).map((l) => l.id));
    for (const e of p.elementos) for (const c of Array.isArray(e.cargas) ? e.cargas : []) if (c?.tipo === 'elemento' && c.elementoId === laje.id) assert.ok(ids.has(c.ligacao), `${e.codigo}: ${c.ligacao} em ${m}`);
  }
  // de volta à maciça: as mesmas ligações de antes
  assert.equal(nLig(p), antes);
  assert.equal(detectarLigacoes(p, reg).filter((l) => l.fonte.id === laje.id).length, antes);
  calcularProjeto(p);
  assert.ok(p.elementos.every((e) => !e.resultado?.erro), p.elementos.filter((e) => e.resultado?.erro).map((e) => `${e.codigo}: ${e.resultado.erro}`).join('; '));
});

test('converter laje: em uma direção corre no menor vão e a altura vem do vão', () => {
  const p = { parametros: {}, pavimentos: [{ id: 't', cota: 0 }], elementos: [
    { id: 'l', codigo: 'L1', modulo: 'concreto.laje.macica', lx: 6, ly: 3.6, h: 15, bordas: { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'engastada' }, pesoProprio: true, cargas: { revestimento: 1.2, acidental: 2, outras: 0 }, posicao: { pavimento: 't', x: 0, y: 0, angulo: 0 }, fck: 30 },
  ] };
  converterLaje(p, 'l', 'concreto.laje.trelicada', reg);
  let el = p.elementos[0];
  assert.equal(el.direcao, 'y'); assert.equal(el.L, 3.6); assert.equal(el.largura, 6); assert.equal(el.he, 12);
  assert.equal(el.bordas.y1, 'engastada'); assert.equal(el.fck, 30);
  converterLaje(p, 'l', 'concreto.laje.macica', reg);
  el = p.elementos[0];
  assert.equal(el.lx, 6); assert.equal(el.ly, 3.6); assert.equal(el.h, 9);   // 3,6 m / 40 = 9 cm
  converterLaje(p, 'l', 'concreto.laje.nervurada', reg);
  assert.equal(p.elementos[0].direcao, 'duas'); assert.equal(p.elementos[0].h, 20);
});
