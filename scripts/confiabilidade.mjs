#!/usr/bin/env node
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
 * npm run confiabilidade [-- --n 1000 --semente 7]
 * Roda o banco de casos, as varreduras aleatórias de invariantes e o fechamento do caminho das cargas nos exemplos;
 * grava validacao/confiabilidade.json e docs/CONFIABILIDADE-RELATORIO.md. Sai com 1 se houver falha.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { relatorioConfiabilidade, confiabilidadeMarkdown } from '../src/validacao/confiabilidade.js';
import { lerProjeto } from '../src/renderer/core/projeto.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opc = (k, d) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
const n = opc('--n', 1000), semente = opc('--semente', 20261108);
const versao = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8')).version;

const pastaCasos = path.join(raiz, 'validacao', 'casos');
const arquivos = fs.readdirSync(pastaCasos).filter((f) => f.endsWith('.json')).sort().map((f) => ({ arquivo: f, ...JSON.parse(fs.readFileSync(path.join(pastaCasos, f), 'utf8')) }));
const pastaEx = path.join(raiz, 'exemplos');
const exemplos = fs.readdirSync(pastaEx).filter((f) => f.endsWith('.lebr.json')).sort().map((f) => ({ nome: f.replace('.lebr.json', ''), projeto: lerProjeto(fs.readFileSync(path.join(pastaEx, f), 'utf8')) }));

const t0 = Date.now();
const r = relatorioConfiabilidade({ arquivos, exemplos, n, semente, versao });
fs.writeFileSync(path.join(raiz, 'validacao', 'confiabilidade.json'), JSON.stringify(r, null, 1));
fs.writeFileSync(path.join(raiz, 'docs', 'CONFIABILIDADE-RELATORIO.md'), confiabilidadeMarkdown(r));
console.log(`LEBR ${versao} — confiabilidade (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
console.log(`  banco: ${r.banco.aprovados}/${r.banco.casos} casos, ${r.banco.grandezas} grandezas, maior desvio ${(r.banco.maiorDiferenca * 100).toFixed(2)} %`);
console.log(`  invariantes: ${r.invariantes.total} sorteios, ${r.invariantes.verificacoes} verificações, ${r.invariantes.falhas} falhas (taxa < ${(r.invariantes.limite95 * 100).toFixed(3)} % a 95 %)`);
for (const f of r.fechamento) console.log(`  ${f.nome}: desvio ${(f.desvio * 100).toFixed(2)} %${f.falhas.length ? ` · falhas ${f.falhas.join(',')}` : ''}`);
console.log('  gravado: validacao/confiabilidade.json e docs/CONFIABILIDADE-RELATORIO.md');
process.exit(r.conclusao.bancoOk && r.conclusao.invariantesOk && r.conclusao.fechamentoOk ? 0 : 1);
