#!/usr/bin/env node
/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Opus 5.5, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU General Public
 * License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas SEM
 * NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/gpl-3.0.html>.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
/**
 * npm run validar — roda o banco de casos de validação (validacao/casos/*.json),
 * mostra o resumo no terminal e grava validacao/relatorio.html e validacao/relatorio.json.
 * Sai com código 1 se algum caso falhar.
 *
 * Opções: --filtro <texto>  roda só os casos cujo id ou título contém o texto
 *         --sem-arquivos    não grava o relatório
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executarTodos, problemasDoArquivo } from '../src/validacao/executar.js';
import { relatorioHtml, numeroBr, percentual } from '../src/validacao/relatorio-html.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pasta = path.join(raiz, 'validacao', 'casos');
const args = process.argv.slice(2);
const filtro = args.includes('--filtro') ? args[args.indexOf('--filtro') + 1]?.toLowerCase() : null;
const versao = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8')).version;

const arquivos = [];
let problemas = 0;
for (const nome of fs.readdirSync(pasta).filter((f) => f.endsWith('.json')).sort()) {
  let dados;
  try {
    dados = JSON.parse(fs.readFileSync(path.join(pasta, nome), 'utf8'));
  } catch (err) {
    console.error(`✗ ${nome}: JSON inválido — ${err.message}`);
    problemas++;
    continue;
  }
  const p = problemasDoArquivo(dados);
  for (const x of p) console.error(`✗ ${nome}: ${x}`);
  problemas += p.length;
  if (filtro) dados.casos = dados.casos.filter((c) => `${c.id} ${c.titulo}`.toLowerCase().includes(filtro));
  if (dados.casos?.length) arquivos.push({ arquivo: nome, ...dados });
}

const r = executarTodos(arquivos);
const cor = (n, t) => (process.stdout.isTTY ? `\x1b[${n}m${t}\x1b[0m` : t);

console.log(`\nLEBR ${versao} — banco de casos de validação\n`);
for (const g of r.grupos) {
  console.log(cor(1, g.grupo));
  for (const c of g.casos) {
    const pior = Math.max(0, ...c.itens.filter((i) => i.diferenca != null).map((i) => i.diferenca));
    console.log(`  ${c.ok ? cor(32, '✓') : cor(31, '✗')} ${c.titulo} ${cor(2, `(${c.itens.length} ${c.itens.length === 1 ? "grandeza" : "grandezas"}, maior diferença ${percentual(pior)})`)}`);
    if (c.erro) console.log(cor(31, `      erro: ${c.erro}`));
    for (const i of c.itens.filter((x) => !x.ok)) {
      console.log(cor(31, `      ${i.grandeza}: esperado ${numeroBr(i.esperado)} ${i.unidade}, LEBR ${numeroBr(i.obtido)} — diferença ${percentual(i.diferenca)} (tolerância ${percentual(i.tolerancia)})`));
    }
  }
}
console.log(`\n${r.aprovados} de ${r.total} casos aprovados · ${r.grandezas} grandezas · maior diferença ${percentual(r.maiorDiferenca)}`);

if (!args.includes('--sem-arquivos')) {
  fs.writeFileSync(path.join(raiz, 'validacao', 'relatorio.html'), relatorioHtml(r, { versao }));
  fs.writeFileSync(path.join(raiz, 'validacao', 'relatorio.json'), `${JSON.stringify({ versao, ...r }, null, 2)}\n`);
  console.log(`Relatório: ${path.join('validacao', 'relatorio.html')}`);
}
if (problemas) console.log(cor(31, `${problemas} problema(s) na estrutura dos arquivos de casos.`));
process.exit(r.ok && !problemas ? 0 : 1);
