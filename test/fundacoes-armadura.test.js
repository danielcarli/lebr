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
/** Ferragem das fundações: estacas (NBR 6122:2019, Tabela 4), sapatas e blocos (NBR 6118, 22.6 e 22.7). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { concreto, aco } from '../src/engine/materiais.js';
import { armaduraEstaca, parametrosTabela4, detalharSapata, detalharBloco } from '../src/engine/fundacoes-armadura.js';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { quantitativosDoElemento } from '../src/modules/comum/quantitativos.js';

const C25 = concreto(25), CA50 = aco(500);
const perto = (a, b, msg, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} ≠ ${b}`);
const base = { tipo: 'helice', D: 40, L: 12, caa: 'II', aco: CA50, fctd: C25.fctd, cob: 3 };
const metro = (R) => Array.from({ length: 12 }, (_, k) => ({ de: k, ate: k + 1, R })); // atrito último de R kN por metro

test('Tabela 4: hélice C30/γc 2,7 (CAA I e II) e C40/γc 3,6 (III e IV); escavada e broca C25/γc 3,1', () => {
  assert.deepEqual(['fck', 'gc', 'rhoMin', 'Lmin', 'sigmaLim'].map((k) => parametrosTabela4('helice', 'II')[k]), [30, 2.7, 0.004, 4, 6]);
  assert.deepEqual(['fck', 'gc'].map((k) => parametrosTabela4('helice', 'IV')[k]), [40, 3.6]);
  assert.deepEqual(['fck', 'gc', 'Lmin', 'sigmaLim'].map((k) => parametrosTabela4('broca', 'I')[k]), [25, 3.1, 2, 5]);
});

test('estaca abaixo da tensão-limite: só a ligação com o bloco, 0,4 % de Ac em 4 m', () => {
  const r = armaduraEstaca({ ...base, Nk: 500, atrito: metro(100) });
  const Ac = Math.PI * 40 * 40 / 4;
  perto(r.sigma, 500 / (Ac / 1e4 * 1000), 'σ');
  assert.equal(r.precisa, false);
  perto(r.As, 0.004 * Ac, 'As');
  assert.equal(r.Larm, 4);
  assert.deepEqual([r.barras.n, r.barras.phi], [7, 10], '7 ø 10 = 5,50 cm² ≥ 5,03');
  assert.equal(r.estribo.phi, 6.3);
  assert.equal(r.estribo.s, 12, '≤ 12·øl = 12 cm');
  assert.equal(r.posicoes.length, 2);
});

test('estaca acima do limite: As = (1,4·Nk − 0,85·fcd·Ac)/σs e armada até a carga cair ao limite pelo atrito', () => {
  const r = armaduraEstaca({ ...base, Nk: 1100, atrito: metro(100) });
  const Ac = Math.PI * 40 * 40 / 4;
  const fcd = 30 / 2.7;
  const AsNec = (1.4 * 1100 - 0.85 * fcd / 10 * Ac) / 42;      // σs = Es·2 ‰ = 420 MPa
  assert.equal(r.precisa, true);
  perto(r.AsNec, AsNec, 'As,nec');
  // atrito mobilizado 100/2 = 50 kN/m: 1100 − 6 MPa·Ac = 346 kN de queda → 6,92 m → 7,0 m
  perto(r.zLim, (1100 - 6 * Ac / 10) / 50, 'z');
  assert.equal(r.Larm, 7);
  assert.ok(r.barras.AsEf >= AsNec);
  // sem o perfil de atrito: a estaca inteira
  const s = armaduraEstaca({ ...base, Nk: 1100 });
  assert.equal(s.Larm, 12);
  assert.ok(s.avisos.some((a) => /todo o comprimento/.test(a)));
});

test('pré-moldada: armadura do fabricante', () => {
  assert.equal(armaduraEstaca({ ...base, tipo: 'premoldada', Nk: 300 }).aplicavel, false);
});

test('sapata: malhas de face a face com gancho nas duas pontas (22.6.4.1.1)', () => {
  const d = detalharSapata({ A: 200, B: 150, cob: 5, malhaX: { phi: 10, n: 12, s: 12 }, malhaY: { phi: 12.5, n: 15, s: 13 } });
  assert.deepEqual(d.posicoes.map((q) => [q.N, q.n, q.phi, q.comprimento]), [['N1', 12, 10, 210], ['N2', 15, 12.5, 165]]);
});

test('bloco: estacas em linha pedem armaduras laterais e superior; quatro estacas não', () => {
  const arm = { tipo: 'x', x: { rotulo: '4 ø 16', faixas: 1 }, y: null, malha: { x: '5 ø 10 c/ 15', y: '10 ø 10 c/ 15' } };
  const dois = detalharBloco({ n: 2, A: 190, B: 70, h: 70, cob: 5, e: 120, D: 40, armadura: arm, emLinha: true });
  const ids = dois.posicoes.map((q) => q.id);
  for (const id of ['tirante-x', 'malha-x', 'malha-y', 'superior', 'pele', 'estribo-vertical']) assert.ok(ids.includes(id), id);
  const sup = dois.posicoes.find((q) => q.id === 'superior');
  assert.ok(sup.n * Math.PI * (sup.phi / 20) ** 2 >= 0.2 * 4 * Math.PI * 0.8 ** 2 - 1e-9, '0,2·As');
  const quatro = detalharBloco({ n: 4, A: 190, B: 190, h: 70, cob: 5, e: 120, D: 40, armadura: { ...arm, y: { rotulo: '4 ø 16', faixas: 2 } }, emLinha: false });
  assert.ok(!quatro.posicoes.some((q) => ['superior', 'pele'].includes(q.id)));
  const susp = detalharBloco({ n: 2, A: 190, B: 70, h: 70, cob: 5, e: 150, D: 40, armadura: arm, emLinha: true, suspensao: 3 });
  assert.ok(susp.posicoes.some((q) => q.id === 'suspensao'));
});

test('exemplo de 3 pavimentos: blocos com a ferragem e a gaiola das estacas, e o aço vem da lista', () => {
  const reg = { obter: (id) => MODULOS_CALCULO[id] };
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-3-pavimentos.lebr.json', import.meta.url), 'utf8'));
  const ordem = { sondagens: -1, lajes: 0, escadas: 0.5, vigas: 1, pilares: 2, fundacoes: 3 };
  for (const e of [...p.elementos].sort((a, b) => (ordem[MODULOS_CALCULO[a.modulo].categoria] ?? 5) - (ordem[MODULOS_CALCULO[b.modulo].categoria] ?? 5))) e.resultado = calcularElemento(e, p, reg);
  const blocos = p.elementos.filter((e) => e.modulo === 'concreto.bloco');
  assert.ok(blocos.length > 0);
  for (const b of blocos) {
    assert.ok(b.resultado.ok, b.codigo);
    assert.ok(b.resultado.armaduraEstaca, `${b.codigo}: armadura da estaca`);
    assert.ok(b.resultado.detalhamento.posicoes.some((q) => q.id === 'estaca-long'), `${b.codigo}: gaiola`);
    const q = quantitativosDoElemento(b, b.resultado, p);
    assert.ok(q.detalhado && Object.values(q.aco).reduce((s, v) => s + v, 0) > 0, `${b.codigo}: aço pela lista`);
  }
});
