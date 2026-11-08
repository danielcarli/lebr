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
/** Segunda bolinha do explorador: situação de cada elemento na montagem (posicionado e ligado). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { estadoMontagem } from '../src/renderer/core/montagem.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const abrir = (arq) => lerProjeto(fs.readFileSync(new URL(`../exemplos/${arq}`, import.meta.url), 'utf8'));
const de = (p, m, c) => m.get(p.elementos.find((e) => e.codigo === c).id);

test('exemplos montados: todos os elementos posicionados ficam verdes', () => {
  for (const arq of ['edificio-exemplo.lebr.json', 'residencia-terrea-baldrame.lebr.json', 'edificio-3-pavimentos.lebr.json', 'terminal-aeroporto.lebr.json', 'aeroporto-terminal-satelite.lebr.json']) {
    const p = abrir(arq);
    const m = estadoMontagem(p, reg);
    const erros = [...m].filter(([, v]) => v.estado === 'erro');
    assert.equal(erros.length, 0, `${arq}: ${erros.map(([id, v]) => `${p.elementos.find((e) => e.id === id).codigo} ${v.problemas.join('; ')}`).join(' | ')}`);
    assert.ok([...m.values()].some((v) => v.estado === 'ok'));
  }
});

test('elemento sem posição: círculo vazio; fora de lugar ou sem apoio: vermelho', () => {
  const p = abrir('edificio-3-pavimentos.lebr.json');
  // sem posição
  const novo = { id: 'vx', modulo: 'concreto.viga', codigo: 'V999', nome: 'nova', ...MODULOS_CALCULO['concreto.viga'].criar(p) };
  p.elementos.push(novo);
  // pilar deslocado: as vigas e lajes ligadas a ele deixam de conferir
  const P = p.elementos.find((e) => e.codigo === 'P205');
  P.posicao = { ...P.posicao, x: P.posicao.x + 0.8 };
  // laje com uma borda que perdeu a viga de apoio (a carga foi removida da viga)
  const L = p.elementos.find((e) => e.codigo === 'L101');
  for (const v of p.elementos.filter((e) => e.modulo === 'concreto.viga')) v.cargas = v.cargas.filter((c) => !(c.tipo === 'elemento' && c.elementoId === L.id && c.ligacao === 'y0'));
  const m = estadoMontagem(p, reg);
  assert.equal(m.get('vx').estado, 'sem-posicao');
  assert.equal(de(p, m, 'P205').estado, 'erro');
  assert.ok(de(p, m, 'P205').problemas.some((t) => t.includes('não confere')));
  assert.equal(de(p, m, 'L101').estado, 'erro');
  assert.ok(de(p, m, 'L101').problemas.some((t) => /sem elemento de apoio|indicada pela planta/.test(t)));
  // o que não foi mexido continua verde
  assert.equal(de(p, m, 'P101').estado, 'ok');
});

test('pilar: comprimento diferente do pé-direito e base solta acima da fundação são erro de montagem', () => {
  const p = abrir('edificio-3-pavimentos.lebr.json');
  const P = p.elementos.find((e) => e.codigo === 'P301');
  P.comprimento = 2.5;
  // o pilar de baixo deixa de receber o P201 (a ligação da base some)
  const P101 = p.elementos.find((e) => e.codigo === 'P101');
  const P201 = p.elementos.find((e) => e.codigo === 'P201');
  P101.cargas = P101.cargas.filter((c) => c.elementoId !== P201.id);
  const m = estadoMontagem(p, reg);
  assert.equal(de(p, m, 'P301').estado, 'erro');
  assert.ok(de(p, m, 'P301').problemas.some((t) => t.includes('pé-direito')));
  assert.equal(de(p, m, 'P201').estado, 'erro');
});

test('fundações contam pelo pilar ligado; viga apoiada em viga não é erro', () => {
  const p = abrir('edificio-3-pavimentos.lebr.json');
  const m = estadoMontagem(p, reg);
  const blocos = p.elementos.filter((e) => e.modulo === 'concreto.bloco');
  assert.ok(blocos.length && blocos.every((b) => m.get(b.id).estado === 'ok'));
  assert.equal(de(p, m, 'V107').estado, 'ok'); // "Apoiada em vigas"
  blocos[0].pilarId = null;
  assert.equal(estadoMontagem(p, reg).get(blocos[0].id).estado, 'sem-posicao');
});
