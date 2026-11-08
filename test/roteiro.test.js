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
/** O roteiro do programa (Ajuda › Roteiro) e o docs/ROTEIRO.md têm o mesmo conteúdo. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROTEIRO, roteiroMarkdown } from '../src/renderer/views/roteiro-dados.js';

test('roteiro: três fases com critério de saída e áreas preenchidas', () => {
  assert.equal(ROTEIRO.fases.length, 3);
  for (const f of ROTEIRO.fases) { assert.ok(f.itens.length >= 5); assert.ok(f.saida); }
  for (const a of ROTEIRO.areas) {
    assert.ok(a.linhas || a.grupos || a.itens, a.titulo);
    for (const l of a.linhas ?? []) assert.equal(l.length, a.colunas.length, `${a.titulo}: ${l[0]}`);
  }
});

test('roteiro: docs/ROTEIRO.md está em dia com os dados', () => {
  // no Windows o git pode trocar as quebras de linha por CRLF ao baixar o repositório
  const md = fs.readFileSync(new URL('../docs/ROTEIRO.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(md.trim(), roteiroMarkdown().trim(), 'gere de novo: node -e "…roteiroMarkdown()" > docs/ROTEIRO.md');
});

test('roteiro: estados dos itens (0.35)', async () => {
  const { estadoDe, contarEstados } = await import('../src/renderer/views/roteiro-dados.js');
  for (const x of ROTEIRO.fases[0].itens) assert.equal(estadoDe(x), 'feito', x);
  assert.equal(estadoDe('Radier'), 'parcial');
  assert.equal(estadoDe('Recalques'), 'falta');
  assert.equal(estadoDe('Torção de equilíbrio e de compatibilidade, combinada com cortante (NBR 6118, 17.5)'), 'parcial');
  const c = contarEstados();
  assert.ok(c.feito > 0 && c.parcial > 0 && c.falta > 0);
  const lanc = ROTEIRO.areas.find((a) => a.titulo === 'Lançamento da estrutura');
  assert.ok(lanc && lanc.linhas.length >= 15);
  assert.ok(ROTEIRO.planos[0][1].filter((p) => p.startsWith('- L')).length === 15);
});

test('bibliografia: divergências e exercícios excluídos documentados', async () => {
  const { DIVERGENCIAS, EXCLUIDOS, ehArquivoBibliografia } = await import('../src/validacao/bibliografia-notas.js');
  assert.ok(DIVERGENCIAS.some((d) => d.situacao === 'revisar'));
  assert.ok(EXCLUIDOS.length >= 5);
  assert.ok(ehArquivoBibliografia('28-bibliografia-fundacoes.json') && !ehArquivoBibliografia('11-puncao.json'));
  const fs = await import('node:fs');
  const nomes = fs.readdirSync(new URL('../validacao/casos/', import.meta.url)).filter(ehArquivoBibliografia);
  let n = 0;
  for (const f of nomes) for (const c of JSON.parse(fs.readFileSync(new URL(`../validacao/casos/${f}`, import.meta.url), 'utf8')).casos) {
    assert.ok(c.referencia && c.url && c.descricao, c.id); n++;
  }
  assert.equal(n, 158);
});
