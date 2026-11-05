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
/** Bloco sobre estacas: arranjos, distribuição da carga do pilar, bielas e tirantes, ligação na montagem. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { criarBloco } from '../src/modules/concreto-bloco/calculo.js';
import { criarBlocosNosPilares, criarSapatasNosPilares } from '../src/renderer/core/fundacoes.js';
import { arranjoEstacas, reacoesEstacas, bielasETirantes, intervaloAlturaUtil, dimensoesBloco } from '../src/engine/bloco.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const exemplo = () => lerProjeto(fs.readFileSync(new URL('./fixtures/edificio-3-pavimentos-sem-baldrame.lebr.json', import.meta.url), 'utf8'));
const calc = (p, ajuste = {}) => {
  const el = { id: 'bx', modulo: 'concreto.bloco', codigo: 'BX', nome: 'BX', ...criarBloco(p), local: { x: -1.5, y: -1.5 }, ...ajuste };
  p.elementos.push(el);
  try { return calcularElemento(el, p, reg); } finally { p.elementos.pop(); }
};
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

test('arranjos usuais: centrados no pilar e com espaçamento e entre estacas vizinhas', () => {
  for (let n = 1; n <= 6; n++) {
    const pos = arranjoEstacas(n, 90);
    assert.equal(pos.length, n);
    assert.ok(perto(pos.reduce((s, p) => s + p.x, 0), 0) && perto(pos.reduce((s, p) => s + p.y, 0), 0), `n=${n} centrado`);
    if (n >= 2) {
      const dmin = Math.min(...pos.flatMap((p, i) => pos.slice(i + 1).map((q) => Math.hypot(p.x - q.x, p.y - q.y))));
      assert.ok(dmin >= 90 - 1e-6, `n=${n} espaçamento ${dmin}`);
    }
  }
  assert.throws(() => arranjoEstacas(7, 90));
  assert.deepEqual(dimensoesBloco(arranjoEstacas(2, 90), 30), { A: 150, B: 60 });
});

test('reações: a carga se divide por igual e o momento redistribui sem mudar a soma', () => {
  const pos = arranjoEstacas(4, 90);
  const R0 = reacoesEstacas({ N: 1000, pos });
  assert.ok(R0.every((r) => perto(r, 250)));
  const R = reacoesEstacas({ N: 1000, Mx: 90, pos });
  assert.ok(perto(R.reduce((s, r) => s + r, 0), 1000));
  assert.ok(perto(Math.max(...R), 250 + 90 / (4 * 0.45 ** 2) * 0.45));
});

test('Blévot: 2, 3 e 4 estacas com as fórmulas clássicas', () => {
  const b2 = bielasETirantes({ n: 2, e: 90, ap: 20, bp: 20, d: 35, D: 30, Nd: 700, R: [350, 350], pos: arranjoEstacas(2, 90), fcd: 25 / 1.4 });
  assert.ok(perto(b2.Tx, (700 * (180 - 20)) / (8 * 35)));
  assert.ok(perto(b2.alfa, (Math.atan(35 / 40) * 180) / Math.PI));
  assert.ok(perto(b2.limite, 1.4 * 0.9 * 25 / 1.4));
  const b4 = bielasETirantes({ n: 4, e: 90, ap: 30, bp: 30, d: 60, D: 30, Nd: 1400, R: [350, 350, 350, 350], pos: arranjoEstacas(4, 90), fcd: 25 / 1.4 });
  assert.ok(perto(b4.tirantes.lado, (1400 * (180 - 30)) / (16 * 60)));
  const iv = intervaloAlturaUtil({ n: 3, e: 90, ap: 25, bp: 25 });
  assert.ok(perto(iv.min, 0.58 * 77.5) && perto(iv.max, 0.825 * 77.5));
});

test('um bloco ligado a um pilar distribui a carga entre as estacas', () => {
  const p = exemplo();
  const pl = p.elementos.find((e) => e.codigo === 'P105');
  const r = calc(p, { pilarId: pl.id });
  assert.ok(!r.erro, r.erro);
  assert.equal(r.pilar.codigo, 'P105');
  assert.equal(r.Rk.length, r.n);
  assert.ok(perto(r.Rk.reduce((s, x) => s + x, 0), r.Nk.g + r.Nk.q + r.PP, 0.1 * r.n), 'a soma das reações é a carga do pilar mais o peso do bloco');
  assert.ok(Math.max(...r.Rk) <= r.Padm + 1e-6);
  // a verificação das bielas aparece no resultado
  if (r.n >= 2) {
    assert.ok(r.verificacoes.some((v) => /biela/i.test(v.nome)));
    assert.ok(r.bielas.alfaMin >= 45 - 0.5 && r.bielas.alfaMax <= 55 + 0.5, `bielas ${r.bielas.alfaMin}–${r.bielas.alfaMax}`);
    assert.ok(r.memorial.some((m) => /[Bb]iela/.test(m.titulo + (m.linhas ?? []).join(' '))));
  }
});

test('o número automático de estacas cresce com a carga; todos os arranjos de 1 a 6 calculam', () => {
  const p = exemplo();
  const ns = [200, 600, 1200, 2000].map((g) => calc(p, { cargas: { g, q: 0 } }).n);
  for (let i = 1; i < ns.length; i++) assert.ok(ns[i] >= ns[i - 1], ns.join(','));
  assert.ok(ns[ns.length - 1] > ns[0]);
  for (let n = 1; n <= 6; n++) {
    const r = calc(p, { n, cargas: { g: 150 * n, q: 30 * n } });
    assert.ok(!r.erro, `n=${n}: ${r.erro}`);
    assert.equal(r.n, n);
    assert.ok(r.armadura && (n === 1 ? r.armadura.As > 0 : r.armadura.malha.As > 0));
  }
  const r4 = calc(p, { cargas: { g: 400, q: 100 }, momentos: { x: 0, y: 0 }, n: 4 });
  assert.ok(r4.Rk.every((x) => perto(x, (500 + r4.PP) / 4, 0.06)), 'sem momento, todas iguais');
  const rm = calc(p, { cargas: { g: 400, q: 100 }, momentos: { x: 40, y: 0 }, n: 4 });
  assert.ok(Math.max(...rm.Rk) > Math.max(...r4.Rk) && Math.min(...rm.Rk) < Math.min(...r4.Rk), 'o momento carrega um lado');
});

test('montagem: blocos sob os pilares da fundação, sem duplicar onde já há sapata', () => {
  const p = exemplo();
  p.elementos = p.elementos.filter((e) => e.modulo !== 'concreto.bloco'); // o exemplo já vem com os blocos
  const s = criarSapatasNosPilares(p, reg).slice(0, 2);
  // deixa só duas sapatas
  p.elementos = p.elementos.filter((e) => e.modulo !== 'concreto.sapata' || s.includes(e.id));
  const ids = criarBlocosNosPilares(p, reg);
  assert.ok(ids.length > 0);
  const comSapata = new Set(p.elementos.filter((e) => e.modulo === 'concreto.sapata').map((e) => e.pilarId));
  for (const id of ids) {
    const b = p.elementos.find((e) => e.id === id);
    assert.ok(b.pilarId && !comSapata.has(b.pilarId));
    assert.match(b.codigo, /^B/);
  }
  assert.equal(criarBlocosNosPilares(p, reg).length, 0, 'não cria de novo');
  assert.equal(criarSapatasNosPilares(p, reg).length, 0, 'sapatas não entram onde há bloco');
  const b = p.elementos.find((e) => e.id === ids[0]);
  const r = calcularElemento(b, p, reg);
  assert.ok(!r.erro, r.erro);
});
