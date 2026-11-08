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
 * API de script do console: criação de elementos por linha de comando, atalhos e ligações.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { criarProjeto } from '../src/renderer/core/projeto.js';
import { criarApiScript, normalizarPropriedades, mesclar } from '../src/renderer/core/script.js';
import { estado } from '../src/renderer/core/estado.js';
import * as viga from '../src/modules/concreto-viga/calculo.js';
import * as laje from '../src/modules/concreto-laje-macica/calculo.js';
import * as pilar from '../src/modules/concreto-pilar/calculo.js';

const MODS = [
  { id: 'concreto.viga', nome: 'Viga de concreto', nomeCurto: 'Viga', categoria: 'vigas', prefixo: 'V', sigla: 'CV1', criar: viga.criarViga, ligacoes: viga.ligacoes },
  { id: 'concreto.laje.macica', nome: 'Laje maciça', nomeCurto: 'Laje maciça', categoria: 'lajes', prefixo: 'L', sigla: 'CL1', criar: laje.criarLaje, ligacoes: laje.ligacoes },
  { id: 'concreto.pilar', nome: 'Pilar', nomeCurto: 'Pilar', categoria: 'pilares', prefixo: 'P', sigla: 'CP1', criar: pilar.criarPilar, ligacoes: pilar.ligacoes },
];
const modulos = { obter: (id) => MODS.find((m) => m.id === id) ?? null, lista: () => MODS };

function novaApi() {
  estado.abrir(criarProjeto({ nome: 'Teste do console' }), null);
  const saida = [];
  return { api: criarApiScript({ estado, modulos, imprimir: (t) => saida.push(t) }), saida };
}

test('atalhos: vãos, apoios, cargas, bordas e normal do pilar', () => {
  const v = normalizarPropriedades({ b: 15, h: 40, vaos: [4, 3.5], apoios: 'eal', g: 5, x: 1, pavimento: 'X' }, MODS[0], viga.criarViga());
  assert.deepEqual(v.campos.secao, { b: 15, h: 40 });
  assert.deepEqual(v.campos.vaos, [{ L: 4 }, { L: 3.5 }]);
  assert.deepEqual(v.campos.apoios, ['engaste', 'apoio', 'livre']);
  assert.equal(v.campos.cargas.at(-1).natureza, 'g');
  assert.deepEqual(v.posicao, { x: 1, pavimento: 'X' });
  const l = normalizarPropriedades({ bordas: 'aela', acidental: 2 }, MODS[1], laje.criarLaje());
  assert.deepEqual(l.campos.bordas, { x0: 'apoiada', x1: 'engastada', y0: 'livre', y1: 'apoiada' });
  assert.equal(l.campos.cargas.acidental, 2);
  const p = normalizarPropriedades({ N: 300, Nq: 40, L: 3 }, MODS[2], pilar.criarPilar());
  assert.equal(p.campos.comprimento, 3);
  assert.deepEqual(p.campos.cargas.map((c) => [c.natureza, c.valor]), [['g', 300], ['q', 40]]);
  assert.deepEqual(mesclar({ a: { b: 1, c: 2 }, l: [1] }, { a: { c: 3 }, l: [2, 3] }), { a: { b: 1, c: 3 }, l: [2, 3] });
});

test('criar pelo console: códigos automáticos, posição, pé-direito do pilar e erros claros', () => {
  const { api } = novaApi();
  for (const [x, y] of [[0, 0], [4, 0]]) api.pilar({ bx: 20, by: 20, N: 150, em: [x, y] });
  const v = api.viga({ codigo: 'V10', b: 15, h: 40, vaos: [4], em: [0, 0] });
  assert.equal(v.codigo, 'V10');
  assert.equal(v.pavimento, '1º pavimento');
  assert.deepEqual(api.elementos('P').map((e) => e.codigo), ['P1', 'P2']);
  assert.equal(estado.projeto.elementos.find((e) => e.codigo === 'P1').comprimento, 2.8, 'pilar recebe o pé-direito');
  assert.throws(() => api.viga({ codigo: 'V10' }), /já existe/);
  assert.throws(() => api.criar('xyz'), /desconhecido/);
  assert.throws(() => api.viga({ pavimento: 'Inexistente', x: 0 }), /não existe/);
  assert.equal(api.criar('CL1', { lx: 4, ly: 3 }).tipo, 'Laje maciça', 'tipo pela sigla');
  // conectar: viga sobre os dois pilares
  assert.match(api.conectar(), /^2 ligação/);
  assert.equal(estado.projeto.elementos.find((e) => e.codigo === 'P2').cargas.filter((c) => c.tipo === 'elemento').length, 1);
  // editar, mover, renomear e desfazer
  api.alterar('V10', { h: 50 });
  assert.equal(estado.projeto.elementos.find((e) => e.codigo === 'V10').secao.h, 50);
  api.mover('V10', 0, 3);
  assert.deepEqual(api.elementos('V')[0].posicao, [0, 3, 0]);
  api.renomear('V10', 'V2');
  assert.ok(api.elemento('V2'));
  api.desfazer();
  assert.ok(api.elemento('V10'));
  assert.equal(api.pavimento('2º pavimento', 5.6).cota, 5.6);
  assert.equal(api.pavimentos()[0].nome, '2º pavimento');
});
