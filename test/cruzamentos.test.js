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
/** Lançamento, etapa L3: apoio explícito nos cruzamentos viga–viga. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { verificarConsistencia } from '../src/renderer/core/consistencia.js';
import { cruzamentosDoPavimento, definirCruzamento, definirTodosCruzamentos, sugerirCruzamento, textoCruzamento, SEM_TRANSFERENCIA } from '../src/renderer/core/cruzamentos.js';
import { grelhaDoPavimento } from '../src/modules/comum/grelha.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const caso = () => lerProjeto(fs.readFileSync(new URL('./fixtures/consistencia/cruzamento-indefinido.lebr.json', import.meta.url), 'utf8'));
const regras = (p) => verificarConsistencia(p, reg).map((x) => x.regra);

test('duas vigas em cruz: um cruzamento, indefinido, que bloqueia o cálculo', () => {
  const p = caso();
  const cs = cruzamentosDoPavimento(p, reg, 'p1');
  assert.equal(cs.length, 1, 'os encontros em T com as vigas do contorno não contam');
  assert.equal(cs[0].valor, null);
  assert.deepEqual(cs[0].ponto.map((v) => Math.round(v * 1000) / 1000), [2, 2.5]);
  assert.deepEqual(regras(p), ['cruzamento-indefinido']);
});

test('definir o cruzamento tira o erro; na análise isolada sobra um aviso', () => {
  const p = caso();
  const [c] = cruzamentosDoPavimento(p, reg, 'p1');
  definirCruzamento(p, 'p1', c.chave, 'v5');
  assert.equal(textoCruzamento(cruzamentosDoPavimento(p, reg, 'p1')[0]), 'V5 apoia em V6');
  assert.deepEqual(regras(p), ['cruzamento-isolada']);
  p.pavimentos.find((x) => x.id === 'p1').analise = 'grelha';
  assert.deepEqual(regras(p), []);
  definirCruzamento(p, 'p1', c.chave, SEM_TRANSFERENCIA);
  assert.deepEqual(regras(p), []);
  definirCruzamento(p, 'p1', c.chave, null);
  assert.deepEqual(regras(p), ['cruzamento-indefinido']);
});

test('Definir todos: a viga mais rígida (b·h³/L³) é o apoio', () => {
  const p = caso();
  // V5 (L = 4 m) é mais rígida que V6 (L = 5 m) com a mesma seção: V6 apoia em V5
  assert.equal(sugerirCruzamento(cruzamentosDoPavimento(p, reg, 'p1')[0]), 'v6');
  // com V6 mais alta, inverte
  p.elementos.find((e) => e.id === 'v6').secao = { b: 20, h: 70 };
  assert.equal(definirTodosCruzamentos(p, reg), 1);
  assert.equal(cruzamentosDoPavimento(p, reg, 'p1')[0].apoiada.codigo, 'V5');
  assert.equal(definirTodosCruzamentos(p, reg), 0, 'nada mais a definir');
});

test('na grelha, inverter o apoio troca a reação entre as vigas', () => {
  const forca = (apoiada) => {
    const p = caso();
    p.pavimentos.find((x) => x.id === 'p1').analise = 'grelha';
    definirCruzamento(p, 'p1', cruzamentosDoPavimento(p, reg, 'p1')[0].chave, apoiada);
    const g = grelhaDoPavimento(p, 'p1', reg);
    assert.ok(!g.erro, g.erro);
    const it = (id) => g.vigas.find((v) => v.id === id).interacoes.find((x) => x.com.includes(id === 'v5' ? 'V6' : 'V5'));
    return { v5: it('v5').Rg, v6: it('v6').Rg };
  };
  const a = forca('v5'), b = forca('v6'), sem = forca(null);
  // a força no nó é igual e oposta nas duas vigas
  assert.ok(Math.abs(a.v5 + a.v6) < 1e-6 && Math.abs(b.v5 + b.v6) < 1e-6);
  // V5 apoiada: V6 recebe a reação de V5 (para baixo); invertendo, V5 recebe a de V6
  assert.ok(a.v6 < -1 && b.v5 < -1, JSON.stringify({ a, b }));
  assert.ok(Math.abs(a.v6 - b.v5) > 1, 'as reações mudam de valor junto com o sentido');
  assert.ok(Math.abs(sem.v5 - a.v5) > 1e-3, 'com nó comum sem definição, a força fica entre as duas');
});

test('sem transferência: as vigas se cruzam sem nó comum na grelha', () => {
  const p = caso();
  p.pavimentos.find((x) => x.id === 'p1').analise = 'grelha';
  definirCruzamento(p, 'p1', cruzamentosDoPavimento(p, reg, 'p1')[0].chave, SEM_TRANSFERENCIA);
  const g = grelhaDoPavimento(p, 'p1', reg);
  assert.ok(!g.erro, g.erro);
  assert.equal(g.vigas.find((v) => v.id === 'v5').interacoes.filter((x) => x.com.includes('V6')).length, 0);
  assert.ok(!g.nos.some((n) => Math.abs(n.x - 2) < 1e-6 && Math.abs(n.y - 2.5) < 1e-6), 'nenhum nó no cruzamento');
});
