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
/** Reservatórios: placas com pressão hidrostática, paredes e fundo, fissuração e reações nos apoios. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto, criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { criarReservatorio } from '../src/modules/concreto-reservatorio/calculo.js';
import { analisarPlaca } from '../src/engine/placa.js';
import { compatibilizar, k0, bracoVigaParede, geometriaReservatorio } from '../src/engine/reservatorio.js';
import { detectarLigacoes, aplicarLigacoes } from '../src/renderer/core/montagem.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const perto = (a, b, tol) => Math.abs(a - b) <= tol;
const calc = (ajuste = {}, projeto = criarProjeto({})) => {
  const el = { id: 'rx', modulo: 'concreto.reservatorio', codigo: 'RX', nome: 'RX', ...criarReservatorio(), ...ajuste };
  projeto.elementos.push(el);
  try { return calcularElemento(el, projeto, reg); } finally { projeto.elementos.pop(); }
};

test('placa com carga triangular: faixa larga em balanço e engastada-apoiada como viga', () => {
  const bal = analisarPlaca({ lx: 12, ly: 3, bordas: { x0: 'livre', x1: 'livre', y0: 'engastada', y1: 'livre' }, carga: { tipo: 'linear-y', base: 1, topo: 0, ate: 3 } });
  assert.ok(perto(-bal.unit.myNeg, 9 / 6, 0.05), `balanço: p·H²/6 = 1,5 (${bal.unit.myNeg})`);
  assert.ok(perto(bal.totalReacoes, 12 * 3 / 2, 0.01));
  const ea = analisarPlaca({ lx: 12, ly: 3, bordas: { x0: 'livre', x1: 'livre', y0: 'engastada', y1: 'apoiada' }, carga: { tipo: 'linear-y', base: 1, topo: 0, ate: 3 } });
  assert.ok(perto(ea.reacoes.y1, 0.3, 0.01), 'reação no apoio = p·L/10');
  // água até a metade: só metade inferior carregada
  const meia = analisarPlaca({ lx: 4, ly: 2, bordas: { x0: 'engastada', x1: 'engastada', y0: 'engastada', y1: 'livre' }, carga: { tipo: 'linear-y', base: 1, topo: 0, ate: 1 } });
  assert.ok(perto(meia.totalReacoes, 4 * 1 / 2, 0.01));
});

test('auxiliares: compatibilização, K0 e braço das vigas-parede', () => {
  assert.equal(compatibilizar(10, 6), 8);
  assert.equal(compatibilizar(10, 2), 8);
  assert.equal(compatibilizar(-4, -4), 4);
  assert.ok(perto(k0(30), 0.5, 1e-12));
  assert.ok(perto(bracoVigaParede(3, 2).z, 0.2 * (3 + 4), 1e-12));
  assert.equal(bracoVigaParede(1.5, 2).regime, 'viga-parede');
  assert.ok(perto(geometriaReservatorio({ a: 2, b: 3, H: 1.5, hAgua: 1.2, e: 15, hf: 15, ht: 10 }).volume, 7.2, 1e-12));
});

test('elevado sobre vigas: momentos das paredes e do fundo, reações por parede', () => {
  const r = calc();
  assert.ok(!r.erro, r.erro);
  assert.ok(r.ok, r.verificacoes.filter((v) => !v.ok).map((v) => v.nome).join(', '));
  const A = r.casos[0].paredes.find((p) => p.id === 'A');
  assert.ok(A.Mh > 0 && A.Mv > 0 && A.compV > 0 && A.compH > 0, 'paredes com momentos nos dois sentidos');
  assert.ok(r.fundo.Mx > 0 && r.fundo.My > 0 && r.fundo.Mxn > 0, 'fundo com momentos');
  assert.ok(A.N > 0, 'tração horizontal pela parede vizinha');
  assert.equal(r.apoios.length, 4);
  // a soma das reações do fundo e da tampa nas linhas é a carga deles
  const somaLinhas = r.apoios.reduce((s, a) => s + a.g * (a.id[0] === 'y' ? r.geometria.Lx : r.geometria.Ly), 0);
  const esperado = r.pesos.paredes + (r.pressoes.fundo) * r.geometria.Lx * r.geometria.Ly + (r.pressoes.tampa - 1) * r.geometria.Lx * r.geometria.Ly;
  assert.ok(Math.abs(somaLinhas - esperado) < 0.02 * esperado, `${somaLinhas} × ${esperado}`);
  assert.ok(r.armaduras.some((a) => a.placa === 'F') && r.armaduras.some((a) => a.placa === 'A' && a.face === 'interna'));
});

test('limite de fissura mais rígido aumenta a armadura', () => {
  const folgado = calc({ a: 3, b: 4, H: 2.5, hAgua: 2.3, e: 18, hf: 18, wkLim: 0.3 });
  const rigido = calc({ a: 3, b: 4, H: 2.5, hAgua: 2.3, e: 18, hf: 18, wkLim: 0.05 });
  const soma = (r) => r.armaduras.reduce((s, a) => s + (a.barras?.AsEf ?? 0), 0);
  assert.ok(soma(rigido) > soma(folgado));
  assert.ok(rigido.armaduras.some((a) => a.porFissura));
  assert.ok(rigido.armaduras.every((a) => a.wk <= 0.05 + 1e-9));
});

test('pilares nos cantos: carga total dividida e paredes como vigas-parede; enterrado: empuxo e solo', () => {
  const r = calc({ apoio: 'pilares' });
  assert.equal(r.apoios.length, 4);
  assert.ok(perto(r.apoios.reduce((s, a) => s + a.g, 0), r.pesos.G, 0.05));
  assert.ok(r.tirantes.length === 2 && r.tirantes.every((t) => t.As > 0) && r.suspensao.every((x) => x.As > 0));
  const ent = calc({ tipo: 'enterrado' });
  assert.equal(ent.casos.length, 2);
  assert.ok(ent.pressoes.terra > 0 && ent.sigmaSolo > 0 && ent.apoios.length === 0);
  assert.ok(ent.armaduras.some((a) => a.placa === 'A' && a.face === 'externa' && a.pos === 'aresta'), 'empuxo traciona a face externa nas arestas');
});

test('no exemplo, as vigas da cobertura recebem as paredes do reservatório', () => {
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-3-pavimentos.lebr.json', import.meta.url), 'utf8'));
  const rs = p.elementos.find((e) => e.codigo === 'RS1');
  const r = calcularElemento(rs, p, reg);
  assert.ok(r.ok);
  assert.deepEqual(r.apoios.map((a) => a.recebe.map((x) => x.codigo)).flat().sort(), ['V302', 'V303', 'V304', 'V307']);
  const v302 = p.elementos.find((e) => e.codigo === 'V302');
  const c = v302.cargas.find((x) => x.elementoId === rs.id);
  assert.deepEqual(c.trecho, [0, 2], 'parede sobre metade do vão: carga só no trecho');
  const comRes = calcularElemento(v302, p, reg);
  v302.cargas = v302.cargas.filter((x) => x.elementoId !== rs.id);
  const sem = calcularElemento(v302, p, reg);
  assert.ok(comRes.apoios[0].Rg > sem.apoios[0].Rg + 10);
});

test('montagem: reservatório sobre pilares liga os cantos aos pilares', () => {
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-3-pavimentos.lebr.json', import.meta.url), 'utf8'));
  const rs = p.elementos.find((e) => e.codigo === 'RS1');
  for (const e of p.elementos) if (Array.isArray(e.cargas)) e.cargas = e.cargas.filter((x) => x.elementoId !== rs.id);
  Object.assign(rs, { apoio: 'pilares', a: 3.85, b: 4.85, posicao: { pavimento: 'pav3', x: 0, y: 0, angulo: 0 } });
  const lig = detectarLigacoes(p, reg).filter((l) => l.fonte.id === rs.id);
  assert.deepEqual(lig.map((l) => `${l.ligacao}→${l.receptor.codigo}`).sort(), ['canto-1→P301', 'canto-2→P302', 'canto-3→P305', 'canto-4→P304']);
  const pilar = p.elementos.find((e) => e.codigo === 'P305');
  const antes = calcularElemento(pilar, p, reg).Nd;
  aplicarLigacoes(p, lig);
  const depois = calcularElemento(pilar, p, reg).Nd;
  const canto = calcularElemento(rs, p, reg).apoios.find((a) => a.id === 'canto-3');
  assert.ok(perto(depois - antes, 1.4 * (canto.g + canto.q), 1), `${antes} → ${depois}`);
});
