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
/** 0.32: sugestões quando o elemento não atende, armadura em 3D por elemento e cargas na fundação. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { sugerirCorrecao, gravar } from '../src/modules/comum/sugestoes.js';
import { modeloViga, modeloPilar, modeloLaje, limitesDoModelo } from '../src/modules/comum/armadura3d.js';
import { detalhamentoPilar, detalhamentoLaje } from '../src/modules/comum/detalhamento.js';
import { aplicarEdicoes } from '../src/engine/detalhamento.js';
import { cargasNaFundacao } from '../src/modules/comum/relatorios.js';
import { pilaresNaFundacao } from '../src/modules/comum/pranchas.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const ordem = { sondagens: -1, lajes: 0, escadas: 0.5, reservatorios: 0.6, vigas: 1, pilares: 2, fundacoes: 3 };
const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-3-pavimentos.lebr.json', import.meta.url), 'utf8'));
for (const e of [...p.elementos].sort((a, b) => (ordem[MODULOS_CALCULO[a.modulo].categoria] ?? 5) - (ordem[MODULOS_CALCULO[b.modulo].categoria] ?? 5))) e.resultado = calcularElemento(e, p, reg);
const el = (cod) => p.elementos.find((e) => e.codigo === cod);
const calc = (e) => calcularElemento(e, p, reg);
const copia = (o) => JSON.parse(JSON.stringify(o));

test('sugestão: a menor altura que faz a viga atender, e aplicar a sugestão faz atender', () => {
  const v = copia(el('V104')); v.secao.h = 20;
  assert.equal(calc(v).ok, false);
  const s = sugerirCorrecao(v, p, calc);
  assert.ok(s.opcoes.length >= 1);
  const o = s.opcoes[0];
  assert.ok(o.alteracoes.some((a) => a.caminho === 'secao.h'));
  for (const a of o.alteracoes) gravar(v, a.caminho, a.valor);
  assert.equal(calc(v).ok, true);
  // 5 cm a menos já não atende: é a menor da busca
  const menor = copia(v); menor.secao.h -= 5;
  if (menor.secao.h > 20) assert.equal(calc(menor).ok, false);
});

test('sugestão: bitola escolhida que não serve volta para Automática; laje fina ganha espessura', () => {
  const v = copia(el('V104')); v.armadura = { ...v.armadura, superior: 25 }; v.secao.b = 12;
  const s = sugerirCorrecao(v, p, calc);
  if (!calc(v).ok) assert.ok(s.opcoes.length > 0);
  const l = copia(el('L101')); l.h = 6;
  const sl = sugerirCorrecao(l, p, calc);
  assert.equal(sl.opcoes[0].alteracoes[0].caminho, 'h');
  assert.ok(sl.opcoes[0].alteracoes[0].valor > 6);
});

test('armadura 3D da viga: uma barra por unidade da lista de ferros, dentro do concreto', () => {
  const v = el('V201');
  const det = v.resultado.detalhamento;
  const pos = aplicarEdicoes(det.posicoes, {});
  const m = modeloViga(v, det, pos, { cob: 3 });
  const longitudinais = pos.filter((q) => q.tipo !== 'estribo').reduce((t, q) => t + (q.face === 'lateral' ? 2 * Math.max(1, Math.round(q.n / 2)) : q.n), 0);
  assert.equal(m.barras.filter((b) => b.tipo !== 'estribo').length, longitudinais);
  const nEstribos = pos.filter((q) => q.tipo === 'estribo').reduce((t, q) => t + q.trechos.reduce((u, tr) => u + tr.qtd, 0), 0);
  assert.equal(m.barras.filter((b) => b.tipo === 'estribo').length, nEstribos);
  const c = m.caixas[0];
  for (const b of m.barras) for (const [, y, z] of b.pts) { assert.ok(y > 0 && y < c.max[1], `${b.N} y`); assert.ok(z > 0 && z < c.max[2], `${b.N} z`); }
  const lim = limitesDoModelo(m);
  assert.ok(lim.max[0] > lim.min[0]);
});

test('armadura 3D do pilar e da laje', () => {
  const pl = el('P205');
  const dp = detalhamentoPilar(pl, pl.resultado, p);
  const mp = modeloPilar(pl, dp, dp.posicoes, { pontos: pl.resultado.armadura.pontos, cob: 3 });
  assert.equal(mp.barras.filter((b) => b.tipo === 'longitudinal').length, pl.resultado.armadura.pontos.length);
  assert.ok(mp.barras.some((b) => b.tipo === 'estribo'));
  const lj = el('L102');
  const dl = detalhamentoLaje(lj, lj.resultado, p);
  const ml = modeloLaje(lj, dl, dl.posicoes, { cob: 2.5 });
  const nPos = dl.posicoes.filter((q) => q.tipo === 'positiva').reduce((t, q) => t + q.n, 0);
  assert.equal(ml.barras.filter((b) => b.tipo === 'positiva').length, nPos);
  // positivas por baixo, negativas por cima
  assert.ok(ml.barras.filter((b) => b.tipo === 'positiva').every((b) => b.pts.every((q) => q[2] < lj.h / 2)));
  assert.ok(ml.barras.filter((b) => b.tipo === 'negativa').every((b) => b.pts.some((q) => q[2] > lj.h / 2)));
});

test('cargas na fundação: um por pilar que chega à fundação, Nk = Ng + Nq e os totais somam', () => {
  const c = cargasNaFundacao(p);
  assert.equal(c.linhas.length, pilaresNaFundacao(p).length);
  for (const l of c.linhas) {
    const pil = el(l.codigo);
    assert.ok(Math.abs(l.Nk - (pil.resultado.Nk.g + pil.resultado.Nk.q)) < 1e-9);
    assert.equal(l.Nd, pil.resultado.Nd);
  }
  assert.ok(Math.abs(c.total.Nk - c.linhas.reduce((t, l) => t + l.Nk, 0)) < 1e-6);
  assert.equal(c.pendentes, 0);
  assert.ok(c.linhas.every((l) => l.fundacao));
});
