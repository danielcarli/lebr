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
/** Vento (NBR 6123): motor de forças, combinações com direções exclusivas e integração no pórtico do edifício. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fatorS2, forcasDeVento, coefArrastoEstimado, classeDaEdificacao, forcaNaDirecao } from '../src/engine/vento.js';
import { gerarCombinacoes, casosGlobais, casosPadrao, coeficientesAcoes, CASOS_VENTO } from '../src/engine/combinacoes.js';
import { contextoConcreto } from '../src/engine/materiais.js';
import { lerProjeto, criarProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { porticoDoEdificio, ventoDoProjeto, parametrosVento } from '../src/modules/comum/portico-edificio.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const exemplo = () => lerProjeto(fs.readFileSync(new URL('./fixtures/edificio-3-pavimentos-sem-baldrame.lebr.json', import.meta.url), 'utf8'));

test('S2 cresce com a altura e cai com a rugosidade; classe pela maior dimensão', () => {
  assert.ok(fatorS2({ z: 20, categoria: 'IV' }) > fatorS2({ z: 5, categoria: 'IV' }));
  assert.ok(fatorS2({ z: 10, categoria: 'II' }) > fatorS2({ z: 10, categoria: 'V' }));
  assert.ok(fatorS2({ z: 1000, categoria: 'I' }) === fatorS2({ z: 250, categoria: 'I' }), 'acima de zg S2 fica constante');
  assert.equal(classeDaEdificacao(20), 'A');
  assert.equal(classeDaEdificacao(35), 'B');
  assert.equal(classeDaEdificacao(51), 'C');
  assert.throws(() => fatorS2({ z: 10, categoria: 'VI' }));
});

test('Ca estimado fica no intervalo dos ábacos e cresce com a esbeltez', () => {
  const baixo = coefArrastoEstimado(10, 10, 5), alto = coefArrastoEstimado(10, 10, 60);
  assert.ok(alto > baixo);
  assert.ok(coefArrastoEstimado(20, 5, 30) > coefArrastoEstimado(5, 20, 30), 'face larga e pouca profundidade: maior Ca');
  for (const [a, b, h] of [[1, 50, 1], [50, 1, 300], [10, 10, 10]]) {
    const c = coefArrastoEstimado(a, b, h);
    assert.ok(c >= 0.7 && c <= 2.2, `${a}, ${b}, ${h}: ${c}`);
  }
});

test('forças por pavimento: Ca informado substitui a estimativa e direções opostas se anulam', () => {
  const niveis = [{ id: 'a', z: 3 }, { id: 'b', z: 6 }];
  const r = forcasDeVento({ V0: 40, categoria: 'III', Lx: 10, Ly: 20, niveis, Ca: { x: 1.3 } });
  assert.equal(r.direcoes.x.Ca, 1.3);
  assert.ok(r.direcoes.x.informado && !r.direcoes.y.informado);
  assert.equal(r.direcoes.y.Ca, r.direcoes.y.CaEstimado);
  assert.equal(r.pavimentos[1].hInf, 1.5);
  const p = r.pavimentos[0];
  assert.deepEqual(forcaNaDirecao(p, 0), [p.Fx, 0]);
  assert.deepEqual(forcaNaDirecao(p, 180).map((x) => x || 0), [-p.Fx, 0]);
  assert.deepEqual(forcaNaDirecao(p, 270).map((x) => x || 0), [0, -p.Fy]);
  assert.throws(() => forcasDeVento({ V0: 0, Lx: 1, Ly: 1, niveis }));
});

test('combinações: sem vento nada muda; com vento as direções são exclusivas', () => {
  const p = criarProjeto({ nome: 't' });
  const k = coeficientesAcoes(p.parametros);
  const sem = gerarCombinacoes(casosPadrao(k), k);
  assert.deepEqual(gerarCombinacoes(casosGlobais(p.parametros), k), sem);
  assert.equal(sem.length, 7);
  assert.deepEqual(contextoConcreto(p.parametros).combinacoesGlobais.map((c) => c.id), sem.map((c) => c.id));
  p.parametros.vento.ativo = true;
  const com = gerarCombinacoes(casosGlobais(p.parametros), k);
  assert.equal(com.length, 43);
  for (const c of com) {
    const ventos = CASOS_VENTO.filter((v) => c.fatores[v.id] > 0);
    assert.ok(ventos.length <= 1, `${c.id}: ${c.expressao}`);
  }
  // as combinações dos elementos continuam só com G e Q
  assert.deepEqual(contextoConcreto(p.parametros).combinacoes.map((c) => c.id), sem.map((c) => c.id));
});

test('exemplo de 3 pavimentos com vento: equilíbrio horizontal e pilares com a combinação de vento', () => {
  const p = exemplo();
  assert.equal(parametrosVento(p).ativo, false);
  const v = ventoDoProjeto(p, reg);
  assert.ok(!v.erro, v.erro);
  assert.equal(v.pavimentos.length, 3);
  p.parametros.vento = { ...p.parametros.vento, ativo: true };
  p.parametros.analiseGlobal = { pilares: 'portico' };
  const g = porticoDoEdificio(p, reg);
  assert.ok(!g.erro, g.erro);
  for (const cv of CASOS_VENTO) {
    const e = g.resultado.porCaso[cv.id].equilibrio;
    assert.ok(e.erro < 1e-4, `${cv.id}: ${e.erro}`);
    const F = cv.angulo % 180 === 0 ? v.totais.Fx : v.totais.Fy;
    assert.ok(Math.abs(Math.hypot(e.reacoes[0], e.reacoes[1]) - F) < 1e-3 * F, `${cv.id}: reação horizontal = soma das forças`);
  }
  // sem carga vertical nos casos de vento
  assert.ok(Math.abs(g.resultado.porCaso.V1.equilibrio.reacoes[2]) < 1e-6);
  const pil = p.elementos.find((e) => e.codigo === 'P101');
  const r = calcularElemento(pil, p, reg);
  assert.ok(!r.erro, r.erro);
  assert.equal(r.portico.usado, true);
  assert.equal(r.combinacoes.length, 43);
  assert.ok(r.portico.vento && Object.keys(r.portico.vento.lance).length === 4);
  assert.ok(Math.abs(r.portico.vento.lance.V1.Vx + r.portico.vento.lance.V3.Vx) < 1e-6, 'V1 e V3 opostos');
});
