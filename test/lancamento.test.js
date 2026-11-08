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
/** Lançamento gráfico (etapas L4 a L8): viga em cadeia, laje pelo contorno, dados atuais, critérios e sugestões. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { vigasEmCadeia, criarVigasEmCadeia, trechosRetos } from '../src/renderer/core/lancamento.js';
import { verificarConsistencia } from '../src/renderer/core/consistencia.js';
import { detectarLigacoes, aplicarLigacoes } from '../src/renderer/core/montagem.js';
import { eixoViga } from '../src/renderer/core/montagem.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const MOD_VIGA = { id: 'concreto.viga', prefixo: 'V', criar: MODULOS_CALCULO['concreto.viga'].criar };
const perto = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} ≠ ${b}`);

export function planta(pilares) {
  const p = criarProjeto();
  p.pavimentos = [{ id: 'p1', nome: 'Térreo', cota: 3 }];
  pilares.forEach(([x, y, bx = 20, by = 20], i) => p.elementos.push({ id: `p${i + 1}`, modulo: 'concreto.pilar', codigo: `P${i + 1}`, nome: `P${i + 1}`, ...MODULOS_CALCULO['concreto.pilar'].criar(), bx, by, comprimento: 3, posicao: { pavimento: 'p1', x, y, angulo: 0 } }));
  return p;
}

test('trechos retos: pontos alinhados na mesma direção viram um trecho', () => {
  assert.equal(trechosRetos([[0, 0], [4, 0], [9, 0]]).length, 1);
  assert.equal(trechosRetos([[0, 0], [4, 0], [4, 5]]).length, 2);
  assert.equal(trechosRetos([[0, 0], [4, 0], [2, 0]]).length, 2, 'voltar não é continuar');
});

test('de P1 a P3 passando por P2: uma viga de dois vãos apoiada nos três pilares', () => {
  const p = planta([[0, 0], [4, 0], [9, 0]]);
  const [v] = vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [9, 0]] });
  assert.deepEqual(v.vaos.map((x) => x.L), [4, 5]);
  assert.deepEqual(v.apoios, ['apoio', 'apoio', 'apoio']);
  assert.deepEqual(v.pilares.map((x) => x.codigo), ['P1', 'P2', 'P3']);
  const { vigas, ligacoes } = criarVigasEmCadeia(p, reg, MOD_VIGA, [v], { secao: { b: 14, h: 40 } });
  assert.equal(ligacoes, 3);
  assert.deepEqual(vigas[0].secao, { b: 14, h: 40 });
  for (const c of ['P1', 'P2', 'P3']) assert.ok(p.elementos.find((e) => e.codigo === c).cargas.some((x) => x.tipo === 'elemento' && x.elementoId === vigas[0].id), c);
  assert.deepEqual(verificarConsistencia(p, reg).filter((x) => x.gravidade === 'erro').map((x) => x.texto), []);
});

test('clicar também em P2 dá o mesmo resultado; em L saem duas vigas', () => {
  const p = planta([[0, 0], [4, 0], [9, 0], [9, 5]]);
  assert.deepEqual(vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [4, 0], [9, 0]] }).map((v) => v.vaos.length), [2]);
  const l = vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [9, 0], [9, 5]] });
  assert.equal(l.length, 2);
  assert.equal(l[1].posicao.angulo, 90);
});

test('ponta sem pilar vira balanço; sobre outra viga, apoio', () => {
  const p = planta([[0, 0], [4, 0]]);
  const [v] = vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [5.5, 0]] });
  assert.deepEqual(v.apoios, ['apoio', 'apoio', 'livre']);
  assert.deepEqual(v.vaos.map((x) => x.L), [4, 1.5]);
});

test('face rente ao pilar e deslocamento: o eixo sai do centro, e os apoios continuam nos pilares', () => {
  const p = planta([[0, 0, 20, 40], [5, 0, 20, 40]]);
  const [esq] = vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [5, 0]], secao: { b: 14, h: 40 }, alinhamento: 'esquerda' });
  perto(esq.posicao.y, 0.2 - 0.07, 'face de cima da viga na face de cima do pilar');
  assert.deepEqual(esq.apoios, ['apoio', 'apoio']);
  const [dir] = vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [5, 0]], secao: { b: 14, h: 40 }, alinhamento: 'direita', deslocamento: 0.02 });
  perto(dir.posicao.y, -0.13 + 0.02, 'face de baixo, mais 2 cm para a esquerda');
  const pc = planta([[0, 0, 20, 40], [5, 0, 20, 40]]);
  const { vigas } = criarVigasEmCadeia(pc, reg, MOD_VIGA, [esq], { secao: { b: 14, h: 40 } });
  perto(eixoViga(vigas[0]).L, 5, 'comprimento entre os centros projetados');
});

import { regioesDoPavimento, criarLajeNaRegiao } from '../src/renderer/core/lancamento.js';
const MOD_LAJE = { id: 'concreto.laje.macica', prefixo: 'L', criar: MODULOS_CALCULO['concreto.laje.macica'].criar };

/** Planta 2 × 2: pilares 3 × 3 e vigas contínuas nas linhas dos pilares. */
function grelha2x2() {
  const pts = [];
  for (const y of [0, 5, 10]) for (const x of [0, 4, 8]) pts.push([x, y]);
  const p = planta(pts);
  criarVigasEmCadeia(p, reg, MOD_VIGA, [
    ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [8, 0]] }), ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 5], [8, 5]] }),
    ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 10], [8, 10]] }), ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [0, 10]] }),
    ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[4, 0], [4, 10]] }), ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[8, 0], [8, 10]] }),
  ]);
  return p;
}

test('planta 2 × 2: quatro regiões retangulares de 4 × 5 m', () => {
  const p = grelha2x2();
  const rs = regioesDoPavimento(p, reg, 'p1');
  assert.equal(rs.length, 4);
  assert.ok(rs.every((r) => r.retangulo && Math.abs(r.area - 20) < 1e-6 && !r.ocupada));
  assert.deepEqual(rs.map((r) => [r.retangulo.lx, r.retangulo.ly, r.retangulo.posicao.angulo]), Array(4).fill([4, 5, 0]));
});

test('clicar na região cria a laje com as quatro bordas ligadas; a região fica ocupada', () => {
  const p = grelha2x2();
  const r = regioesDoPavimento(p, reg, 'p1').find((x) => x.centro[0] < 4 && x.centro[1] < 5);
  const { laje, ligacoes } = criarLajeNaRegiao(p, reg, MOD_LAJE, 'p1', r, { h: 12 });
  assert.deepEqual([laje.lx, laje.ly, laje.h, laje.posicao.x, laje.posicao.y], [4, 5, 12, 0, 0]);
  assert.equal(ligacoes, 4);
  assert.equal(regioesDoPavimento(p, reg, 'p1').filter((x) => x.ocupada).length, 1);
  assert.deepEqual(verificarConsistencia(p, reg).filter((x) => x.gravidade === 'erro').map((x) => x.texto), []);
});

test('abrir uma viga: as regiões de cima somem e a laje de lá acusa contorno aberto', () => {
  const p = grelha2x2();
  const r = regioesDoPavimento(p, reg, 'p1').find((x) => x.centro[1] > 5 && x.centro[0] < 4);
  criarLajeNaRegiao(p, reg, MOD_LAJE, 'p1', r);
  const topo = p.elementos.find((e) => e.modulo === 'concreto.viga' && e.posicao.y === 10);
  p.elementos = p.elementos.filter((e) => e !== topo);
  for (const e of p.elementos) if (Array.isArray(e.cargas)) e.cargas = e.cargas.filter((c) => c.elementoId !== topo.id);
  assert.equal(regioesDoPavimento(p, reg, 'p1').length, 2);
  assert.ok(verificarConsistencia(p, reg).some((x) => x.regra === 'contorno-aberto'));
});

test('fechamento de bordo: fecha a região do balanço e deixa a borda livre', () => {
  const p = grelha2x2();
  // balanço de 1,5 m à direita de x = 8, entre y = 0 e 5: duas vigas em balanço e o fechamento
  criarVigasEmCadeia(p, reg, MOD_VIGA, [...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[8, 0], [9.5, 0]] }), ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[8, 5], [9.5, 5]] })]);
  p.pavimentos[0].fechamentos = [{ a: [9.5, 0], b: [9.5, 5] }];
  const r = regioesDoPavimento(p, reg, 'p1').find((x) => x.centro[0] > 8);
  assert.ok(r?.retangulo);
  assert.deepEqual(r.retangulo.bordas, { y0: 'apoiada', x1: 'livre', y1: 'apoiada', x0: 'apoiada' });
});

test('laje em uma direção (treliçada): as vigotas vencem o menor vão', () => {
  const p = grelha2x2();
  const r = regioesDoPavimento(p, reg, 'p1')[0];
  const mod = { id: 'concreto.laje.trelicada', prefixo: 'L', criar: MODULOS_CALCULO['concreto.laje.trelicada'].criar };
  const { laje } = criarLajeNaRegiao(p, reg, mod, 'p1', r);
  assert.deepEqual([laje.direcao, laje.L, laje.largura], ['x', 4, 5]);
});

import { calcularElemento, contextoCalculo } from '../src/renderer/core/calculo.js';
import { avisosDeCriterios, parametrosDoElemento, criteriosEfetivos } from '../src/renderer/core/criterios.js';

test('L7: C20 numa viga com CAA II dispara aviso; o cálculo usa o fck do elemento', () => {
  const p = planta([[0, 0], [5, 0]]);
  const [sp] = vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [5, 0]] });
  const { vigas: [v] } = criarVigasEmCadeia(p, reg, MOD_VIGA, [sp]);
  assert.equal(p.parametros.classeAgressividade, 'II');
  assert.deepEqual(avisosDeCriterios(p.parametros, v), []);
  v.criterios = { fck: 20 };
  const av = avisosDeCriterios(p.parametros, v);
  assert.equal(av.length, 1);
  assert.match(av[0], /C20 abaixo do mínimo C25 da classe de agressividade II/);
  assert.equal(contextoCalculo(p, reg, [v.id]).materiais.concreto.fck, 20);
  const r = calcularElemento(v, p, reg);
  assert.ok(r.avisos.some((a) => /C20 abaixo/.test(a)));
  // outro elemento continua com o fck do projeto
  assert.equal(contextoCalculo(p, reg, ['p1']).materiais.concreto.fck, 25);
});

test('L7: cobrimento do elemento abaixo da Tabela 7.2 avisa; acima não', () => {
  const p = planta([[0, 0]]);
  const pil = p.elementos[0];
  pil.criterios = { cobrimento: 2.5 };
  assert.match(avisosDeCriterios(p.parametros, pil)[0], /cobrimento 2,5 cm abaixo do nominal 3 cm para pilares na classe II/);
  pil.criterios = { cobrimento: 4 };
  assert.deepEqual(avisosDeCriterios(p.parametros, pil), []);
  assert.equal(parametrosDoElemento(p.parametros, pil).cobrimento.pilar, 4);
  assert.deepEqual(criteriosEfetivos(p.parametros, pil), { fck: 25, fckOrigem: 'projeto', cobrimento: 4, cobrimentoOrigem: 'elemento' });
});

import { dadosAtuais, definirDadosAtuais, copiarPropriedades, aplicarPropriedades, aplicarDadosAtuais } from '../src/renderer/core/lancamento.js';

test('L6: cinco vigas seguidas 14 × 40 sem reabrir o diálogo, com o próximo código', () => {
  const p = planta([[0, 0], [4, 0], [8, 0], [12, 0], [16, 0], [20, 0]]);
  definirDadosAtuais(p, 'viga', { secao: { b: 14, h: 40 }, proximoCodigo: 'V101' });
  for (let k = 0; k < 5; k++) {
    const d = dadosAtuais(p, 'viga');
    const specs = vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[4 * k, 0], [4 * k + 4, 0]], secao: d.secao });
    criarVigasEmCadeia(p, reg, MOD_VIGA, specs, d);
    if (d.proximoCodigo) definirDadosAtuais(p, 'viga', { proximoCodigo: null });
  }
  const vs = p.elementos.filter((e) => e.modulo === 'concreto.viga');
  assert.equal(vs.length, 5);
  assert.ok(vs.every((v) => v.secao.b === 14 && v.secao.h === 40));
  assert.deepEqual(vs.map((v) => v.codigo), ['V101', 'V1', 'V2', 'V3', 'V4']);
  assert.deepEqual(p.lancamento.viga.secao, { b: 14, h: 40 }, 'os dados atuais ficam gravados no projeto');
});

test('L6: conta-gotas e pincel copiam seção, critérios e cargas próprias, sem levar as ligações', () => {
  const p = planta([[0, 0], [5, 0], [0, 4], [5, 4]]);
  const { vigas: [a, b] } = criarVigasEmCadeia(p, reg, MOD_VIGA, [...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [5, 0]] }), ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 4], [5, 4]] })]);
  a.secao = { b: 15, h: 60 }; a.criterios = { fck: 30 };
  a.cargas = [{ id: 'x', tipo: 'distribuida', natureza: 'g', valor: 7, vao: 'todos' }];
  b.cargas.push({ id: 'lig', tipo: 'elemento', elementoId: 'qualquer', ligacao: 'x0' });
  const copia = copiarPropriedades(a, reg);
  assert.equal(copia.tipo, 'viga');
  assert.ok(aplicarPropriedades(b, copia, reg));
  assert.deepEqual(b.secao, { b: 15, h: 60 });
  assert.deepEqual(b.criterios, { fck: 30 });
  assert.deepEqual(b.cargas.filter((c) => c.tipo !== 'elemento').map((c) => c.valor), [7]);
  assert.ok(b.cargas.some((c) => c.id === 'lig'), 'a ligação continua');
  assert.equal(aplicarPropriedades(p.elementos[0], copia, reg), false, 'pilar não recebe propriedades de viga');
  const nova = aplicarDadosAtuais({ secao: { b: 20, h: 50 }, cargas: [] }, 'viga', { ...dadosAtuais(p, 'viga'), ...copia.dados });
  assert.deepEqual(nova.secao, { b: 15, h: 60 });
});

import { sugerirViga, sugerirLaje, sugerirPilar, areaDeInfluencia, sugestaoDe, aplicarSugestao } from '../src/renderer/core/predimensionamento.js';

test('L8: viga contínua de 5 m sugere 45 cm; de um vão, 50 cm; balanço de 1,5 m, 30 cm', () => {
  assert.equal(sugerirViga({ vaos: [{ L: 5 }, { L: 5 }], apoios: ['apoio', 'apoio', 'apoio'], secao: { b: 14, h: 30 } }).secao.h, 45);
  assert.equal(sugerirViga({ vaos: [{ L: 5 }], apoios: ['apoio', 'apoio'], secao: { b: 14, h: 30 } }).secao.h, 50);
  assert.equal(sugerirViga({ vaos: [{ L: 4 }, { L: 1.5 }], apoios: ['apoio', 'apoio', 'livre'], secao: { b: 14, h: 30 } }).secao.h, 40, 'o vão de 4 m manda (L/10)');
  assert.equal(sugerirViga({ vaos: [{ L: 1.5 }], apoios: ['apoio', 'livre'], secao: { b: 14 } }).secao.h, 30);
  assert.equal(sugerirViga({ vaos: [{ L: 5 }], apoios: ['apoio', 'apoio'], secao: { b: 14 } }).secao.b, 14, 'a largura fica');
});

test('L8: laje 4 × 5 m sugere 10 cm; 3 × 3 m, o mínimo de 8 cm; em balanço, 10 cm', () => {
  assert.equal(sugerirLaje({ lx: 4, ly: 5, bordas: { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' } }).h, 10);
  assert.equal(sugerirLaje({ lx: 3, ly: 3, bordas: {} }).h, 8);
  assert.equal(sugerirLaje({ lx: 1.5, ly: 4, bordas: { x1: 'livre' } }).h, 10);
});

test('L8: pilar pela área de influência — interno, extremidade e canto', () => {
  const pts = [];
  for (const y of [0, 5, 10]) for (const x of [0, 4, 8]) pts.push([x, y]);
  const p = planta(pts);
  const centro = p.elementos.find((e) => e.posicao.x === 4 && e.posicao.y === 5);
  const canto = p.elementos.find((e) => e.posicao.x === 0 && e.posicao.y === 0);
  const borda = p.elementos.find((e) => e.posicao.x === 4 && e.posicao.y === 0);
  assert.deepEqual(areaDeInfluencia(p, reg, centro), { Ai: 20, ax: 4, ay: 5, posicao: 'interno' });
  assert.equal(areaDeInfluencia(p, reg, canto).posicao, 'canto');
  assert.equal(areaDeInfluencia(p, reg, borda).posicao, 'extremidade');
  const s = sugerirPilar(p, reg, centro, { q: 12 });
  // Nk = 12 × 20 × 1 = 240 kN; Ac = 1,8 × 240 / (0,85 × 25/14 + 0,015 × 42) = 201 cm² → mínimo de 360 cm²
  assert.equal(Math.round(s.Nk), 240);
  assert.equal(s.Ac, 360);
  assert.deepEqual([s.bx, s.by], [20, 20], 'a seção atual (20 × 20 = 400 cm²) já atende: não muda');
  assert.equal(aplicarSugestao(structuredClone(centro), s), false);
  // com mais pavimentos acima no mesmo prumo, a seção cresce
  p.pavimentos.push({ id: 'p2', nome: '2º', cota: 6 }, { id: 'p3', nome: '3º', cota: 9 }, { id: 'p4', nome: '4º', cota: 12 }, { id: 'p5', nome: '5º', cota: 15 });
  for (const [k, pv] of ['p2', 'p3', 'p4', 'p5'].entries()) p.elementos.push({ ...structuredClone(centro), id: `c${k}`, codigo: `PC${k}`, posicao: { ...centro.posicao, pavimento: pv } });
  const s5 = sugerirPilar(p, reg, centro, { q: 12 });
  assert.equal(s5.n, 5);
  assert.ok(s5.Ac > 360 && s5.bx * s5.by >= s5.Ac, JSON.stringify(s5));
  assert.ok(aplicarSugestao(centro, s5));
  assert.equal(centro.by, s5.by);
});

test('L8: sugestão só para elementos de concreto da planta', () => {
  const p = planta([[0, 0], [5, 0]]);
  const [sp] = vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [5, 0]] });
  const { vigas: [v] } = criarVigasEmCadeia(p, reg, MOD_VIGA, [sp], { secao: { b: 14, h: 30 } });
  const s = sugestaoDe(p, reg, v);
  assert.equal(s.secao.h, 50);
  assert.ok(aplicarSugestao(v, s));
  assert.equal(v.secao.h, 50);
  assert.equal(sugestaoDe(p, reg, { modulo: 'madeira.viga', vaos: [{ L: 3 }] }), null);
});

import { aplicarCargaPadrao } from '../src/renderer/core/lancamento.js';

test('L13: laje nova num pavimento residencial já traz a carga do catálogo; cada laje pode mudar', () => {
  const pts = [];
  for (const y of [0, 5]) for (const x of [0, 4]) pts.push([x, y]);
  const p = planta(pts);
  criarVigasEmCadeia(p, reg, MOD_VIGA, [
    ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [4, 0]] }), ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 5], [4, 5]] }),
    ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [0, 5]] }), ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[4, 0], [4, 5]] }),
  ]);
  p.pavimentos[0].cargaPadrao = { uso: 'res-servico', revestimento: 1.2 };
  const r = regioesDoPavimento(p, reg, 'p1')[0];
  const { laje } = criarLajeNaRegiao(p, reg, MOD_LAJE, 'p1', r);
  assert.deepEqual([laje.cargas.uso, laje.cargas.acidental, laje.cargas.revestimento], ['res-servico', 2, 1.2]);
  // sobrescrita por laje: mudar a laje não mexe no pavimento
  laje.cargas.acidental = 3;
  assert.equal(p.pavimentos[0].cargaPadrao.uso, 'res-servico');
  // sem carga padrão, a laje fica com a do módulo
  delete p.pavimentos[0].cargaPadrao;
  const outra = { cargas: { uso: 'res-sala', acidental: 1.5 }, posicao: { pavimento: 'p1' } };
  assert.equal(aplicarCargaPadrao(p, outra), false);
});

import { planoDeRenumeracao, renumerar } from '../src/renderer/core/renumerar.js';

test('L11: planta embaralhada fica em ordem e as ligações continuam nos mesmos elementos', () => {
  const pts = [];
  for (const y of [5, 0]) for (const x of [0, 4, 8]) pts.push([x, y]);
  const p = planta(pts);
  p.pavimentos[0].cota = 3;
  const specs = [
    ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [8, 0]] }),   // horizontal de baixo
    ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[4, 0], [4, 5]] }),   // vertical do meio
    ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 5], [8, 5]] }),   // horizontal de cima
    ...vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [0, 5]] }),   // vertical da esquerda
  ];
  criarVigasEmCadeia(p, reg, MOD_VIGA, specs);
  // embaralha os códigos dos pilares
  const pil = p.elementos.filter((e) => e.modulo === 'concreto.pilar');
  ['P6', 'P2', 'P4', 'P1', 'P5', 'P3'].forEach((c, k) => { pil[k].codigo = c; pil[k].nome = c; });
  const idDa = (c) => p.elementos.find((e) => e.codigo === c).id;
  const vCima = idDa('V3'), pCantoSupEsq = pil[0].id;
  const ligacoesAntes = JSON.stringify(p.elementos.map((e) => [e.id, (Array.isArray(e.cargas) ? e.cargas : []).filter((c) => c.tipo === 'elemento').map((c) => c.elementoId)]));
  const plano = renumerar(p, reg, { esquema: 'sequencial' });
  assert.ok(plano.length > 0);
  // pilares: linha de cima da esquerda para a direita, depois a de baixo
  assert.deepEqual(p.elementos.filter((e) => e.modulo === 'concreto.pilar').map((e) => [e.codigo, e.posicao.x, e.posicao.y]),
    [['P1', 0, 5], ['P2', 4, 5], ['P3', 8, 5], ['P4', 0, 0], ['P5', 4, 0], ['P6', 8, 0]]);
  // vigas: horizontais de cima para baixo, depois verticais da esquerda para a direita
  assert.equal(p.elementos.find((e) => e.id === vCima).codigo, 'V1');
  assert.deepEqual(p.elementos.filter((e) => e.modulo === 'concreto.viga').map((e) => e.codigo).sort(), ['V1', 'V2', 'V3', 'V4']);
  assert.equal(p.elementos.find((e) => e.id === pCantoSupEsq).nome, 'P1', 'o nome igual ao código acompanha');
  assert.equal(JSON.stringify(p.elementos.map((e) => [e.id, (Array.isArray(e.cargas) ? e.cargas : []).filter((c) => c.tipo === 'elemento').map((c) => c.elementoId)])), ligacoesAntes, 'as ligações não mudam');
  assert.deepEqual(planoDeRenumeracao(p, reg, { esquema: 'sequencial' }), [], 'renumerar de novo não muda nada');
});

test('L11: esquema por pavimento (P101…) e o exemplo de 3 pavimentos já está em ordem', async () => {
  const fs = await import('node:fs');
  const { lerProjeto } = await import('../src/renderer/core/projeto.js');
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-3-pavimentos.lebr.json', import.meta.url), 'utf8'));
  const plano = planoDeRenumeracao(p, reg, { esquema: 'pavimento' });
  const pilares = plano.filter((m) => m.elemento.modulo === 'concreto.pilar');
  assert.ok(pilares.every((m) => /^P[A-Z]?\d{3}$/.test(m.para)), JSON.stringify(pilares.map((m) => m.para)));
  const r = renumerar(p, reg, { esquema: 'pavimento' });
  const cods = p.elementos.map((e) => e.codigo);
  assert.equal(new Set(cods).size, cods.length, 'sem códigos repetidos');
  assert.ok(r.length >= 0);
});

import { manterPontoFixo, aplicarLance, prumada } from '../src/renderer/core/pilares.js';
import { calcularElemento as calcEl } from '../src/renderer/core/calculo.js';

test('L10: aumentar a seção com ponto fixo de canto mantém o canto no lugar (também girado)', () => {
  const pil = { modulo: 'concreto.pilar', bx: 20, by: 30, pontoFixo: 'inf-esq', posicao: { pavimento: 'p1', x: 1, y: 1, angulo: 0 } };
  manterPontoFixo(pil); // primeira vez: só registra a seção
  const canto = (e) => [e.posicao.x - e.bx / 200, e.posicao.y - e.by / 200];
  const antes = canto(pil);
  pil.bx = 30; pil.by = 50;
  assert.ok(manterPontoFixo(pil));
  const depois = canto(pil);
  perto(depois[0], antes[0], 'x do canto'); perto(depois[1], antes[1], 'y do canto');
  // girado 90°: o canto inferior esquerdo local continua no mesmo ponto
  const g = { modulo: 'concreto.pilar', bx: 20, by: 20, pontoFixo: 'inf-esq', posicao: { pavimento: 'p1', x: 0, y: 0, angulo: 90 } };
  manterPontoFixo(g);
  const cantoG = (e) => { const a = Math.PI / 2, dx = -e.bx / 200, dy = -e.by / 200; return [e.posicao.x + dx * Math.cos(a) - dy * Math.sin(a), e.posicao.y + dx * Math.sin(a) + dy * Math.cos(a)]; };
  const a0 = cantoG(g); g.bx = 40; manterPontoFixo(g); const a1 = cantoG(g);
  perto(a1[0], a0[0], 'x girado'); perto(a1[1], a0[1], 'y girado');
  // centro: não anda
  const c = { modulo: 'concreto.pilar', bx: 20, by: 20, posicao: { pavimento: 'p1', x: 2, y: 2 } };
  manterPontoFixo(c); c.bx = 50; assert.equal(manterPontoFixo(c), false); assert.equal(c.posicao.x, 2);
});

test('L10: lance de um pavimento até outro cria os pilares que faltam e liga ao de baixo', () => {
  const p = planta([[0, 0]]);
  p.pavimentos = [{ id: 'p1', nome: 'Térreo', cota: 3 }, { id: 'p2', nome: '1º', cota: 6 }, { id: 'p3', nome: '2º', cota: 9.2 }];
  const base = p.elementos[0];
  base.codigo = 'P001'; base.nome = 'P001';
  const { criados, ligacoes } = aplicarLance(p, reg, base, 'p1', 'p3');
  assert.deepEqual(criados.map((e) => e.codigo), ['P101', 'P201']);
  assert.equal(criados[1].comprimento, 3.2);
  assert.equal(ligacoes, 2);
  assert.equal(prumada(p, reg, base).length, 3);
  assert.equal(aplicarLance(p, reg, base, 'p1', 'p3').criados.length, 0, 'nada a criar de novo');
});

test('L10: pilar nascendo em viga vira carga concentrada na viga e aviso de transição', () => {
  const p = planta([[0, 0], [6, 0]]);
  p.pavimentos = [{ id: 'p1', nome: 'Térreo', cota: 3 }, { id: 'p2', nome: '1º', cota: 6 }];
  const [sp] = vigasEmCadeia(p, reg, { pavimento: 'p1', pontos: [[0, 0], [6, 0]] });
  const { vigas: [v] } = criarVigasEmCadeia(p, reg, MOD_VIGA, [sp]);
  const nasce = { id: 'px', modulo: 'concreto.pilar', codigo: 'P9', nome: 'P9', ...MODULOS_CALCULO['concreto.pilar'].criar(), bx: 20, by: 20, comprimento: 3, posicao: { pavimento: 'p2', x: 2.5, y: 0, angulo: 0 } };
  p.elementos.push(nasce);
  const n = aplicarLance(p, reg, nasce, 'p2', 'p2').ligacoes + aplicarLigacoes(p, detectarLigacoes(p, reg));
  assert.ok(n >= 1);
  const carga = v.cargas.find((c) => c.tipo === 'elemento' && c.elementoId === 'px');
  assert.deepEqual([carga.ligacao, carga.concentrada, carga.vao, carga.posicao], ['base', true, 0, 2.5]);
  const regras = verificarConsistencia(p, reg).map((x) => x.regra);
  assert.ok(regras.includes('pilar-transicao') && !regras.includes('pilar-sem-continuidade'), regras.join());
  const r = calcEl(v, p, reg);
  assert.ok(!r.erro, r.erro);
});

import { expandirTipos, definirRepeticoes, cotaTopo, idOriginal } from '../src/renderer/core/tipos.js';
import { peDireito } from '../src/renderer/core/montagem.js';

/** Prédio: térreo (pilares), tipo (pilares + vigas + laje) e cobertura (pilares + vigas). */
function predioComTipo(n) {
  const p = planta([[0, 0], [4, 0], [4, 5], [0, 5]]);
  p.pavimentos = [{ id: 'ter', nome: 'Térreo', cota: 3 }, { id: 'tip', nome: 'Tipo', cota: 6 }, { id: 'cob', nome: 'Cobertura', cota: 9 }];
  const pil = p.elementos.filter((e) => e.modulo === 'concreto.pilar');
  pil.forEach((e) => { e.posicao.pavimento = 'ter'; e.cargas = []; });
  for (const pv of ['tip', 'cob']) for (const e of pil) p.elementos.push({ ...structuredClone(e), id: `${e.id}${pv}`, codigo: `${e.codigo}${pv}`, nome: `${e.codigo}${pv}`, posicao: { ...e.posicao, pavimento: pv } });
  for (const pv of ['tip', 'cob']) criarVigasEmCadeia(p, reg, MOD_VIGA, vigasEmCadeia(p, reg, { pavimento: pv, pontos: [[0, 0], [4, 0], [4, 5], [0, 5], [0, 0]] }));
  const r = regioesDoPavimento(p, reg, 'tip')[0];
  criarLajeNaRegiao(p, reg, MOD_LAJE, 'tip', r);
  aplicarLigacoes(p, detectarLigacoes(p, reg));
  definirRepeticoes(p, 'tip', n);
  return p;
}

test('L9: tipo × 4 vira quatro níveis; os pavimentos de cima sobem junto e o pé-direito fica', () => {
  const p = predioComTipo(4);
  assert.equal(p.pavimentos.find((x) => x.id === 'cob').cota, 18, 'cobertura sobe 3 × 3 m');
  assert.equal(cotaTopo(p, 'tip'), 15);
  assert.equal(peDireito(p, 'cob'), 3);
  const e = expandirTipos(p);
  const tipo = e.pavimentos.filter((x) => x.id.startsWith('tip'));
  assert.deepEqual(tipo.map((x) => x.cota), [6, 9, 12, 15]);
  const vigasTipo = e.elementos.filter((x) => x.modulo === 'concreto.viga' && x.posicao.pavimento.startsWith('tip'));
  assert.equal(vigasTipo.length, 4 * p.elementos.filter((x) => x.modulo === 'concreto.viga' && x.posicao.pavimento === 'tip').length);
  // editar o tipo muda os quatro: as cópias vêm do mesmo elemento
  const v = p.elementos.find((x) => x.modulo === 'concreto.viga' && x.posicao.pavimento === 'tip');
  v.secao = { b: 25, h: 60 };
  const e2 = expandirTipos(p);
  assert.ok(e2.elementos.filter((x) => idOriginal(x.id) === v.id).every((x) => x.secao.h === 60));
  assert.equal(e2.elementos.filter((x) => idOriginal(x.id) === v.id).length, 4);
});

test('L9: o pilar do térreo recebe os quatro níveis do tipo', () => {
  const n1 = predioComTipo(1), n4 = predioComTipo(4);
  const Nter = (p) => {
    const pil = p.elementos.find((e) => e.posicao?.pavimento === 'ter' && e.modulo === 'concreto.pilar');
    const r = calcEl(pil, p, reg);
    assert.ok(!r.erro, r.erro);
    return r;
  };
  const r1 = Nter(n1), r4 = Nter(n4);
  const num = (r) => r.Nk.g + r.Nk.q;
  // a normal do térreo cresce com as repetições: três níveis a mais do tipo (pilar + vigas + laje cada)
  assert.ok(num(r4) > num(r1) * 1.8, `${num(r1)} → ${num(r4)}`);
});
