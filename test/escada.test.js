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
/** Escadas: degraus, geometria (reta, L, U), tramos biapoiados, reações nas vigas da montagem. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { criarEscada } from '../src/modules/concreto-escada/calculo.js';
import { religarEscada } from '../src/modules/concreto-escada/index.js';
import { degraus, divisaoLances, geometriaEscada } from '../src/engine/escada.js';
import { escadaNaPlanta, detectarLigacoes } from '../src/renderer/core/montagem.js';
import { montarCasos } from '../src/modules/concreto-viga/calculo.js';
import { contextoCalculo } from '../src/renderer/core/calculo.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const exemplo = () => lerProjeto(fs.readFileSync(new URL('./fixtures/edificio-3-pavimentos-sem-baldrame.lebr.json', import.meta.url), 'utf8'));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const calc = (p, ajuste = {}) => {
  const el = { id: 'ex', modulo: 'concreto.escada', codigo: 'ESX', nome: 'ESX', ...criarEscada(), desnivel: 300, ...ajuste };
  p.elementos.push(el);
  try { return calcularElemento(el, p, reg); } finally { p.elementos.pop(); }
};

test('degraus e divisão dos lances', () => {
  const d = degraus({ H: 280, espelhoAlvo: 17.5, piso: 28 });
  assert.equal(d.n, 16);
  assert.ok(perto(d.e, 17.5));
  assert.deepEqual(divisaoLances('U', 17), [9, 8]);
  assert.deepEqual(divisaoLances('reta', 17), [17]);
  assert.throws(() => degraus({ H: 0 }));
});

test('uma escada em U tem dois lances, o patamar intermediário e quatro apoios; L e reta também', () => {
  const u = geometriaEscada({ tipo: 'U', espelhos: [9, 9], p: 30, largura: 1, patamar: 1.2, vaoCentral: 0.1 });
  assert.equal(u.lances.length, 2);
  assert.equal(u.patamares.filter((x) => x.nivel === 'intermediario').length, 1);
  assert.equal(u.apoios.length, 4);
  assert.ok(perto(u.largura, 2.1) && perto(u.comprimento, 3.6));
  assert.deepEqual(u.lances.map((l) => l.sentido[1]), [1, -1], 'os lances sobem em sentidos opostos');
  const L = geometriaEscada({ tipo: 'L', espelhos: [9, 8], p: 28, largura: 1 });
  assert.ok(perto(L.largura, 1 + 7 * 0.28) && perto(L.comprimento, 8 * 0.28 + 1));
  assert.deepEqual(L.lances[1].sentido, [1, 0]);
  const r = geometriaEscada({ tipo: 'reta', espelhos: [17], p: 28, largura: 1.2, patamarSuperior: 1 });
  assert.equal(r.apoios.length, 2);
  assert.ok(perto(r.comprimento, 16 * 0.28 + 1));
});

test('os três tipos calculam com a laje armada longitudinalmente e mostram as verificações', () => {
  const p = exemplo();
  for (const tipo of ['reta', 'L', 'U']) {
    const r = calc(p, { tipo, h: tipo === 'reta' ? 18 : 12 });
    assert.ok(!r.erro, `${tipo}: ${r.erro}`);
    assert.equal(r.tramos.length, tipo === 'reta' ? 1 : 2);
    for (const t of r.tramos) {
      assert.ok(t.Md > 0 && t.barras && t.dist, `${tipo}: armaduras`);
      // equilíbrio: soma das reações = carga total do tramo
      const W = t.trechos.reduce((s, x) => s + (x.g + x.q) * (x.b - x.a), 0);
      assert.ok(perto(t.apoios[0].g + t.apoios[0].q + t.apoios[1].g + t.apoios[1].q, W, 0.05), `${tipo}: equilíbrio`);
    }
    assert.ok(r.verificacoes.some((v) => /Blondel/.test(v.nome)) && r.verificacoes.some((v) => /flecha/.test(v.nome)));
  }
  const fino = calc(p, { tipo: 'reta', h: 10 });
  assert.equal(fino.ok, false, 'lance reto longo e fino não passa');
});

test('na planta: lances com os degraus, patamares e as linhas de apoio sobre as vigas', () => {
  const p = exemplo();
  const es = p.elementos.find((e) => e.codigo === 'ES2');
  const pl = escadaNaPlanta(es, p);
  assert.equal(pl.lances.length, 2);
  assert.equal(pl.lances[0].degraus.length, pl.lances[0].espelhos - 2);
  assert.equal(pl.patamares.length, 1);
  assert.deepEqual(pl.apoios.map((a) => a.pavimento), ['pav1', null, null, 'pav2']);
  const lig = detectarLigacoes(p, reg).filter((l) => l.tipo === 'escada-viga' && l.fonte.id === es.id);
  assert.deepEqual(lig.map((l) => `${l.ligacao}→${l.receptor.codigo}`).sort(), ['t1-ini→V102', 't2-fim→V202']);
});

test('as vigas de apoio recebem as reações da escada como resultantes na posição do lance', () => {
  const p = exemplo();
  const v = p.elementos.find((e) => e.codigo === 'V202');
  const es = p.elementos.find((e) => e.codigo === 'ES2');
  const c = v.cargas.find((x) => x.elementoId === es.id);
  assert.ok(c && c.ligacao === 't2-fim' && perto(c.posicao, 1.475, 1e-3));
  const casos = montarCasos(v, contextoCalculo(p, reg, [v.id]));
  const r = calcularElemento(es, p, reg);
  const ap = r.tramos[1].apoios[1];
  const P = casos.G.P.find((x) => perto(x.x, 1.475, 1e-3));
  assert.ok(P && perto(P.P, ap.g * r.largura, 0.02), 'resultante = reação × largura do lance');
  assert.ok(ap.vigas.some((x) => x.codigo === 'V202'));
  // a viga sem a escada recebe menos carga
  const comEscada = calcularElemento(v, p, reg);
  v.cargas = v.cargas.filter((x) => x.elementoId !== es.id);
  const semEscada = calcularElemento(v, p, reg);
  assert.ok(comEscada.apoios[0].Rg > semEscada.apoios[0].Rg);
});

test('mover a escada refaz as ligações nos pisos', () => {
  const p = exemplo();
  const es = p.elementos.find((e) => e.codigo === 'ES2');
  es.posicao.x += 0.5;
  religarEscada(es, p);
  const c = p.elementos.find((e) => e.codigo === 'V202').cargas.find((x) => x.elementoId === es.id);
  assert.ok(perto(c.posicao, 1.975, 1e-3));
  es.posicao.y = 2.5; // fora das vigas: os apoios dos pisos ficam externos
  religarEscada(es, p);
  assert.ok(!p.elementos.some((e) => Array.isArray(e.cargas) && e.cargas.some((x) => x.elementoId === es.id)));
  const r = calcularElemento(es, p, reg);
  assert.ok(r.avisos.some((a) => /sem viga ligada/.test(a)));
});
