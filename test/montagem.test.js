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
/**
 * Montagem da estrutura: pavimentos, geometria em planta e ligações por geometria.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { criarProjeto, lerProjeto } from '../src/renderer/core/projeto.js';
import {
  detectarLigacoes, aplicarLigacoes, ligacoesExistentes, avisosMontagem, bordasLaje, eixoViga,
  pavimentoAbaixo, peDireito, espessuraLaje,
} from '../src/renderer/core/montagem.js';
import * as viga from '../src/modules/concreto-viga/calculo.js';
import * as laje from '../src/modules/concreto-laje-macica/calculo.js';
import * as pilar from '../src/modules/concreto-pilar/calculo.js';
import * as trel from '../src/modules/concreto-laje-trelicada/calculo.js';

const registro = {
  mods: {
    'concreto.viga': { categoria: 'vigas', ...viga },
    'concreto.laje.macica': { categoria: 'lajes', ...laje },
    'concreto.pilar': { categoria: 'pilares', ...pilar },
    'concreto.laje.trelicada': { categoria: 'lajes', ...trel },
  },
  obter(id) { return this.mods[id]; },
};
const pos = (pavimento, x, y, angulo = 0) => ({ pavimento, x, y, angulo });
const perto = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);

test('projeto novo tem um pavimento; arquivo antigo ganha um ao abrir', () => {
  assert.equal(criarProjeto().pavimentos.length, 1);
  const antigo = JSON.stringify({ formato: 'lebr.projeto', versao: 1, meta: { nome: 'x' }, parametros: {}, elementos: [] });
  assert.equal(lerProjeto(antigo).pavimentos.length, 1);
});

test('pavimentos: ordem por cota, nível de baixo e pé-direito', () => {
  const p = criarProjeto();
  p.pavimentos = [{ id: 'b', nome: 'Cobertura', cota: 5.8 }, { id: 'a', nome: 'Térreo', cota: 0 }, { id: 'c', nome: '1º', cota: 2.9 }];
  assert.equal(pavimentoAbaixo(p, 'b').id, 'c');
  assert.equal(pavimentoAbaixo(p, 'a'), null);
  perto(peDireito(p, 'b'), 2.9, 'pé-direito');
});

test('geometria: bordas da laje e eixo da viga giram com o ângulo', () => {
  const l = { ...laje.criarLaje(), lx: 4, ly: 2, posicao: pos('pav1', 1, 1, 90) };
  const b = bordasLaje(l);
  perto(b.y0[1][0], 1, 'x do canto inferior direito girado'); perto(b.y0[1][1], 5, 'y');
  const v = { ...viga.criarViga(), vaos: [{ L: 3 }, { L: 2 }], posicao: pos('pav1', 0, 0, 90) };
  const e = eixoViga(v);
  perto(e.apoios[1][1], 3, 'apoio 2 em y = 3'); perto(e.b[1], 5, 'fim da viga');
  assert.equal(espessuraLaje({ he: 12, hf: 4 }), 16);
});

test('projeto de exemplo: todas as ligações existentes coincidem com a planta', () => {
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-exemplo.lebr.json', import.meta.url), 'utf8'));
  const det = detectarLigacoes(p, registro);
  const exist = ligacoesExistentes(p, registro, det);
  assert.ok(exist.length >= 20);
  assert.deepEqual(exist.filter((l) => l.situacao !== 'ok').map((l) => l.texto), []);
  assert.equal(aplicarLigacoes(structuredClone(p), det), 0, 'nada novo a conectar');
});

test('conectar: laje sobre viga escolhe os vãos cobertos; viga sobre pilar; pilar sobre pilar', () => {
  const p = criarProjeto();
  p.pavimentos = [{ id: 't', nome: 'Térreo', cota: 0 }, { id: 'p1', nome: '1º', cota: 3 }];
  const add = (mod, id, extra) => { const e = { id, modulo: mod, codigo: id.toUpperCase(), nome: id, ...registro.obter(mod).criar?.() ?? {}, ...extra }; p.elementos.push(e); return e; };
  registro.mods['concreto.viga'].criar = viga.criarViga;
  registro.mods['concreto.laje.macica'].criar = laje.criarLaje;
  registro.mods['concreto.pilar'].criar = pilar.criarPilar;
  const l = add('concreto.laje.macica', 'l1', { lx: 4, ly: 3, posicao: pos('p1', 0, 0) });
  const v = add('concreto.viga', 'v1', { vaos: [{ L: 4 }, { L: 3 }], apoios: ['apoio', 'apoio', 'apoio'], cargas: [], posicao: pos('p1', 0, 0) });
  const pc = add('concreto.pilar', 'pc', { cargas: [], posicao: pos('p1', 4, 0) });
  const pt = add('concreto.pilar', 'pt', { cargas: [], posicao: pos('t', 4.05, 0) });
  const det = detectarLigacoes(p, registro);
  const lv = det.find((d) => d.tipo === 'laje-viga');
  assert.equal(lv.ligacao, 'y0'); assert.equal(lv.vao, 0, 'laje de 4 m cobre só o vão 1');
  assert.ok(det.some((d) => d.tipo === 'viga-pilar' && d.receptor.id === 'pc' && d.ligacao === 'apoio-1'));
  assert.ok(det.some((d) => d.tipo === 'pilar-pilar' && d.receptor.id === 'pt' && d.fonte.id === 'pc'));
  const n = aplicarLigacoes(p, det);
  assert.equal(n, det.length);
  assert.equal(aplicarLigacoes(p, detectarLigacoes(p, registro)), 0, 'não duplica');
  assert.ok(v.cargas.some((c) => c.elementoId === 'l1' && c.vao === 0));
  // pé-direito: o pilar do térreo (cota 0) não tem lance; o do 1º tem 3 m e comprimento 2,8
  assert.ok(avisosMontagem(p, registro).some((a) => a.elemento.id === 'pc' && a.ajustarComprimento === 3));
  void l; void pt;
});

test('laje treliçada liga só as extremidades (apoio-a / apoio-b) e respeita a borda livre', () => {
  const p = criarProjeto();
  const lt = { id: 'lt', modulo: 'concreto.laje.trelicada', codigo: 'LT1', nome: 'LT1', ...trel.criarLajeTrelicada(), L: 1.5, largura: 4, posicao: pos('pav1', 0, 0, 90) };
  lt.bordas = { ...lt.bordas, x0: 'engastada', x1: 'livre' };
  const v = { id: 'v', modulo: 'concreto.viga', codigo: 'V1', nome: 'V1', ...viga.criarViga(), vaos: [{ L: 4 }], cargas: [], posicao: pos('pav1', 0, 0, 180) };
  // vigota gira 90°: x0 (engaste) fica sobre y = 0, de x = 0 a x = -4 → viga de 0 a -4 (ângulo 180°)
  p.elementos.push(lt, v);
  const det = detectarLigacoes(p, registro);
  assert.deepEqual(det.map((d) => [d.ligacao, d.vao]), [['apoio-a', 'todos']]);
});

test('duplicar elemento: a cópia fica sem posição e sem as reações de outros elementos', async () => {
  const { estado } = await import('../src/renderer/core/estado.js');
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-exemplo.lebr.json', import.meta.url), 'utf8'));
  estado.abrir(p, null);
  const v1 = estado.projeto.elementos.find((e) => e.codigo === 'V1');
  const nElem = v1.cargas.filter((c) => c.tipo === 'elemento').length;
  assert.ok(v1.posicao && nElem > 0, 'o exemplo tem V1 posicionada e com reações de lajes');
  const copia = estado.duplicarElemento(v1.id);
  assert.equal(copia.posicao, undefined, 'a cópia vai para "Não posicionados"');
  assert.equal(copia.cargas.filter((c) => c.tipo === 'elemento').length, 0, 'sem contar a laje duas vezes');
  assert.equal(copia.cargas.length, v1.cargas.length - nElem, 'as demais cargas são copiadas');
  assert.equal(estado.ultimaDuplicacao.ligacoesRemovidas, nElem);
  assert.ok(v1.posicao, 'o original continua posicionado');
});

test('códigos: ordem alfabética natural e formato aceito', async () => {
  const { compararCodigos, CODIGO_VALIDO } = await import('../src/renderer/core/formatar.js');
  assert.deepEqual(['V10', 'V2', 'V1', 'v3'].sort(compararCodigos), ['V1', 'V2', 'v3', 'V10']);
  for (const ok of ['V1', 'V-101', 'L2.a', 'P/3', 'VA1']) assert.ok(CODIGO_VALIDO.test(ok), ok);
  for (const ruim of ['', '-V1', 'V 1', 'ABCDEFGHIJKLM']) assert.ok(!CODIGO_VALIDO.test(ruim), ruim);
});

test('treliçada com vigotas em y: planta lx × ly e ligação nas vigas de baixo e de cima', async () => {
  const { dimensoesLaje } = await import('../src/renderer/core/montagem.js');
  const p = criarProjeto();
  const lt = { id: 'lt', modulo: 'concreto.laje.trelicada', codigo: 'LT1', nome: 'LT1', ...trel.criarLajeTrelicada(), L: 3, largura: 4, direcao: 'y', posicao: pos('pav1', 0, 0, 0) };
  assert.deepEqual(dimensoesLaje(lt), { lx: 4, ly: 3 });
  const baixo = { id: 'vb', modulo: 'concreto.viga', codigo: 'V1', nome: 'V1', ...viga.criarViga(), vaos: [{ L: 4 }], cargas: [], posicao: pos('pav1', 0, 0, 0) };
  const cima = { id: 'vc', modulo: 'concreto.viga', codigo: 'V2', nome: 'V2', ...viga.criarViga(), vaos: [{ L: 4 }], cargas: [], posicao: pos('pav1', 0, 3, 0) };
  const lado = { id: 'vl', modulo: 'concreto.viga', codigo: 'V3', nome: 'V3', ...viga.criarViga(), vaos: [{ L: 3 }], cargas: [], posicao: pos('pav1', 0, 0, 90) };
  p.elementos.push(lt, baixo, cima, lado);
  const det = detectarLigacoes(p, registro).filter((d) => d.fonte.id === 'lt');
  assert.deepEqual(det.map((d) => [d.receptor.codigo, d.ligacao]).sort(), [['V1', 'apoio-a'], ['V2', 'apoio-b']], 'a viga lateral (V3) não recebe vigotas');
});
