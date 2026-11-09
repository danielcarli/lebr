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
/** Projetos de exemplo: abrem, calculam sem erro e atendem a todas as verificações. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };

for (const arq of ['edificio-exemplo.lebr.json', 'edificio-3-pavimentos.lebr.json', 'residencia-terrea-baldrame.lebr.json', 'sobrado-garagem.lebr.json', 'edificio-18-pavimentos.lebr.json', 'residencia-fundacoes.lebr.json']) {
  test(`exemplo ${arq}`, () => {
    const p = lerProjeto(fs.readFileSync(new URL(`../exemplos/${arq}`, import.meta.url), 'utf8'));
    for (const el of p.elementos) {
      const r = calcularElemento(el, p, reg);
      assert.ok(!r.erro, `${el.codigo}: ${r.erro}`);
      if (!arq.startsWith('edificio-exemplo')) assert.ok(r.ok, `${el.codigo}: ${(r.verificacoes ?? []).filter((v) => !v.ok).map((v) => v.nome).join(', ')}`);
    }
  });
}

test('exemplo de 3 pavimentos: três níveis em grelha e cargas descendo pelos pilares', () => {
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-3-pavimentos.lebr.json', import.meta.url), 'utf8'));
  const tipo = p.pavimentos.filter((pv) => pv.tipo !== 'baldrame');
  assert.equal(tipo.length, 3);
  assert.ok(tipo.every((pv) => pv.analise === 'grelha'));
  const Nd = (cod) => calcularElemento(p.elementos.find((e) => e.codigo === cod), p, reg).Nd;
  assert.ok(Nd('P105') > Nd('P205') && Nd('P205') > Nd('P305'));
});

test('exemplo de 3 pavimentos: fundação em blocos sobre estacas sob os arranques do baldrame', () => {
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-3-pavimentos.lebr.json', import.meta.url), 'utf8'));
  const blocos = p.elementos.filter((e) => e.modulo === 'concreto.bloco');
  const pilares = p.elementos.filter((e) => e.modulo === 'concreto.pilar' && /^PB1/.test(e.codigo));
  assert.equal(blocos.length, pilares.length);
  assert.deepEqual(new Set(blocos.map((b) => b.pilarId)), new Set(pilares.map((x) => x.id)));
  for (const b of blocos) {
    const r = calcularElemento(b, p, reg);
    assert.ok(r.ok && r.n >= 1, `${b.codigo}`);
    assert.ok(Math.abs(r.Rk.reduce((s, x) => s + x, 0) - (r.Nk.g + r.Nk.q + r.PP)) < 0.1 * r.n, `${b.codigo}: a carga do pilar vai para as estacas`);
  }
});

test('exemplo térreo: um pavimento, nível de baldrame com arranques e vigas baldrame, sapatas pelo SPT', () => {
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/residencia-terrea-baldrame.lebr.json', import.meta.url), 'utf8'));
  const normais = p.pavimentos.filter((pv) => pv.tipo !== 'baldrame');
  assert.equal(normais.length, 1);
  const bal = p.pavimentos.find((pv) => pv.tipo === 'baldrame');
  assert.ok(bal);
  const pilares = p.elementos.filter((e) => e.modulo === 'concreto.pilar' && e.posicao?.pavimento === normais[0].id);
  const arranques = p.elementos.filter((e) => e.modulo === 'concreto.pilar' && e.posicao?.pavimento === bal.id);
  const vb = p.elementos.filter((e) => e.modulo === 'concreto.viga' && e.baldrame);
  const sap = p.elementos.filter((e) => e.modulo === 'concreto.sapata');
  assert.equal(arranques.length, pilares.length);
  assert.ok(vb.length >= 4);
  assert.equal(sap.length, arranques.length);
  assert.deepEqual(new Set(sap.map((s) => s.pilarId)), new Set(arranques.map((a) => a.id)), 'as sapatas ficam sob os arranques');
  for (const s of sap) {
    assert.equal(s.solo.modo, 'spt');
    const r = calcularElemento(s, p, reg);
    assert.ok(r.ok, s.codigo);
  }
});

test('exemplo de 3 pavimentos: nível de baldrame com vigas baldrame, lajes do térreo e a escada apoiada', () => {
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-3-pavimentos.lebr.json', import.meta.url), 'utf8'));
  const bal = p.pavimentos.find((pv) => pv.tipo === 'baldrame');
  assert.ok(bal && bal.cota === 0);
  const no = (f) => p.elementos.filter((e) => e.posicao?.pavimento === bal.id && f(e));
  const vb = no((e) => e.modulo === 'concreto.viga');
  const lajes = no((e) => e.modulo === 'concreto.laje.macica');
  assert.ok(vb.length >= 7 && vb.every((v) => v.baldrame));
  assert.equal(lajes.length, 4);
  // as lajes do térreo descarregam nas vigas baldrame
  for (const l of lajes) assert.ok(vb.some((v) => v.cargas.some((c) => c.elementoId === l.id)), l.codigo);
  // a escada do térreo começa na viga baldrame sob a V102
  const es1 = p.elementos.find((e) => e.codigo === 'ES1');
  assert.ok(vb.some((v) => v.cargas.some((c) => c.elementoId === es1.id && c.ligacao === 't1-ini')));
  for (const v of vb) assert.ok(calcularElemento(v, p, reg).ok, v.codigo);
});

test('exemplo de 18 pavimentos: pórtico espacial com vento, γz abaixo de 1,1 e vigas invertidas na cobertura', async () => {
  const { porticoDoEdificio } = await import('../src/modules/comum/portico-edificio.js');
  const p = lerProjeto(fs.readFileSync(new URL('../exemplos/edificio-18-pavimentos.lebr.json', import.meta.url), 'utf8'));
  assert.equal(p.pavimentos.length, 18);
  assert.equal(p.parametros.analiseGlobal.pilares, 'portico');
  assert.ok(p.parametros.vento.ativo);
  const g = porticoDoEdificio(p, reg);
  assert.ok(!g.erro, g.erro);
  assert.ok(Math.abs(g.totais.cargasG - g.totais.reacoesG) < 1e-3 * g.totais.cargasG, 'equilíbrio vertical');
  for (const d of ['x', 'y']) assert.ok(g.estabilidade[d].gz > 1 && g.estabilidade[d].gz < 1.1, `γz ${d} = ${g.estabilidade[d].gz}`);
  const cob = p.pavimentos.find((pv) => pv.nome === 'Cobertura');
  const inv = p.elementos.filter((e) => e.modulo === 'concreto.viga' && e.posicao.pavimento === cob.id && e.invertida);
  assert.equal(inv.length, 4);
  const r = calcularElemento(inv[0], p, reg);
  assert.ok(r.invertida && r.vaos.some((v) => v.suspensao?.asw > 0), 'estribos de suspensão');
});
