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
/**
 * Lançamento, etapa L2: painel de problemas que bloqueia o cálculo. Um arquivo por defeito
 * (test/fixtures/consistencia, gerados por tools/consistencia/gerar-casos.mjs) gera exatamente um problema.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { verificarConsistencia, problemasPorPavimento, contarProblemas, errosDoElemento, REGRAS } from '../src/renderer/core/consistencia.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const caso = (nome) => lerProjeto(fs.readFileSync(new URL(`./fixtures/consistencia/${nome}.lebr.json`, import.meta.url), 'utf8'));
const exemplo = (nome) => lerProjeto(fs.readFileSync(new URL(`../exemplos/${nome}`, import.meta.url), 'utf8'));
const resumo = (lista) => lista.map((p) => `${p.gravidade} ${p.regra} ${p.elemento?.codigo}: ${p.texto}`);

test('regras: identificadores únicos, gravidade erro ou aviso, as seis do roteiro são erros', () => {
  assert.equal(new Set(REGRAS.map((r) => r.id)).size, REGRAS.length);
  assert.ok(REGRAS.every((r) => ['erro', 'aviso'].includes(r.gravidade) && r.nome && r.descricao));
  for (const id of ['solto', 'viga-sem-apoio', 'contorno-aberto', 'sobreposicao', 'pilar-sem-continuidade', 'carga-inexistente']) {
    assert.equal(REGRAS.find((r) => r.id === id)?.gravidade, 'erro', id);
  }
});

test('modelo correto de dois pavimentos: nenhum problema', () => {
  assert.deepEqual(resumo(verificarConsistencia(caso('modelo-correto'), reg)), []);
});

const DEFEITOS = {
  'elemento-solto': ['solto', 'P9'],
  'viga-sem-apoio': ['viga-sem-apoio', 'V5'],
  'laje-contorno-aberto': ['contorno-aberto', 'L1'],
  sobreposicao: ['sobreposicao', 'V5'],
  'pilar-sem-continuidade': ['pilar-sem-continuidade', 'P5'],
  'carga-inexistente': ['carga-inexistente', 'V1'],
};
for (const [arq, [regra, codigo]] of Object.entries(DEFEITOS)) {
  test(`um defeito, um problema: ${arq}`, () => {
    const lista = verificarConsistencia(caso(arq), reg);
    assert.equal(lista.length, 1, resumo(lista).join(' | '));
    assert.equal(lista[0].regra, regra);
    assert.equal(lista[0].gravidade, 'erro');
    assert.equal(lista[0].elemento.codigo, codigo);
  });
}

test('problemas apontam o lugar: viga sem apoio no ponto do apoio, no pavimento da viga', () => {
  const [p] = verificarConsistencia(caso('viga-sem-apoio'), reg);
  assert.equal(p.pavimento, 'p1');
  assert.deepEqual(p.ponto.map((v) => Math.round(v * 1000) / 1000), [7, 0]);
  const [s] = verificarConsistencia(caso('sobreposicao'), reg);
  assert.deepEqual(s.relacionados, ['v1']);
});

test('os erros bloqueiam o cálculo só do elemento com o defeito; os grupos seguem os pavimentos', () => {
  const p = caso('viga-sem-apoio');
  const lista = verificarConsistencia(p, reg);
  assert.equal(errosDoElemento(lista, 'v5').length, 1);
  assert.equal(errosDoElemento(lista, 'v1').length, 0);
  assert.deepEqual(contarProblemas(lista), { erros: 1, avisos: 0 });
  const grupos = problemasPorPavimento(p, lista);
  assert.deepEqual(grupos.map((g) => [g.nome, g.problemas.length]), [['1º pavimento', 1]]);
});

test('exemplo de 3 pavimentos: zero problemas; os outros exemplos também', () => {
  assert.deepEqual(resumo(verificarConsistencia(exemplo('edificio-3-pavimentos.lebr.json'), reg)), []);
  for (const arq of ['edificio-exemplo.lebr.json', 'residencia-terrea-baldrame.lebr.json', 'edificio-18-pavimentos.lebr.json']) {
    assert.deepEqual(resumo(verificarConsistencia(exemplo(arq), reg)), [], arq);
  }
});

test('ligação indicada pela planta e não aplicada: um erro só (não vira contorno aberto)', () => {
  const p = caso('modelo-correto');
  const v1 = p.elementos.find((e) => e.codigo === 'V1');
  v1.cargas = v1.cargas.filter((c) => c.elementoId !== 'l1');
  const lista = verificarConsistencia(p, reg);
  assert.deepEqual(resumo(lista), ['erro ligacao-pendente V1: Ligação L1 · Borda inferior → V1 indicada pela planta e não aplicada.']);
  assert.ok(lista[0].ligacao, 'o painel oferece Conectar');
});

test('avisos não bloqueiam: pilar fora do pé-direito', () => {
  const p = caso('modelo-correto');
  p.elementos.find((e) => e.codigo === 'P5').comprimento = 2.8;
  const lista = verificarConsistencia(p, reg);
  assert.deepEqual(lista.map((x) => x.regra), ['pe-direito']);
  assert.equal(contarProblemas(lista).erros, 0);
});

test('elemento fora da planta não é verificado pela geometria, mas a carga inexistente vale para ele', () => {
  const p = caso('modelo-correto');
  p.elementos.push({ id: 'vz', modulo: 'concreto.viga', codigo: 'V9', nome: 'V9', ...MODULOS_CALCULO['concreto.viga'].criar() });
  assert.equal(verificarConsistencia(p, reg).length, 0);
  p.elementos.at(-1).cargas.push({ id: 'x', tipo: 'elemento', elementoId: 'nada', ligacao: 'apoio-0' });
  const lista = verificarConsistencia(p, reg);
  assert.equal(lista.length, 1);
  assert.equal(problemasPorPavimento(p, lista)[0].nome, 'Fora da planta');
});

import { correcaoDe, resolverAutomaticamente, corrigiveis } from '../src/renderer/core/consistencia.js';

test('correção de um clique: ligação fora da posição é desfeita; Resolver automaticamente encosta e reconecta', () => {
  const p = caso('modelo-correto');
  const v1 = p.elementos.find((e) => e.codigo === 'V1');
  // V1 empurrada 3 mm para fora do eixo e 0,5 m para o lado: as ligações antigas não conferem mais
  v1.posicao.x = 0.5;
  let lista = verificarConsistencia(p, reg);
  const fora = lista.filter((x) => x.regra === 'ligacao-fora');
  assert.ok(fora.length >= 1);
  assert.equal(correcaoDe(fora[0]).rotulo, 'Desfazer ligação');
  assert.ok(corrigiveis(lista) >= fora.length);
  const r = resolverAutomaticamente(p, reg);
  assert.ok(r.feitas >= fora.length);
  lista = verificarConsistencia(p, reg);
  assert.equal(lista.filter((x) => x.regra === 'ligacao-fora').length, 0);
  // o que sobra pede decisão (a viga deslocada não chega mais ao pilar)
  assert.equal(corrigiveis(lista), 0, lista.map((x) => x.regra).join());
  // e essas têm botão de decisão (borda livre, balanço, retirar da planta), fora do Resolver automaticamente
  const decisoes = lista.map(correcaoDe).filter(Boolean);
  assert.ok(decisoes.every((c) => c.automatica === false));
});

test('Resolver automaticamente: ligação não aplicada e pé-direito', () => {
  const p = caso('modelo-correto');
  const v1 = p.elementos.find((e) => e.codigo === 'V1');
  v1.cargas = v1.cargas.filter((c) => c.elementoId !== 'l1');
  p.elementos.find((e) => e.codigo === 'P5').comprimento = 2.8;
  assert.equal(verificarConsistencia(p, reg).length, 2);
  resolverAutomaticamente(p, reg);
  assert.deepEqual(resumo(verificarConsistencia(p, reg)), []);
});
