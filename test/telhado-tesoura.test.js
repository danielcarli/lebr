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
/** Telhado e tesoura de madeira (0.60) e ganchos pela Tabela 9.1 da NBR 6118. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { geometriaTesoura, resolverTrelica, entalheApoio } from '../src/engine/tesoura.js';
import { madeira } from '../src/engine/madeira.js';
import { pinoGancho, pernaGancho90, raioDobraEixo } from '../src/engine/detalhamento.js';
import { lerProjeto, criarProjeto } from '../src/renderer/core/projeto.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { detectarLigacoes } from '../src/renderer/core/montagem.js';
import { cargasNosTesoura, geometriaTelhado } from '../src/modules/madeira-telhado/calculo.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const perto = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} ≠ ${b}`);

test('treliça: tesoura simples (perna, linha e pendural) com carga P na cumeeira bate com o equilíbrio de nós', () => {
  const g = geometriaTesoura({ tipo: 'howe', L: 8, inclinacao: 35, paineis: 2 });
  const P = 10;
  const r = resolverTrelica({ nos: g.nos, barras: g.barras.map((b) => ({ ...b, EA: 1e5 })), apoios: { [g.inf[0]]: [true, true], [g.inf[2]]: [false, true] }, cargas: { [g.sup[1]]: [0, -P] } });
  const k = (nome) => g.barras.findIndex((b) => b.nome === nome);
  perto(r.N[k('Banzo superior 1')], -P / (2 * Math.sin(g.alfa)), 'perna', 1e-6);
  perto(r.N[k('Banzo inferior 1')], P / (2 * Math.tan(g.alfa)), 'linha', 1e-6);
  perto(r.N[k('Pendural')], 0, 'pendural', 1e-6);
  perto(r.reacoes[g.inf[0]][1] + r.reacoes[g.inf[2]][1], P, 'ΣRy = P', 1e-9);
});

test('treliça Howe: montantes tracionados, diagonais comprimidas e simetria; Pratt ao contrário', () => {
  for (const tipo of ['howe', 'pratt']) {
    const g = geometriaTesoura({ tipo, L: 10, inclinacao: 30, paineis: 8 });
    const cargas = {}; for (let i = 1; i < g.n; i++) cargas[g.sup[i]] = [0, -5];
    const r = resolverTrelica({ nos: g.nos, barras: g.barras.map((b) => ({ ...b, EA: 1e5 })), apoios: { [g.inf[0]]: [true, true], [g.inf[g.n]]: [false, true] }, cargas });
    const N = (grupo) => g.barras.map((b, k) => (b.grupo === grupo ? r.N[k] : null)).filter((v) => v != null && Math.abs(v) > 1e-6);
    if (tipo === 'howe') { assert.ok(N('montante').every((v) => v > 0)); assert.ok(N('diagonal').every((v) => v < 0)); }
    else { assert.ok(N('montante').every((v) => v < 0)); assert.ok(N('diagonal').every((v) => v > 0)); }
    assert.ok(N('banzoSup').every((v) => v < 0) && N('banzoInf').every((v) => v > 0));
    perto(r.reacoes[g.inf[0]][1], r.reacoes[g.inf[g.n]][1], 'simetria', 1e-9);
    perto(r.reacoes[g.inf[0]][1] * 2, 5 * (g.n - 1), 'ΣRy', 1e-9);
  }
});

test('entalhe: Hankinson e profundidade e = Nd·cos α/(b·fc,α,d)', () => {
  const m = madeira('D40');
  const alfa = Math.atan(0.35);
  const e = entalheApoio({ Nd: 50, alfa, b: 6, hInf: 16, m });
  const fca = (m.fc0d * m.fc90d) / (m.fc0d * Math.sin(alfa) ** 2 + m.fc90d * Math.cos(alfa) ** 2);
  perto(e.fca, fca, 'fc,α,d');
  perto(e.eNec, (50 * Math.cos(alfa) / (6 * fca)) * 10, 'e');
  assert.equal(e.ok, e.eNec <= 4 + 1e-9);
});

test('telhado: cargas nos nós somam o peso por tesoura e a tesoura ligada usa a geometria do telhado', () => {
  const p = criarProjeto();
  const tel = { id: 't1', codigo: 'TH1', nome: 'T', modulo: 'madeira.telhado', ...MODULOS_CALCULO['madeira.telhado'].criar(p), vao: 9, comprimento: 12, paineis: 6, beiral: 0 };
  const tes = { id: 's1', codigo: 'TS1', nome: 'S', modulo: 'madeira.tesoura', ...MODULOS_CALCULO['madeira.tesoura'].criar(p), telhadoId: 't1' };
  p.elementos.push(tel, tes);
  const rt = calcularElemento(tel, p, reg);
  assert.ok(!rt.erro, rt.erro);
  const geo = geometriaTelhado(tel), c = cargasNosTesoura(tel, p.parametros);
  const somaG = c.sup.reduce((s, x) => s + x.G, 0);
  perto(somaG, (c.ps.g * 2 * geo.s + c.ppTerca * (geo.n + 1)) * geo.et, 'ΣG nos nós', 1e-9);
  const rs = calcularElemento(tes, p, reg);
  assert.ok(!rs.erro, rs.erro);
  assert.equal(rs.L, 9); assert.equal(rs.paineis, 6); perto(rs.et, geo.et, 'espaçamento');
  // reações = metade de tudo (nós + peso próprio)
  perto(rs.apoios[0].Rg + rs.apoios[1].Rg, somaG + rs.peso, 'ΣRg', 1e-3);
  // oitões: a carga total se reparte entre beirais e empenas
  tel.extremidades = 'oitoes';
  const ro = calcularElemento(tel, p, reg);
  perto(2 * ro.reacoes.a.g * geo.C + 2 * ro.reacoes.oitao.g * geo.L, ro.reacoes.Gtot, 'Σ apoios = peso total', 1e-6);
});

test('sobrado: telhado nos oitões e beirais ligado às vigas da cobertura, tesoura atende', () => {
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/sobrado-garagem.lebr.json', import.meta.url), 'utf8'));
  const tel = p.elementos.find((e) => e.modulo === 'madeira.telhado');
  assert.ok(tel?.posicao);
  const ligs = detectarLigacoes(p, reg).filter((l) => l.tipo === 'telhado-viga');
  assert.deepEqual([...new Set(ligs.map((l) => l.ligacao))].sort(), ['apoio-a', 'apoio-b', 'oitao-0', 'oitao-1']);
  for (const l of ligs) assert.ok(l.receptor.cargas.some((c) => c.tipo === 'elemento' && c.elementoId === tel.id && c.ligacao === l.ligacao), `${l.texto} aplicada`);
  const ts = p.elementos.find((e) => e.modulo === 'madeira.tesoura');
  const r = calcularElemento(ts, p, reg);
  assert.ok(r.ok, r.verificacoes?.filter((v) => !v.ok).map((v) => v.nome).join());
});

test('ganchos: pino da Tabela 9.1 e perna de 8ø depois da dobra (9.4.2.3)', () => {
  assert.equal(pinoGancho(10), 5); assert.equal(pinoGancho(20), 8); assert.equal(pinoGancho(8, 'CA-60'), 6); assert.equal(pinoGancho(25, 'CA-25'), 5);
  perto(raioDobraEixo(10), 3, 'R ø10 = 3ø (cm)');
  perto(pernaGancho90(10), 11, 'perna ø10 = 11ø (cm)');
  perto(pernaGancho90(20), 25, 'perna ø20 = 12,5ø (cm)');
});

test('comando: telhado sobre o pavimento mais alto com a cumeeira no sentido mais comprido e beirais ligados', async () => {
  const { criarTelhadoNaCobertura } = await import('../src/renderer/core/telhados.js');
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-3-pavimentos.lebr.json', import.meta.url), 'utf8'));
  const r = criarTelhadoNaCobertura(p, reg);
  assert.ok(r && r.ligacoes >= 2, JSON.stringify(r));
  assert.equal(criarTelhadoNaCobertura(p, reg), null, 'não duplica');
  const tel = p.elementos.find((e) => e.id === r.telhado);
  assert.ok(tel.vao <= tel.comprimento);
  const rt = calcularElemento(tel, p, reg);
  assert.ok(!rt.erro, rt.erro);
  const ts = p.elementos.find((e) => e.id === r.tesoura);
  assert.ok(!calcularElemento(ts, p, reg).erro);
});

test('modelo 3D do telhado: tesouras com as barras da treliça, terças em cada nó, duas águas de telha e oitões', async () => {
  const { modeloTelhado, modeloTesoura } = await import('../src/modules/madeira-comum/telhado3d.js');
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/sobrado-garagem.lebr.json', import.meta.url), 'utf8'));
  const tel = p.elementos.find((e) => e.modulo === 'madeira.telhado'), ts = p.elementos.find((e) => e.modulo === 'madeira.tesoura');
  const g = geometriaTelhado(tel);
  const m = modeloTelhado(tel, { secoes: ts.secoes, tipo: ts.geometria.tipo });
  const nBarras = geometriaTesoura({ tipo: 'howe', L: g.L, inclinacao: g.i, paineis: g.n }).barras.length;
  const conta = (t) => m.pecas.filter((q) => q.tipo === t).length;
  assert.equal(conta('tesoura'), g.tesouras.length * nBarras);
  assert.equal(conta('terca'), g.n + 1);
  assert.equal(conta('telha'), 2);
  assert.ok(conta('caibro') > 10 && conta('ripa') > 10);
  assert.equal(m.empenas.length, 2);
  // terças apoiadas no banzo superior: a face inferior de cada terça toca a face superior da perna
  const t0 = m.pecas.find((q) => q.tipo === 'terca' && q.rotulo.startsWith('Cumeeira'));
  assert.ok(Math.abs(t0.p[0] - g.L * 50) < 1e-6);
  const r = calcularElemento(ts, p, reg);
  const mt = modeloTesoura(r, ts.secoes);
  assert.equal(mt.pecas.length, r.barras.length);
  assert.ok(mt.pecas.some((q) => q.tipo === 'tracao') && mt.pecas.some((q) => q.tipo === 'compressao'));
});
