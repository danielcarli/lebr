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
/** O banco de casos de validação roda junto com os testes: um caso que falha quebra o npm test. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { executarCaso, problemasDoArquivo, lerCaminho, comparar } from '../src/validacao/executar.js';

const pasta = new URL('../validacao/casos/', import.meta.url);
const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith('.json')).sort();

test('validação: leitura de caminhos e comparação', () => {
  const r = { vaos: [{ M: 2 }], reacoes: [{ id: 'x0', d: 5 }, { id: 'x1', d: 7 }] };
  assert.equal(lerCaminho(r, 'vaos.0.M'), 2);
  assert.equal(lerCaminho(r, 'reacoes[id=x1].d'), 7);
  assert.equal(lerCaminho(r, ''), r);
  assert.equal(comparar({ valor: 100, tolerancia: 0.01 }, 100.9).ok, true);
  assert.equal(comparar({ valor: 100, tolerancia: 0.01 }, 101.1).ok, false);
  assert.equal(comparar({ valor: 'ok' }, 'ok').ok, true);
  assert.equal(comparar({ valor: 1 }, undefined).ok, false);
});

const ids = new Set();
for (const nome of arquivos) {
  const dados = JSON.parse(fs.readFileSync(new URL(nome, pasta), 'utf8'));
  test(`validação ${nome}: estrutura`, () => assert.deepEqual(problemasDoArquivo(dados), []));
  for (const caso of dados.casos) {
    test(`validação ${nome} › ${caso.id}`, () => {
      assert.ok(!ids.has(caso.id), `id repetido entre arquivos: ${caso.id}`);
      ids.add(caso.id);
      const r = executarCaso(caso);
      assert.ok(!r.erro, r.erro);
      const falhas = r.itens.filter((i) => !i.ok).map((i) => `${i.grandeza}: esperado ${i.esperado}, obtido ${i.obtido}`);
      assert.deepEqual(falhas, []);
    });
  }
}
