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
/** Quantitativos: concreto, fôrma e aço por bitola, somas por pavimento e CSV. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto, criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { quantitativosDoProjeto, quantitativosCSV, lerBarras, massaLinear, acoTotal } from '../src/modules/comum/quantitativos.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const perto = (a, b, tol) => Math.abs(a - b) <= tol;
const ordem = { sondagens: -1, lajes: 0, escadas: 0.5, reservatorios: 0.6, vigas: 1, pilares: 2, fundacoes: 3 };
function calculado(arq) {
  const p = lerProjeto(fs.readFileSync(new URL(`../exemplos/${arq}`, import.meta.url), 'utf8'));
  for (const e of [...p.elementos].sort((a, b) => (ordem[MODULOS_CALCULO[a.modulo].categoria] ?? 5) - (ordem[MODULOS_CALCULO[b.modulo].categoria] ?? 5))) e.resultado = calcularElemento(e, p, reg);
  return p;
}

test('leitura de rótulos de barras e massa nominal', () => {
  assert.deepEqual(lerBarras('7 ø 8'), { n: 7, phi: 8, s: null });
  assert.deepEqual(lerBarras('ø 10 c/ 17,5'), { n: null, phi: 10, s: 17.5 });
  assert.deepEqual(lerBarras('9 ø 12,5 c/ 14,5'), { n: 9, phi: 12.5, s: 14.5 });
  assert.equal(lerBarras('—'), null);
  assert.ok(perto(massaLinear(10), 0.617, 0.001));
  assert.ok(perto(massaLinear(12.5), 0.963, 0.001));
});

test('viga, laje e pilar: concreto e fôrma pela geometria, aço pelas armaduras', () => {
  const p = criarProjeto({});
  const v = { id: 'v', modulo: 'concreto.viga', codigo: 'V1', nome: 'V1', ...MODULOS_CALCULO['concreto.viga'].criar(p), secao: { b: 20, h: 50 }, vaos: [{ L: 5 }], apoios: ['apoio', 'apoio'] };
  const l = { id: 'l', modulo: 'concreto.laje.macica', codigo: 'L1', nome: 'L1', ...MODULOS_CALCULO['concreto.laje.macica'].criar(p), lx: 4, ly: 5, h: 12 };
  const pl = { id: 'p', modulo: 'concreto.pilar', codigo: 'P1', nome: 'P1', ...MODULOS_CALCULO['concreto.pilar'].criar(p), bx: 20, by: 40, comprimento: 3 };
  p.elementos.push(v, l, pl);
  for (const e of p.elementos) e.resultado = calcularElemento(e, p, reg);
  const q = quantitativosDoProjeto(p, reg);
  const Q = (c) => q.elementos.find((x) => x.codigo === c);
  assert.ok(perto(Q('V1').concreto, 0.2 * 0.5 * 5, 1e-9) && perto(Q('V1').forma, (0.2 + 2 * 0.5) * 5, 1e-9));
  assert.ok(perto(Q('L1').concreto, 4 * 5 * 0.12, 1e-9) && perto(Q('L1').forma, 20, 1e-9));
  assert.ok(perto(Q('P1').concreto, 0.2 * 0.4 * 3, 1e-9) && perto(Q('P1').forma, 2 * 0.6 * 3, 1e-9));
  // o aço da viga sai da lista de ferros do detalhamento: Σ n × C × massa linear, por bitola
  const pos = v.resultado.detalhamento.posicoes;
  const porPhi = {};
  for (const q of pos) porPhi[q.phi] = (porPhi[q.phi] ?? 0) + q.n * (q.comprimento / 100) * massaLinear(q.phi);
  for (const [phi, kg] of Object.entries(porPhi)) assert.ok(perto(Q('V1').aco[phi], kg, 1e-9), `ø${phi}`);
  // e as edições do usuário entram: dobrar a quantidade da N1 soma a massa dela
  const N1 = pos[0];
  v.detalhamento = { edicoes: { [N1.id]: { n: 2 * N1.n } } };
  const q2 = quantitativosDoProjeto(p, reg).elementos.find((x) => x.codigo === 'V1');
  assert.ok(perto(q2.aco[N1.phi], Q('V1').aco[N1.phi] + N1.n * (N1.comprimento / 100) * massaLinear(N1.phi), 1e-9));
  for (const c of ['V1', 'L1', 'P1']) assert.ok(acoTotal(Q(c)) > 0, c);
});

test('a tabela soma por pavimento: subtotais e total do projeto fecham', () => {
  const p = calculado('edificio-3-pavimentos.lebr.json');
  const q = quantitativosDoProjeto(p, reg);
  assert.equal(q.sem.length, 0);
  assert.ok(q.pavimentos.some((g) => g.nome === 'Fundações') && q.pavimentos.some((g) => g.nome === 'Baldrame'));
  for (const g of q.pavimentos) {
    assert.ok(perto(g.concreto, g.elementos.reduce((s, e) => s + e.concreto, 0), 1e-9), g.nome);
    assert.ok(perto(acoTotal(g), g.elementos.reduce((s, e) => s + acoTotal(e), 0), 1e-6), g.nome);
    assert.ok(perto(g.concreto, Object.values(g.porTipo).reduce((s, x) => s + x.concreto, 0), 1e-9));
  }
  assert.ok(perto(q.total.concreto, q.pavimentos.reduce((s, g) => s + g.concreto, 0), 1e-9));
  assert.ok(perto(q.total.forma, q.pavimentos.reduce((s, g) => s + g.forma, 0), 1e-9));
  for (const phi of q.bitolas) assert.ok(perto(q.total.aco[phi], q.pavimentos.reduce((s, g) => s + (g.aco[phi] ?? 0), 0), 1e-6));
  // pavimentos-tipo iguais: concreto igual
  const pav = (n) => q.pavimentos.find((g) => g.nome === n);
  assert.ok(perto(pav('1º pavimento').concreto, pav('2º pavimento').concreto, 1e-9));
  assert.ok(q.total.estacas.metros > 0, 'estacas dos blocos');
  const taxa = acoTotal(q.total) / q.total.concreto;
  assert.ok(taxa > 15 && taxa < 150, `taxa ${taxa}`);
});

test('CSV: separador ponto e vírgula, vírgula decimal, BOM, uma linha por elemento e subtotais', () => {
  const p = calculado('edificio-3-pavimentos.lebr.json');
  const q = quantitativosDoProjeto(p, reg);
  const csv = quantitativosCSV(q, { projeto: p });
  assert.ok(csv.startsWith('﻿'));
  const linhas = csv.replace(/^﻿/, '').trim().split('\r\n');
  const i = linhas.findIndex((l) => l.startsWith('Pavimento;'));
  const cab = linhas[i].split(';');
  assert.ok(cab.includes('Concreto (m³)') && cab.includes('Fôrma (m²)') && cab.some((c) => c.startsWith('ø 10')));
  const fim = linhas.findIndex((l) => l.startsWith('Total do projeto'));
  const dados = linhas.slice(i + 1, fim + 1).map((l) => l.split(';'));
  assert.ok(dados.every((d) => d.length === cab.length), 'todas as linhas com as mesmas colunas');
  assert.equal(dados.length, q.elementos.length + q.pavimentos.length + 1);
  const n = (s) => Number(s.replace(',', '.'));
  const c = cab.indexOf('Concreto (m³)');
  const total = dados.at(-1);
  assert.equal(total[0], 'Total do projeto');
  const subtotais = dados.filter((d) => d[1] === 'Subtotal').reduce((s, d) => s + n(d[c]), 0);
  assert.ok(perto(subtotais, n(total[c]), 0.01));
  assert.ok(/^\d+,\d{3}$/.test(total[c]), 'vírgula decimal');
  // resumo do aço com perdas no fim: a soma por bitola fecha com o total, e as perdas (10 %) entram
  const r = linhas.findIndex((l) => l.startsWith('Resumo do aço'));
  assert.ok(r > fim);
  const res = linhas.slice(r + 2).map((l) => l.split(';'));
  const kg = res.slice(0, -1).reduce((s, d) => s + n(d[3]), 0);
  assert.ok(perto(kg, n(res.at(-1)[3]), 0.5));
  assert.ok(perto(n(res.at(-1)[4]), 1.1 * n(res.at(-1)[3]), 0.5));
});
