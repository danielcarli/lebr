/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Fable 5.1, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU Affero General
 * Public License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas
 * SEM NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/agpl-3.0.html>.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Confiabilidade: varreduras aleatórias de invariantes (uma amostra menor por família; a campanha inteira roda com
 * npm run confiabilidade) e fechamento do caminho das cargas em todos os projetos de exemplo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rodarInvariantes, FAMILIAS, limiteSuperior95, criarRng } from '../src/validacao/invariantes.js';
import { calcularProjeto, fechamentoDoCaminhoDasCargas } from '../src/validacao/caminho-cargas.js';
import { lerProjeto } from '../src/renderer/core/projeto.js';

const N = Number(process.env.LEBR_INVARIANTES_N) || 60;

test('gerador com semente é reprodutível e o limite de 95 % segue a regra dos três', () => {
  const a = criarRng(7), b = criarRng(7);
  assert.deepEqual([a(), a(), a.inteiro(1, 9)], [b(), b(), b.inteiro(1, 9)]);
  assert.equal(limiteSuperior95(0, 300), 0.01);
  assert.ok(limiteSuperior95(3, 300) > 0.01 && limiteSuperior95(3, 300) < 0.05);
});

for (const f of FAMILIAS) {
  test(`invariantes · ${f.nome} (${N} sorteios)`, () => {
    const r = rodarInvariantes({ n: N, apenas: [f.id] }).familias[0];
    assert.equal(r.excecoes, 0, `exceções: ${r.exemplosFalha.filter((x) => x.invariante === 'sem exceção').map((x) => x.detalhe).join(' | ')}`);
    assert.equal(r.falhas, 0, r.exemplosFalha.map((x) => `${x.invariante}: ${x.detalhe} ${JSON.stringify(x.entrada)}`).join('\n'));
    assert.ok(r.verificacoes >= N, 'cada sorteio confere ao menos um invariante');
  });
}

test('caminho das cargas: o peso somado elemento a elemento chega às fundações em todos os exemplos (≤ 1 %)', () => {
  const pasta = new URL('../exemplos/', import.meta.url);
  for (const arq of fs.readdirSync(pasta).filter((f) => f.endsWith('.lebr.json'))) {
    const p = calcularProjeto(lerProjeto(fs.readFileSync(new URL(arq, pasta), 'utf8')));
    const f = fechamentoDoCaminhoDasCargas(p);
    assert.ok(f.fundacao.n > 0 || f.semFundacao.length > 0, `${arq}: nada chega à fundação`);
    assert.ok(Math.abs(f.desvio) <= 0.01, `${arq}: desvio ${(f.desvio * 100).toFixed(2)} % — entra ${(f.entra.g + f.entra.q).toFixed(0)} kN, chega ${(f.fundacao.g + f.fundacao.q).toFixed(0)} kN`);
  }
});
