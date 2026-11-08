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
/** Sondagem SPT (NBR 6484:2020): classificação, conferência do boletim, consultas e arquivo do projeto. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { estadoPeloN, nomeDoSolo, tipoDeEstado, analisarSondagem, nEquivalente, rotuloN, camadaNa, nsptNa, nsptMedio, furoMaisProximo } from '../src/engine/sondagem.js';
import { criarSondagem, calcularSondagem } from '../src/modules/geotecnia-sondagem/calculo.js';
import { lerProjeto, serializar } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };

test('estados de compacidade e consistência (Anexo A) com o gênero do solo', () => {
  const areia = { solo: 'areia' }, argila = { solo: 'argila' }, silteAren = { solo: 'silte', secundario: 'arenoso' }, silteArg = { solo: 'silte', secundario: 'argiloso' };
  assert.deepEqual([4, 5, 8, 9, 18, 19, 40, 41].map((n) => estadoPeloN(n, areia)),
    ['fofa', 'pouco compacta', 'pouco compacta', 'medianamente compacta', 'medianamente compacta', 'compacta', 'compacta', 'muito compacta']);
  assert.deepEqual([2, 3, 5, 6, 10, 11, 19, 20, 30, 31].map((n) => estadoPeloN(n, argila)),
    ['muito mole', 'mole', 'mole', 'média', 'média', 'rija', 'rija', 'muito rija', 'muito rija', 'dura']);
  assert.equal(estadoPeloN(12, silteAren), 'medianamente compacto');
  assert.equal(estadoPeloN(12, silteArg), 'rijo');
  assert.equal(tipoDeEstado({ solo: 'aterro' }), null);
  assert.equal(estadoPeloN(10, { solo: 'rocha' }), null);
  assert.equal(nomeDoSolo({ solo: 'argila', secundario: 'siltoso' }), 'Argila siltosa');
  assert.equal(nomeDoSolo({ solo: 'silte', secundario: 'arenoso' }), 'Silte arenoso');
});

test('NSPT com penetração parcial: rótulo e valor equivalente limitado', () => {
  assert.equal(rotuloN(50, 10), '50/10');
  assert.equal(rotuloN(12), '12');
  assert.equal(nEquivalente(50, 10), 50);
  assert.equal(nEquivalente(30, 20), 45);
  assert.equal(nEquivalente(8, 30), 8);
});

test('furo padrão: camadas com NSPT, cotas, nível d’água e boletim conferido', () => {
  const el = { ...criarSondagem(), cotaBoca: 100 };
  const r = calcularSondagem(el);
  assert.equal(r.ok, true, JSON.stringify(r.verificacoes.filter((v) => !v.ok)));
  assert.equal(r.camadas.length, 4);
  assert.equal(r.camadas[1].nMin, 3);
  assert.equal(r.camadas[1].nMax, 5);
  assert.equal(r.camadas[1].estado, 'mole');
  assert.equal(r.camadas[2].estado, 'pouco compacto a medianamente compacto');
  assert.equal(r.nivelAgua.cotaInicial, 96.5);
  assert.equal(r.cotaFundo, 100 - 10.45);
  assert.equal(camadaNa(r, 5).solo, 'silte');
  assert.equal(nsptNa(r, 6.2).n, 12);
  assert.equal(nsptMedio(r, 5, 7), (9 + 12 + 16) / 3);
});

test('boletim incompleto: lacuna de ensaios, camadas curtas e NA ausente não atendem', () => {
  const el = criarSondagem();
  el.spt = el.spt.filter((e) => e.prof !== 5 && e.prof !== 6);
  el.camadas = el.camadas.slice(0, 3);
  el.nivelAgua = { inicial: null, final: null, seco: false };
  const r = analisarSondagem(el);
  const v = Object.fromEntries(r.verificacoes.map((x) => [x.nome, x.ok]));
  assert.equal(v['Ensaio SPT a cada metro'], false);
  assert.equal(v['Perfil descrito até o fim do furo'], false);
  assert.equal(v['Nível d’água registrado'], false);
});

test('exemplo de 3 pavimentos: dois furos no arquivo, calculados e preservados ao salvar', () => {
  const texto = fs.readFileSync(new URL('./fixtures/edificio-3-pavimentos-sem-baldrame.lebr.json', import.meta.url), 'utf8');
  const p = lerProjeto(texto);
  const furos = p.elementos.filter((e) => e.modulo === 'geotecnia.sondagem');
  assert.equal(furos.length, 2);
  for (const f of furos) {
    const r = calcularElemento(f, p, reg);
    assert.ok(!r.erro && r.ok, `${f.codigo}: ${r.erro ?? JSON.stringify(r.verificacoes)}`);
  }
  const de = lerProjeto(serializar(p)).elementos.find((e) => e.codigo === 'SP2');
  assert.equal(de.camadas.length, 4);
  assert.equal(de.spt.at(-1).pen, 8);
  assert.equal(de.nivelAgua.seco, true);
  assert.equal(furoMaisProximo(furos, 9, 11).furo.codigo, 'SP2');
  assert.equal(furoMaisProximo(furos, 0, 0).furo.codigo, 'SP1');
});
