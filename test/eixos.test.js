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
/** Eixos de projeto (0.65): verticais, horizontais e inclinados, nós, distâncias, duplicação, cotas e ancoragem. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  listaEixos, familiasDeEixos, nosDosEixos, criarEixo, criarEixoPorDoisPontos, duplicarEixo, excluirEixo, editarEixo,
  moverEixo, moverEixos, definirDistancia, definirEspacamentos, criarCota, cotasDosEixos, eixosPelosPontos, normalizarEixos, angDirecao,
} from '../src/renderer/core/eixos.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { calcularProjeto } from '../src/validacao/caminho-cargas.js';
import { detectarLigacoes, eixoViga, cantosLaje, tipoDe, dimensoesLaje } from '../src/renderer/core/montagem.js';

const perto = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} ≠ ${b}`);
const registro = { obter: (id) => MODULOS_CALCULO[id] };

test('eixos: os antigos (listas x e y) viram verticais 1, 2, 3 e horizontais A, B, com os nós', () => {
  const p = { eixos: { x: [8, 0, 4], y: [0, 5] }, elementos: [] };
  const l = listaEixos(p);
  assert.deepEqual(l.filter((e) => e.tipo === 'vertical').map((e) => [e.nome, e.d]), [['1', 0], ['2', 4], ['3', 8]]);
  assert.deepEqual(l.filter((e) => e.tipo === 'horizontal').map((e) => [e.nome, e.d]), [['A', 0], ['B', 5]]);
  const nos = nosDosEixos(p);
  assert.equal(nos.length, 6);
  assert.ok(nos.some((n) => n.nome === 'B-3' && n.p[0] === 8 && n.p[1] === 5));
  // na primeira edição passam para a lista, com os mesmos nomes
  normalizarEixos(p);
  assert.ok(Array.isArray(p.eixos.lista) && !p.eixos.x);
  assert.deepEqual(listaEixos(p).map((e) => e.nome), l.map((e) => e.nome));
});

test('eixos: inclinado por dois pontos, ângulo da direção e cruzamentos', () => {
  const p = { elementos: [] };
  criarEixo(p, [0, 0], 0); criarEixo(p, [0, 0], 90);
  const id = criarEixoPorDoisPontos(p, [0, 0], [-3, -3]);   // sentido oposto: mesmo eixo de 45°
  const d = listaEixos(p).find((e) => e.id === id);
  assert.equal(d.tipo, 'inclinado'); perto(d.ang, 45, 'ângulo'); assert.equal(d.nome, 'D1');
  assert.equal(angDirecao(-90), 90); assert.equal(angDirecao(180), 0);
  // os três passam pela origem: um nó só, com os três eixos
  const nos = nosDosEixos(p);
  assert.equal(nos.length, 1); assert.equal(nos[0].eixos.length, 3);
  criarEixo(p, [0, 4], 0);   // horizontal y = 4 cruza a diagonal em (4, 4)
  assert.ok(nosDosEixos(p).some((n) => Math.abs(n.p[0] - 4) < 1e-9 && Math.abs(n.p[1] - 4) < 1e-9));
});

test('eixos: duplicar fica paralelo à distância pedida; distâncias e espaçamentos levam os seguintes', () => {
  const p = { elementos: [] };
  const a = criarEixo(p, [0, 0], 90);
  const b = duplicarEixo(p, a, 0.33);                       // ~20 px a 60 px/m
  const c = duplicarEixo(p, b, 4);
  const fam = () => familiasDeEixos(p)[0];
  assert.deepEqual(fam().eixos.map((e) => e.d), [0, 0.33, 4.33]);
  definirDistancia(p, a, b, 5);                             // b vai para 5 e c acompanha (mantém 4 m)
  assert.deepEqual(fam().eixos.map((e) => e.d), [0, 5, 9]);
  definirEspacamentos(p, fam().ang.toString(), [3, 2.5]);
  assert.deepEqual(fam().espacos, [3, 2.5]);
  // para o outro lado: duplicar com distância negativa
  const z = duplicarEixo(p, a, -2);
  assert.equal(fam().eixos[0].id, z);
  definirDistancia(p, a, z, 3);                             // z continua à esquerda de a
  perto(listaEixos(p).find((e) => e.id === z).d, -3, 'lado mantido');
  // cota presa a dois eixos; excluir um eixo leva a cota junto
  const ct = criarCota(p, a, c, 1.5);
  const cc = cotasDosEixos(p).find((x) => x.id === ct);
  perto(cc.dist, 5.5, 'distância da cota'); perto(cc.pa[1], 1.5, 'cota ao longo do eixo');
  excluirEixo(p, c);
  assert.equal(cotasDosEixos(p).length, 0);
  editarEixo(p, a, { nome: 'P' });
  assert.equal(listaEixos(p).find((e) => e.id === a).nome, 'P');
});

test('eixos: pilar no nó, apoios de viga e cantos de laje acompanham; fora dos eixos fica', () => {
  const p = { elementos: [
    { id: 'p1', codigo: 'P1', modulo: 'concreto.pilar', posicao: { x: 4, y: 0 } },
    { id: 'p2', codigo: 'P2', modulo: 'concreto.pilar', posicao: { x: 2.2, y: 1.1 } },
    { id: 'v1', codigo: 'V1', modulo: 'concreto.viga', posicao: { x: 0, y: 0, angulo: 0 }, vaos: [{ L: 4 }, { L: 4 }] },
    { id: 'l1', codigo: 'L1', modulo: 'concreto.laje.macica', posicao: { x: 0, y: 0, angulo: 0 }, lx: 4, ly: 5 },
  ] };
  p.eixos = { x: [0, 4, 8], y: [0, 5] };
  const e2 = listaEixos(p).find((e) => e.nome === '2');
  const r = moverEixo(p, e2.id, 4.5);
  assert.equal(r.eixos, 1);
  assert.deepEqual(r.elementos.sort(), ['L1', 'P1', 'V1']);
  const el = (id) => p.elementos.find((e) => e.id === id);
  assert.deepEqual([el('p1').posicao.x, el('p1').posicao.y], [4.5, 0]);
  assert.deepEqual([el('p2').posicao.x, el('p2').posicao.y], [2.2, 1.1]);
  assert.deepEqual(el('v1').vaos.map((v) => v.L), [4.5, 3.5]);
  assert.deepEqual([el('l1').lx, el('l1').ly], [4.5, 5]);
  // sem acompanhar: só o eixo muda
  const q = { eixos: { x: [0, 4] }, elementos: [{ id: 'p', codigo: 'P', modulo: 'concreto.pilar', posicao: { x: 4, y: 0 } }] };
  moverEixo(q, listaEixos(q)[1].id, 5, { elementos: false });
  assert.equal(q.elementos[0].posicao.x, 4);
});

test('eixos: projeto de exemplo — eixos pelos pilares, distância mudada, tudo acompanha e calcula', () => {
  const p = JSON.parse(fs.readFileSync(new URL('../exemplos/edificio-exemplo.lebr.json', import.meta.url), 'utf8'));
  const tipo = (e) => tipoDe(e, registro);
  const pils = p.elementos.filter((e) => tipo(e) === 'pilar' && e.posicao);
  delete p.eixos;
  const n = eixosPelosPontos(p, pils.map((e) => [e.posicao.x, e.posicao.y]));
  assert.ok(n >= 4);
  const ligAntes = detectarLigacoes(p, registro).length;
  const ver = familiasDeEixos(p).find((f) => f.tipo === 'vertical');
  const [e1, e2] = ver.eixos;
  const d0 = e2.d - e1.d;
  const r = definirDistancia(p, e1.id, e2.id, d0 + 1, { tipoDe: tipo });
  assert.ok(r.elementos.length > 0);
  // pilares sobre o eixo 2 andaram 1 m; vigas e lajes esticaram junto
  for (const pl of p.elementos.filter((e) => tipo(e) === 'pilar' && e.posicao)) {
    const antes = pils.find((x) => x.id === pl.id);
    void antes;
    assert.ok([e1.d, e2.d + 1, ...ver.eixos.slice(2).map((e) => e.d + 1)].some((x) => Math.abs(pl.posicao.x - x) < 1e-6), `${pl.codigo} sobre um eixo vertical`);
  }
  for (const v of p.elementos.filter((e) => tipo(e) === 'viga' && e.posicao)) assert.ok(eixoViga(v).L > 0 && v.vaos.every((x) => x.L > 0.05), v.codigo);
  for (const l of p.elementos.filter((e) => tipo(e) === 'laje' && e.posicao)) assert.ok(dimensoesLaje(l).lx > 0 && cantosLaje(l).length === 4, l.codigo);
  // as ligações continuam todas lá e o projeto calcula sem erro
  assert.equal(detectarLigacoes(p, registro).length, ligAntes);
  calcularProjeto(p);
  assert.ok(p.elementos.every((e) => !e.resultado?.erro), p.elementos.filter((e) => e.resultado?.erro).map((e) => `${e.codigo}: ${e.resultado.erro}`).join('; '));
});

test('eixos: mover todos os eixos de (Δx, Δy) leva junto o pilar no nó e a viga entre eixos', () => {
  const p = { eixos: { x: [0, 4], y: [0, 3] }, elementos: [
    { id: 'p1', codigo: 'P1', modulo: 'concreto.pilar', posicao: { x: 4, y: 3 } },
    { id: 'v1', codigo: 'V1', modulo: 'concreto.viga', posicao: { x: 0, y: 3, angulo: 0 }, vaos: [{ L: 4 }] },
  ] };
  const novos = {};
  for (const e of listaEixos(p)) novos[e.id] = e.d + 0.5 * e.n[0] + 0.25 * e.n[1];
  moverEixos(p, novos);
  assert.deepEqual(listaEixos(p).map((e) => [e.nome, e.d]).sort((a, b) => a[0].localeCompare(b[0])), [['1', 0.5], ['2', 4.5], ['A', 0.25], ['B', 3.25]]);
  perto(p.elementos[0].posicao.x, 4.5, 'pilar x'); perto(p.elementos[0].posicao.y, 3.25, 'pilar y');
  perto(p.elementos[1].posicao.x, 0.5, 'viga x'); perto(p.elementos[1].posicao.y, 3.25, 'viga y'); perto(p.elementos[1].vaos[0].L, 4, 'vão');
});
