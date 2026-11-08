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
/** Detalhamento das armaduras de vigas: ancoragens, cortes, ganchos, emendas, lista de ferros e edições. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto, criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { detalharViga, aplicarEdicoes, resumoAco, massaLinear, fbd, ancoragemBasica, boaAderencia, COMPRIMENTO_COMERCIAL } from '../src/engine/detalhamento.js';

import { detalhamentoDe, posicoesDe, baseDoPilar, vizinhasNaBorda } from '../src/modules/comum/detalhamento.js';
import { quantitativosDoProjeto } from '../src/modules/comum/quantitativos.js';
import { barrasProtegidas, resumoComPerdas } from '../src/engine/detalhamento.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const perto = (a, b, tol) => Math.abs(a - b) <= tol;
const ordem = { sondagens: -1, lajes: 0, escadas: 0.5, reservatorios: 0.6, vigas: 1, pilares: 2, fundacoes: 3 };
function calculado(arq) {
  const p = lerProjeto(fs.readFileSync(new URL(`../exemplos/${arq}`, import.meta.url), 'utf8'));
  for (const e of [...p.elementos].sort((a, b) => (ordem[MODULOS_CALCULO[a.modulo].categoria] ?? 5) - (ordem[MODULOS_CALCULO[b.modulo].categoria] ?? 5))) e.resultado = calcularElemento(e, p, reg);
  return p;
}
function viga(dados) {
  const p = criarProjeto({});
  const v = { id: 'v', modulo: 'concreto.viga', codigo: 'V1', nome: 'V1', posicao: { pavimento: p.pavimentos[0]?.id, x: 0, y: 0, angulo: 0 }, ...MODULOS_CALCULO['concreto.viga'].criar(p), ...dados };
  p.elementos.push(v);
  v.resultado = calcularElemento(v, p, reg);
  return v;
}
const fctd = (0.21 * 25 ** (2 / 3)) / 1.4, fyd = 500 / 1.15;

test('aderência: boa na face inferior; má no topo de vigas com h > 30 cm', () => {
  assert.equal(boaAderencia({ h: 50, distanciaFundo: 5 }), true);
  assert.equal(boaAderencia({ h: 50, distanciaFundo: 46 }), false);
  assert.equal(boaAderencia({ h: 25, distanciaFundo: 21 }), true);
  assert.equal(boaAderencia({ h: 80, distanciaFundo: 45 }), true);   // h ≥ 60: até 30 cm abaixo do topo
  assert.equal(boaAderencia({ h: 80, distanciaFundo: 76 }), false);
  assert.ok(perto(fbd({ fctd, boa: false }), 0.7 * fbd({ fctd, boa: true }), 1e-12));
  assert.ok(perto(ancoragemBasica({ phi: 12.5, fyd, fbd: fbd({ fctd }) }), 47.09, 0.01));
});

test('viga biapoiada: barras de canto com ganchos, corte simétrico e lista de ferros fechada', () => {
  const v = viga({ secao: { b: 20, h: 50 }, vaos: [{ L: 5 }], apoios: ['apoio', 'apoio'] });
  const d = v.resultado.detalhamento;
  assert.ok(d && d.posicoes.length >= 3);
  const pos = d.posicoes.filter((q) => q.tipo === 'positiva');
  const nPos = pos.reduce((s, q) => s + q.n, 0);
  assert.equal(nPos, v.resultado.vaos[0].positiva.barras.n, 'todas as barras positivas no detalhamento');
  const canto = pos.find((q) => q.corrida);
  assert.deepEqual(canto.gancho, [true, true]);
  for (const q of pos.filter((x) => !x.corrida)) {
    // os cortes ficam simétricos numa viga simétrica
    assert.ok(perto(q.x0, 5 - q.x1, 0.02), `${q.N}: ${q.x0} × ${5 - q.x1}`);
  }
  // numeração contínua e ids estáveis
  d.posicoes.forEach((q, i) => assert.equal(q.N, `N${i + 1}`));
  assert.ok(d.posicoes.some((q) => q.tipo === 'estribo') && d.posicoes.some((q) => q.tipo === 'porta-estribo'));
  assert.ok(d.verificacoes.every((x) => x.ok));
});

test('viga contínua de dois vãos iguais: negativas centradas no apoio interno', () => {
  const v = viga({ secao: { b: 20, h: 50 }, vaos: [{ L: 5 }, { L: 5 }], apoios: ['apoio', 'apoio', 'apoio'] });
  const negs = v.resultado.detalhamento.posicoes.filter((q) => q.tipo === 'negativa');
  assert.ok(negs.length >= 1);
  const nNeg = negs.reduce((s, q) => s + q.n, 0);
  assert.equal(nNeg, v.resultado.apoios[1].negativa.barras.n);
  for (const q of negs) assert.ok(perto(5 - q.x0, q.x1 - 5, 0.02), `${q.N} centrada em x = 5 m`);
  // a negativa vai além do ponto de momento nulo (≈ l/4 = 1,25 m) somando aℓ + lb
  const maior = negs.reduce((a, q) => (q.x1 - q.x0 > a.x1 - a.x0 ? q : a));
  assert.ok(maior.x1 - 5 > 1.25 + (maior.al + maior.lb) / 100 - 0.05);
  // porta-estribos cobrem o topo fora das negativas
  assert.equal(v.resultado.detalhamento.posicoes.filter((q) => q.tipo === 'porta-estribo').length, 2);
});

test('balanço: negativas até a ponta livre com gancho e barras construtivas embaixo', () => {
  const v = viga({ secao: { b: 20, h: 50 }, vaos: [{ L: 4 }, { L: 1.5 }], apoios: ['apoio', 'apoio', 'livre'] });
  const d = v.resultado.detalhamento;
  const neg = d.posicoes.filter((q) => q.tipo === 'negativa');
  assert.ok(neg.some((q) => q.gancho[1] && perto(q.x1, 5.5 - 0.03, 1e-6)), 'chega à ponta com o cobrimento');
  assert.ok(d.posicoes.some((q) => q.tipo === 'construtiva' && q.local.startsWith('Vão 2')));
});

test('barra acima de 12 m leva emenda por traspasse', () => {
  const pts = Array.from({ length: 101 }, (_, i) => ({ x: i * 0.15, Md: 400 * 4 * (i / 100) * (1 - i / 100), MdMin: 0 }));
  const d = detalharViga({ L: [15], apoios: ['apoio', 'apoio'], b: 25, h: 100, cob: 3, fctd, fyd, largura: 30, pts,
    vaos: [{ barras: { phi: 20, n: 4 }, d: 92, Vd: 150, Vc: 170, estribo: { phi: 6.3, s: 20 } }], negs: [null, null], Rd: [150, 150] });
  const canto = d.posicoes.find((q) => q.corrida);
  assert.ok(canto.comprimento > COMPRIMENTO_COMERCIAL && canto.emendas === 1 && canto.l0t > 0);
  // pele em h > 60 cm
  assert.ok(d.posicoes.some((q) => q.tipo === 'pele'));
});

test('largura dos apoios: a do pilar na direção da viga, ou a informada', () => {
  const p = calculado('edificio-exemplo.lebr.json');
  const v1 = p.elementos.find((e) => e.codigo === 'V1');
  const larg = v1.resultado.detalhamento.larguras;
  assert.ok(larg.every((l) => l > 0));
  const ligado = p.elementos.find((e) => e.modulo === 'concreto.pilar' && e.cargas.some((c) => c.elementoId === v1.id && c.ligacao === 'apoio-0'));
  assert.equal(larg[0], ligado.bx); // viga a 0°: a dimensão bx do pilar
  v1.detalhamento = { largura: 35 };
  const r = calcularElemento(v1, p, reg);
  assert.ok(r.detalhamento.larguras.every((l) => l === 35));
});

test('edições: bitola, quantidade e comprimento mudam a massa e o resumo por bitola', () => {
  const v = viga({ secao: { b: 20, h: 50 }, vaos: [{ L: 5 }], apoios: ['apoio', 'apoio'] });
  const base = aplicarEdicoes(v.resultado.detalhamento.posicoes);
  const N1 = base[0];
  const ed = aplicarEdicoes(v.resultado.detalhamento.posicoes, { [N1.id]: { phi: 16, n: 3, comprimento: 600 } });
  assert.equal(ed[0].editada, true);
  assert.ok(perto(ed[0].massa, 3 * 6 * massaLinear(16), 1e-9));
  const r = resumoAco(ed);
  assert.ok(perto(r.total, ed.reduce((s, q) => s + q.massa, 0), 1e-9));
  assert.ok(r.linhas.some((l) => l.phi === 16));
  // edições vazias não marcam a posição
  assert.equal(aplicarEdicoes(base, { [N1.id]: {} })[0].editada, false);
});

test('exemplos: todas as vigas detalhadas, ancoragens atendidas e aço coerente com As', () => {
  for (const arq of ['edificio-exemplo.lebr.json', 'residencia-terrea-baldrame.lebr.json', 'edificio-3-pavimentos.lebr.json']) {
    const p = calculado(arq);
    for (const v of p.elementos.filter((e) => e.modulo === 'concreto.viga')) {
      const d = v.resultado.detalhamento;
      assert.ok(d?.posicoes?.length, `${arq} ${v.codigo} sem detalhamento`);
      const falhas = d.verificacoes.filter((x) => !x.ok);
      assert.equal(falhas.length, 0, `${arq} ${v.codigo}: ${falhas.map((f) => f.nome).join(', ')}`);
      v.resultado.vaos.forEach((vv, k) => {
        if (!vv.positiva?.barras) return;
        const n = d.posicoes.filter((q) => q.tipo === 'positiva' && q.local === `Vão ${k + 1}`).reduce((s, q) => s + q.n, 0);
        assert.equal(n, vv.positiva.barras.n, `${v.codigo} vão ${k + 1}`);
      });
    }
  }
});

/* ------------------------------------------------------------------ pilares e lajes (etapa 21) */

test('pilares do exemplo de 3 pavimentos: arranques no bloco, traspasse para cima e último lance sem traspasse', () => {
  const p = calculado('edificio-3-pavimentos.lebr.json');
  const P = (c) => p.elementos.find((e) => e.codigo === c);
  const base = detalhamentoDe(P('PB101'), P('PB101').resultado, p);
  assert.equal(baseDoPilar(P('PB101'), p).tipo, 'fundacao');
  const arr = base.posicoes.find((q) => q.tipo === 'arranque');
  const bloco = p.elementos.find((e) => e.modulo === 'concreto.bloco' && e.pilarId === P('PB101').id);
  assert.ok(arr && perto(arr.z0 * 100, -(bloco.resultado.h - bloco.resultado.cobrimento), 1e-6), 'arranque embutido até o fundo do bloco menos o cobrimento');
  assert.equal(arr.n, P('PB101').resultado.armadura.n);
  const meio = detalhamentoDe(P('P101'), P('P101').resultado, p);
  assert.equal(meio.base.tipo, 'pilar');
  assert.ok(!meio.posicoes.some((q) => q.tipo === 'arranque'));
  assert.ok(perto(meio.posicoes[0].reto, 300 + meio.posicoes[0].l0c, 1));
  const topo = detalhamentoDe(P('P301'), P('P301').resultado, p);
  assert.equal(topo.acima, false);
  assert.ok(perto(topo.posicoes[0].reto, 300 - 3, 1e-6));
});

test('estribos suplementares: barras a mais de 20·øt do canto pedem grampo', () => {
  const pts = [[4, 4], [21, 4], [4, 20], [21, 20], [4, 36], [21, 36]].map(([x, y]) => ({ x, y }));
  const fino = barrasProtegidas(pts, 5);
  assert.equal(fino.grampos.length, 1);
  assert.equal(fino.protegidas.filter(Boolean).length, 4);
  assert.equal(barrasProtegidas(pts, 8).grampos.length, 0);
  // 4 barras: só cantos
  assert.equal(barrasProtegidas([[4, 4], [16, 4], [4, 26], [16, 26]].map(([x, y]) => ({ x, y })), 5).grampos.length, 0);
});

test('lajes: a negativa entre duas lajes é detalhada uma vez só, na de código menor', () => {
  const p = calculado('edificio-exemplo.lebr.json');
  const L1 = p.elementos.find((e) => e.codigo === 'L1'), L2 = p.elementos.find((e) => e.codigo === 'L2');
  assert.equal(vizinhasNaBorda(L1, 'x1', p).length, 1);
  const d1 = detalhamentoDe(L1, L1.resultado, p), d2 = detalhamentoDe(L2, L2.resultado, p);
  const n1 = d1.posicoes.filter((q) => q.tipo === 'negativa'), n2 = d2.posicoes.filter((q) => q.tipo === 'negativa');
  assert.equal(n1.length, 1);
  assert.equal(n2.length, 0);
  assert.ok(d2.avisos.some((a) => a.includes('detalhada em L1')));
  assert.equal(n1[0].outro, 'L2');
  // 0,25 do maior vão perpendicular para cada lado
  assert.ok(perto(n1[0].a1, 0.25 * Math.max(L1.lx, L2.lx) * 100, 1e-6) && perto(n1[0].a2, n1[0].a1, 1e-6));
  // positivas: todas as direções calculadas viram posições
  assert.equal(d1.posicoes.filter((q) => q.tipo === 'positiva').length, 2);
});

test('resumo com perdas e quantitativos pela lista de ferros de vigas, pilares e lajes', () => {
  const r = resumoComPerdas([{ phi: 10, n: 2, comprimento: 600 }, { phi: 5, n: 10, comprimento: 100 }], 10);
  assert.ok(perto(r.totalPerdas, 1.1 * r.total, 1e-9));
  assert.equal(r.linhas.find((l) => l.phi === 5).aco, 'CA-60');
  const p = calculado('edificio-3-pavimentos.lebr.json');
  const q = quantitativosDoProjeto(p, reg);
  for (const c of ['V101', 'P101', 'L101']) assert.ok(q.elementos.find((e) => e.codigo === c).detalhado, c);
  const pl = p.elementos.find((e) => e.codigo === 'P101');
  const kg = posicoesDe(pl, pl.resultado, p).reduce((s, x) => s + x.massa, 0);
  assert.ok(perto(Object.values(q.elementos.find((e) => e.codigo === 'P101').aco).reduce((s, v) => s + v, 0), kg, 1e-6));
  // o resumo do projeto soma tudo e aplica as perdas
  const somaElementos = q.elementos.reduce((s, e) => s + Object.values(e.aco).reduce((a, v) => a + v, 0), 0);
  assert.ok(perto(q.resumoAco.total, somaElementos, 1e-6));
  assert.ok(perto(q.resumoAco.totalPerdas, 1.1 * somaElementos, 1e-6));
  p.parametros.perdasAco = 5;
  assert.ok(perto(quantitativosDoProjeto(p, reg).resumoAco.totalPerdas, 1.05 * somaElementos, 1e-6));
});
