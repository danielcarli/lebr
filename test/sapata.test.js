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
/** Sapata isolada, ligação pilar → sapata, criação automática e nível de baldrame. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento, contextoCalculo } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { criarSapata, pilaresDeFundacao } from '../src/modules/concreto-sapata/calculo.js';
import { criarSapatasNosPilares, criarNivelBaldrame } from '../src/renderer/core/fundacoes.js';
import { porticoDoEdificio } from '../src/modules/comum/portico-edificio.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const exemplo = () => lerProjeto(fs.readFileSync(new URL('./fixtures/edificio-3-pavimentos-sem-baldrame.lebr.json', import.meta.url), 'utf8'));
const ordem = { sondagens: -1, lajes: 0, vigas: 1, pilares: 2, fundacoes: 3 };
const calcularTudo = (p) => {
  for (const e of [...p.elementos].sort((a, b) => (ordem[reg.obter(a.modulo).categoria] ?? 9) - (ordem[reg.obter(b.modulo).categoria] ?? 9))) e.resultado = calcularElemento(e, p, reg);
};
const sapataEm = (p, pilar, ajuste = () => {}) => {
  const s = { id: 'sx', modulo: 'concreto.sapata', codigo: 'SX', nome: 'SX', ...criarSapata(p), pilarId: pilar.id };
  ajuste(s);
  p.elementos.push(s);
  const r = calcularElemento(s, p, reg);
  p.elementos.pop();
  return r;
};

test('pilares da fundação: só os do pavimento mais baixo do exemplo', () => {
  const p = exemplo();
  const f = pilaresDeFundacao(p, reg);
  assert.equal(f.length, 9);
  assert.ok(f.every(({ pilar }) => pilar.codigo.startsWith('P1')));
});

test('a sapata ligada recebe a carga do pilar; tensão menor dá sapata maior', () => {
  const p = exemplo();
  calcularTudo(p);
  const pl = p.elementos.find((e) => e.codigo === 'P105');
  const base = contextoCalculo(p, reg).cargasDe(pl.id, 'base');
  const r200 = sapataEm(p, pl);
  assert.ok(!r200.erro, r200.erro);
  assert.ok(Math.abs(r200.Nk.g + r200.Nk.q - (base.g + base.q)) < 0.01, 'mesma carga do pilar');
  const r100 = sapataEm(p, pl, (s) => { s.solo.tensao = 100; });
  assert.ok(r100.A > r200.A && r100.B > r200.B);
  assert.ok(r200.tensoes.med <= r200.sigmaAdm && r100.tensoes.med <= 100);
  assert.ok(r200.verificacoes.some((v) => /Punção/.test(v.nome)), 'a punção aparece nas verificações');
  // flexível: punção em C' verificada de fato
  const rf = sapataEm(p, pl, (s) => { s.geometria = { modo: 'manual', A: 260, B: 260, h: 40, h0: 20 }; });
  assert.equal(rf.rigida, false);
  assert.ok(rf.puncao && rf.puncao.tauSd > 0);
  assert.ok(rf.verificacoes.some((v) => /C′ \(2d\)/.test(v.nome)));
  // SPT do furo mais próximo
  const rs = sapataEm(p, pl, (s) => { s.solo.modo = 'spt'; });
  assert.ok(!rs.erro && rs.tensao.furo && rs.sigmaAdm > 0);
});

test('momentos excêntricos aumentam a sapata; fora do núcleo central não atende', () => {
  const p = exemplo();
  calcularTudo(p);
  const pl = p.elementos.find((e) => e.codigo === 'P101');
  const r0 = sapataEm(p, pl);
  const rm = sapataEm(p, pl, (s) => { s.momentos = { x: 80, y: 0 }; });
  assert.ok(rm.A * rm.B > r0.A * r0.B);
  assert.ok(rm.tensoes.nucleo);
  const rx = sapataEm(p, pl, (s) => { s.momentos = { x: 400, y: 0 }; s.geometria = { modo: 'manual', A: 150, B: 150, h: 50, h0: 20 }; });
  assert.equal(rx.ok, false);
});

test('criar sapatas nos pilares e o nível de baldrame com arranques e vigas baldrame', () => {
  const p = exemplo();
  p.elementos = p.elementos.filter((e) => e.modulo !== 'concreto.bloco'); // o exemplo vem com blocos sobre estacas
  const ids = criarSapatasNosPilares(p, reg);
  assert.equal(ids.length, 9);
  assert.equal(criarSapatasNosPilares(p, reg).length, 0, 'não duplica');
  const r = criarNivelBaldrame(p, reg, { arranque: 1.0, secao: { b: 15, h: 40 } });
  assert.equal(r.pavimento.cota, 0);
  assert.equal(r.arranques.length, 9);
  assert.equal(r.vigas.length, 7);
  assert.equal(r.sapatas, 9, 'as sapatas passam para os arranques');
  assert.throws(() => criarNivelBaldrame(p, reg));
  calcularTudo(p);
  const vb = p.elementos.filter((e) => e.baldrame);
  assert.equal(vb.length, 7);
  assert.ok(vb.every((v) => v.resultado.ok), vb.map((v) => `${v.codigo}: ${v.resultado.erro ?? v.resultado.avisos}`).join('; '));
  assert.ok(vb[0].resultado.memorial.some((m) => m.linhas.some((l) => /baldrame/.test(l))));
  // o arranque recebe o pilar de cima e as vigas baldrame; a sapata recebe o arranque
  const pb = p.elementos.find((e) => e.codigo === 'PB105'), p105 = p.elementos.find((e) => e.codigo === 'P105');
  assert.ok(pb.resultado.Nd > p105.resultado.Nd);
  const s = p.elementos.find((e) => e.modulo === 'concreto.sapata' && e.pilarId === pb.id);
  assert.ok(s.resultado.ok && s.resultado.Nk.g > p105.resultado.Nk.g);
  const g = porticoDoEdificio(p, reg);
  assert.ok(!g.erro, g.erro);
  assert.ok(Math.abs(g.totais.somaPavG - g.totais.reacoesG) < 0.01);
});
