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
/** Sapata corrida, radier e a armadura em 3D das fundações (sapata, bloco, estaca, sapata corrida e radier). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto, criarProjeto } from '../src/renderer/core/projeto.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { momentoS1 } from '../src/engine/sapata.js';
import { concreto } from '../src/engine/materiais.js';
import { criarRadierNosPilares, criarSapatasNosPilares, criarSapatasCorridasNasVigas } from '../src/renderer/core/fundacoes.js';
import { verificarConsistencia } from '../src/renderer/core/consistencia.js';
import { radierDoPilar } from '../src/renderer/core/montagem.js';
import { posicoesDe } from '../src/modules/comum/detalhamento.js';
import { quantitativosDoElemento } from '../src/modules/comum/quantitativos.js';
import { modeloSapata, modeloBloco, modeloEstaca, modeloSapataCorrida, modeloRadier } from '../src/modules/comum/armadura3d-fundacoes.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const perto = (a, b, msg, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} ≠ ${b}`);
const ORDEM = { sondagens: -1, lajes: 0, escadas: 0.5, vigas: 1, pilares: 2, fundacoes: 3 };
const calcularTudo = (p) => { for (const e of [...p.elementos].sort((a, b) => (ORDEM[MODULOS_CALCULO[a.modulo]?.categoria] ?? 5) - (ORDEM[MODULOS_CALCULO[b.modulo]?.categoria] ?? 5))) e.resultado = calcularElemento(e, p, reg); return p; };
const exemplo = (arq) => lerProjeto(fs.readFileSync(new URL(`../exemplos/${arq}`, import.meta.url), 'utf8'));
const somaN = (posicoes, ids) => posicoes.filter((q) => ids.includes(q.id)).reduce((s, q) => s + q.n, 0);

test('sapata corrida (carga informada): B pela tensão, rígida, M1 do CEB-70 e as duas posições', () => {
  const p = criarProjeto();
  const el = { id: 'sc', modulo: 'concreto.sapataCorrida', codigo: 'SC1', nome: 'SC1', ...MODULOS_CALCULO['concreto.sapataCorrida'].criar(p), cargas: { g: 80, q: 20 }, bw: 19, comprimento: 6, solo: { tensao: 150, gama: 18 } };
  p.elementos.push(el);
  const r = calcularElemento(el, p, reg);
  assert.ok(r.ok, r.erro ?? r.verificacoes.filter((v) => !v.ok).map((v) => v.nome).join());
  assert.equal(r.B % 5, 0);
  assert.ok(r.sigma <= 150);
  assert.ok((100 + r.pp + r.terra) / ((r.B - 5) / 100) > 150, 'a largura é a menor múltipla de 5 que atende');
  assert.ok(r.h >= (r.B - 19) / 3 && r.rigida);
  const sigD = (1.4 * 80 + 1.4 * 20) / (r.B / 100);
  perto(r.flexao.Md, momentoS1({ sigma: sigD, largura: 100, balanco: (r.B - 19) / 2, ap: 19 }), 'M1');
  const det = r.detalhamento.posicoes;
  assert.deepEqual(det.map((q) => q.id), ['transversal', 'longitudinal']);
  assert.equal(det[0].n, Math.floor((600 - 2 * r.cobrimento) / r.flexao.barras.s) + 1);
  assert.ok(r.distribuicao.AsEf >= Math.max(0.2 * r.flexao.barras.AsEf, 0.9) * r.B / 100 - 1e-9);
});

test('sapata corrida sob viga: carga por metro = soma das reações ÷ comprimento; comando cria uma por viga do nível mais baixo', () => {
  const p = exemplo('residencia-terrea-baldrame.lebr.json');
  p.elementos = p.elementos.filter((e) => e.modulo !== 'concreto.sapata');
  const ids = criarSapatasCorridasNasVigas(p);
  assert.ok(ids.length > 0);
  assert.equal(criarSapatasCorridasNasVigas(p).length, 0, 'não duplica');
  calcularTudo(p);
  for (const id of ids) {
    const sc = p.elementos.find((e) => e.id === id), v = p.elementos.find((e) => e.id === sc.vigaId);
    const L = v.vaos.reduce((s, x) => s + x.L, 0);
    assert.ok(!sc.resultado.erro, sc.resultado.erro);
    perto(sc.resultado.nk.g, v.resultado.apoios.reduce((s, a) => s + a.Rg, 0) / L, `${sc.codigo} g`);
    assert.equal(sc.resultado.bw, v.secao.b);
  }
});

test('radier: cria sob os pilares livres, pressão N/A, punção e malhas; os pilares deixam de ficar sem fundação', () => {
  const p = exemplo('residencia-terrea-baldrame.lebr.json');
  p.elementos = p.elementos.filter((e) => e.modulo !== 'concreto.sapata');
  const id = criarRadierNosPilares(p, reg);
  assert.ok(id);
  assert.equal(criarSapatasNosPilares(p, reg).length, 0, 'os pilares do radier já têm fundação');
  calcularTudo(p);
  const ra = p.elementos.find((e) => e.id === id), r = ra.resultado;
  assert.ok(!r.erro, r.erro);
  assert.ok(r.pilares.length >= 4);
  perto(r.tensoes.med, r.N / (r.lx * r.ly), 'σméd = N/A', 0.005);
  perto(r.sigD, r.Nd / (r.lx * r.ly), 'σd líquida', 0.005);
  assert.ok(r.puncao.length === r.pilares.length);
  assert.ok(['inferior-x', 'inferior-y', 'superior-x', 'superior-y', 'grampo'].every((k) => r.detalhamento.posicoes.some((q) => q.id === k)));
  // o contorno automático envolve os pilares com o balanço
  for (const pl of r.pilares) assert.ok(pl.u > 0 && pl.u < r.lx && pl.v > 0 && pl.v < r.ly, pl.codigo);
  const pilar = p.elementos.find((e) => e.id === r.pilares[0].id);
  assert.equal(radierDoPilar(p, pilar)?.id, id);
  const sem = verificarConsistencia(p, reg).filter((x) => /sem fundação|sem pilar, viga ou fundação/.test(x.texto ?? x.mensagem ?? ''));
  assert.equal(sem.length, 0, sem.map((x) => x.texto ?? x.mensagem).join(' | '));
  const q = quantitativosDoElemento(ra, r, p);
  assert.ok(q.detalhado && q.concreto > 0);
});

test('armadura em 3D: sapata (tronco), bloco, estaca, sapata corrida e radier com as barras da lista', () => {
  const p = calcularTudo(exemplo('residencia-terrea-baldrame.lebr.json'));
  const s = p.elementos.find((e) => e.modulo === 'concreto.sapata');
  const ms = modeloSapata(s.resultado, posicoesDe(s, s.resultado, p));
  assert.ok(ms.caixas.some((c) => c.forma === 'tronco') || s.resultado.h === s.resultado.h0);
  assert.equal(ms.barras.length, somaN(posicoesDe(s, s.resultado, p), ['malha-a', 'malha-b']));
  const p3 = calcularTudo(exemplo('edificio-3-pavimentos.lebr.json'));
  for (const b of p3.elementos.filter((e) => e.modulo === 'concreto.bloco')) {
    const mb = modeloBloco(b.resultado, posicoesDe(b, b.resultado, p3));
    assert.equal(mb.caixas.filter((c) => c.forma === 'cilindro').length, b.resultado.n, `${b.codigo}: estacas`);
    assert.ok(mb.barras.some((x) => x.id === 'estaca-long'), `${b.codigo}: gaiola`);
  }
  const est = { id: 'e', modulo: 'geotecnia.estaca', codigo: 'E1', nome: 'E1', ...MODULOS_CALCULO['geotecnia.estaca'].criar(p3), cargaTrabalho: 900 };
  p3.elementos.push(est);
  est.resultado = calcularElemento(est, p3, reg);
  const me = modeloEstaca(est, est.resultado, posicoesDe(est, est.resultado, p3));
  assert.equal(me.barras.filter((x) => x.tipo === 'longitudinal').length, est.resultado.armadura.barras.n);
  assert.ok(me.barras.filter((x) => x.tipo === 'estribo').every((x) => x.pts.every((q) => q[2] <= 0.01)), 'estribos só abaixo do arrasamento');
  const pc = criarProjeto();
  const sc = { id: 'sc', modulo: 'concreto.sapataCorrida', codigo: 'SC1', nome: 'SC1', ...MODULOS_CALCULO['concreto.sapataCorrida'].criar(pc) };
  pc.elementos.push(sc);
  sc.resultado = calcularElemento(sc, pc, reg);
  const msc = modeloSapataCorrida(sc.resultado, sc.resultado.detalhamento.posicoes);
  assert.ok(msc.barras.filter((x) => x.id === 'longitudinal').length === sc.resultado.distribuicao.n);
  const pr = exemplo('residencia-terrea-baldrame.lebr.json');
  pr.elementos = pr.elementos.filter((e) => e.modulo !== 'concreto.sapata');
  criarRadierNosPilares(pr, reg);
  calcularTudo(pr);
  const ra = pr.elementos.find((e) => e.modulo === 'concreto.radier');
  const mr = modeloRadier(ra.resultado, ra.resultado.detalhamento.posicoes);
  assert.equal(mr.caixas.filter((c) => c.tipo === 'apoio').length, ra.resultado.pilares.length);
  assert.ok(mr.barras.some((x) => x.tipo === 'positiva') && mr.barras.some((x) => x.tipo === 'negativa'));
});

test('C25: τRd2 do contorno C usado no radier', () => {
  const c = concreto(25);
  perto(0.27 * (1 - 25 / 250) * c.fcd, 4.34, 'τRd2', 0.01);
});
