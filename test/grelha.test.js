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
/** Grelha de pavimento (modules/comum/grelha.js) integrada à viga de concreto. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { grelhaDoPavimento } from '../src/modules/comum/grelha.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const novo = (p, modulo, extra) => ({ id: extra.id, modulo, codigo: extra.codigo ?? extra.id.toUpperCase(), nome: extra.codigo ?? extra.id, ...MODULOS_CALCULO[modulo].criar(p), ...extra });
const viga = (p, extra) => novo(p, 'concreto.viga', { secao: { b: 20, h: 50 }, pesoProprio: false, cargas: [{ id: 'g', tipo: 'distribuida', natureza: 'g', valor: 10, vao: 'todos' }, { id: 'q', tipo: 'distribuida', natureza: 'q', valor: 3, vao: 'todos' }], ...extra });
const pilar = (p, id, x, y) => novo(p, 'concreto.pilar', { id, bx: 30, by: 30, comprimento: 2.8, posicao: { pavimento: 'pav1', x, y, angulo: 0 } });

function cruzamento(modo) {
  const p = criarProjeto({ nome: 't' });
  p.pavimentos[0].analise = modo;
  p.elementos.push(
    viga(p, { id: 'v1', codigo: 'V1', vaos: [{ L: 6 }], apoios: ['apoio', 'apoio'], posicao: { pavimento: 'pav1', x: 0, y: 0, angulo: 0 } }),
    viga(p, { id: 'v2', codigo: 'V2', vaos: [{ L: 4 }, { L: 4 }], apoios: ['apoio', 'apoio', 'apoio'], posicao: { pavimento: 'pav1', x: 3, y: -4, angulo: 90 } }),
    pilar(p, 'p1', 0, 0), pilar(p, 'p2', 6, 0),
  );
  const P1 = p.elementos.find((e) => e.id === 'p1');
  P1.cargas = [{ id: 'c', tipo: 'elemento', elementoId: 'v1', ligacao: 'apoio-0' }];
  return p;
}
const calc = (p, id) => calcularElemento(p.elementos.find((e) => e.id === id), p, reg);

test('modo isolado: os esforços não mudam e a grelha aparece só como comparação', () => {
  const p = cruzamento('isolada');
  const r = calc(p, 'v2');
  assert.equal(r.grelha.ativa, false);
  assert.ok(Math.abs(r.apoios[1].Rg - 1.25 * 10 * 4) < 1e-6, 'apoio central rígido');
  assert.ok(r.grelha.comparacao.apoios[1].grelhaR < r.grelha.comparacao.apoios[1].isoR);
});

test('modo grelha: V2 descarrega em V1, que aumenta; o pilar recebe a reação da grelha', () => {
  const iso = cruzamento('isolada'), gr = cruzamento('grelha');
  const v1i = calc(iso, 'v1'), v1g = calc(gr, 'v1');
  assert.ok(v1g.vaos[0].Mdpos > v1i.vaos[0].Mdpos * 1.2);
  const it = v1g.grelha.interacoes[0];
  assert.deepEqual(it.com, ['V2']);
  assert.ok(it.Rg < 0, 'V1 carrega V2');
  const v2g = calc(gr, 'v2');
  assert.ok(Math.abs(v2g.apoios[1].Rg + it.Rg) < 0.01, `ação e reação: ${v2g.apoios[1].Rg} × ${it.Rg}`);
  const pIso = calc(iso, 'p1'), pGr = calc(gr, 'p1');
  assert.ok(pGr.Nd > pIso.Nd, `${pGr.Nd} > ${pIso.Nd}`);
  // engastamento elástico nos pilares: momento negativo no apoio de extremidade
  assert.ok(v1g.apoios[0].Mdneg < -1);
});

test('torção de laje em balanço: o sentido depende do lado da laje', () => {
  const montar = (lado) => {
    const p = criarProjeto({ nome: 't' });
    p.pavimentos[0].analise = 'grelha';
    const laje = novo(p, 'concreto.laje.macica', {
      id: 'l1', codigo: 'L1', lx: 6, ly: 1.5, h: 12,
      bordas: lado > 0 ? { x0: 'livre', x1: 'livre', y0: 'engastada', y1: 'livre' } : { x0: 'livre', x1: 'livre', y0: 'livre', y1: 'engastada' },
      posicao: { pavimento: 'pav1', x: 0, y: lado > 0 ? 0 : -1.5, angulo: 0 },
    });
    const v = viga(p, { id: 'v1', codigo: 'V1', vaos: [{ L: 6 }], apoios: ['apoio', 'apoio'], cargas: [{ id: 'e', tipo: 'elemento', elementoId: 'l1', ligacao: lado > 0 ? 'y0' : 'y1', vao: 'todos' }], posicao: { pavimento: 'pav1', x: 0, y: 0, angulo: 0 } });
    p.elementos.push(laje, v, pilar(p, 'p1', 0, 0), pilar(p, 'p2', 6, 0));
    return grelhaDoPavimento(p, 'pav1', reg);
  };
  const esq = montar(1), dir = montar(-1);
  assert.ok(!esq.erro && !dir.erro, esq.erro ?? dir.erro);
  const mx = (g) => g.resultado.porCaso.G.reacoes.reduce((s, r) => s + r.R[3], 0);
  assert.ok(Math.abs(mx(esq)) > 1);
  assert.ok(Math.sign(mx(esq)) === -Math.sign(mx(dir)), `${mx(esq)} × ${mx(dir)}`);
});

test('grelha impossível: a viga continua calculada isolada, com aviso', () => {
  const p = criarProjeto({ nome: 't' });
  p.pavimentos[0].analise = 'grelha';
  // V1 se apoia em V2 e V3, que não têm apoio nenhum: a grelha é um mecanismo
  p.elementos.push(
    viga(p, { id: 'v1', codigo: 'V1', vaos: [{ L: 4 }], apoios: ['apoio', 'apoio'], posicao: { pavimento: 'pav1', x: 0, y: 0, angulo: 0 } }),
    viga(p, { id: 'v2', codigo: 'V2', vaos: [{ L: 2 }], apoios: ['livre', 'livre'], posicao: { pavimento: 'pav1', x: 0, y: -1, angulo: 90 } }),
    viga(p, { id: 'v3', codigo: 'V3', vaos: [{ L: 2 }], apoios: ['livre', 'livre'], posicao: { pavimento: 'pav1', x: 4, y: -1, angulo: 90 } }),
  );
  const r = calc(p, 'v1');
  assert.ok(!r.erro, r.erro);
  assert.ok(r.avisos.some((a) => a.includes('grelha do pavimento não pôde')), r.avisos.join(' | '));
  assert.ok(Math.abs(r.vaos[0].Mdpos - 1.4 * 10 * 16 / 8 - 1.4 * 3 * 16 / 8) < 0.05);
  assert.match(grelhaDoPavimento(p, 'pav1', reg).erro, /hipostática/);
});
